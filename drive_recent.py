"""Local OAuth connection and read-only Google Drive recents."""
import asyncio
import base64
import hashlib
import re
import secrets
import time
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, SecretStr

SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
FILES_URL = 'https://www.googleapis.com/drive/v3/files'
CALLBACK = 'http://127.0.0.1:8765/api/drive/callback'
CONFIG = 'drive-connection.json'


class DriveClient(BaseModel):
    client_id: str
    client_secret: SecretStr


def recent_files(values):
    files = []
    for item in values:
        identifier = item.get('id', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,256}', identifier):
            continue
        if not item.get('viewedByMeTime'):
            continue
        address = item.get('webViewLink', '')
        location = urlsplit(address)
        if location.scheme != 'https' or location.netloc not in ('docs.google.com', 'drive.google.com'):
            address = 'https://drive.google.com/open?' + urlencode({'id': identifier})
        files.append({'name': item.get('name') or 'Untitled',
                      'mimeType': item.get('mimeType', ''),
                      'url': address})
        if len(files) == 3:
            break
    return files


def drive_router(read_json, save_json):
    router = APIRouter(prefix='/api/drive')
    lock = asyncio.Lock()
    pending = {}
    cached = None

    async def exchange(client, payload):
        response = await client.post(TOKEN_URL, data=payload)
        if response.status_code in (400, 401):
            raise HTTPException(401, 'Google authorization expired or was rejected. Connect Drive again.')
        if response.status_code != 200:
            raise HTTPException(502, 'Google sign-in is temporarily unavailable.')
        token = response.json()
        return {**token, 'expires_at': time.time() + token.get('expires_in', 3600) - 60}

    @router.post('/connect')
    async def connect(body: DriveClient, request: Request):
        client_id = body.client_id.strip()
        secret = body.client_secret.get_secret_value().strip()
        if not re.fullmatch(r'[a-zA-Z0-9_-]{10,170}\.apps\.googleusercontent\.com', client_id) or not re.fullmatch(r'[a-zA-Z0-9_-]{8,200}', secret):
            raise HTTPException(422, 'Enter the client ID and secret from a Google Web application OAuth client.')
        state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
        origin = 'http://' + request.headers['host']
        async with lock:
            pending.clear()
            pending[state] = (time.monotonic() + 600, verifier, client_id, secret, origin)
        return {'url': 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode({
            'client_id': client_id, 'redirect_uri': CALLBACK, 'response_type': 'code',
            'scope': SCOPE, 'access_type': 'offline', 'prompt': 'consent select_account',
            'state': state, 'code_challenge': challenge, 'code_challenge_method': 'S256',
        })}

    @router.post('/reconnect')
    async def reconnect(request:Request):
        saved=read_json(CONFIG,{})
        if not saved.get('client_id') or not saved.get('client_secret'):raise HTTPException(400,'Enter your Google OAuth setup first.')
        return await connect(DriveClient(client_id=saved['client_id'],client_secret=saved['client_secret']),request)

    @router.get('/callback')
    async def callback(state: str = '', code: str = '', error: str = ''):
        nonlocal cached
        async with lock, httpx.AsyncClient(timeout=12) as client:
            authorization = pending.pop(state, None)
            if not authorization or authorization[0] < time.monotonic():
                raise HTTPException(400, 'Drive sign-in expired. Start again from Midnight.')
            _, verifier, client_id, secret, origin = authorization
            if error or not code:
                return RedirectResponse(origin + '/app#drive-denied', status_code=303)
            try:
                token = await exchange(client, {
                    'client_id': client_id, 'client_secret': secret, 'code': code,
                    'grant_type': 'authorization_code', 'redirect_uri': CALLBACK,
                    'code_verifier': verifier,
                })
                if not token.get('refresh_token') or SCOPE not in token.get('scope', '').split():
                    raise HTTPException(401, 'Google did not grant Drive metadata access.')
            except (HTTPException, httpx.HTTPError):
                return RedirectResponse(origin + '/app#drive-denied', status_code=303)
            save_json(CONFIG, {'client_id': client_id, 'client_secret': secret, 'token': token})
            cached = None
        return RedirectResponse(origin + '/app#drive-connected', status_code=303)

    @router.get('/recent')
    async def recent(refresh: bool = False):
        nonlocal cached
        async with lock:
            connection = read_json(CONFIG, {})
            if not connection:
                return {'connected': False, 'files': []}
            if not refresh and cached and cached[0] > time.monotonic():
                return {'connected': True, 'files': cached[1]}
            if not isinstance(connection.get('token'),dict) or not all(connection.get(k) for k in ('client_id','client_secret')) or not all(connection['token'].get(k) for k in ('access_token','refresh_token')):raise HTTPException(401,'Saved Drive connection is incomplete. Reconnect or replace your credentials.')
            token = connection['token']
            async with httpx.AsyncClient(timeout=12) as client:
                if token.get('expires_at', 0) <= time.time():
                    token.update(await exchange(client, {
                        'client_id': connection['client_id'], 'client_secret': connection['client_secret'],
                        'refresh_token': token['refresh_token'], 'grant_type': 'refresh_token',
                    }))
                    save_json(CONFIG, connection)
                response = await client.get(FILES_URL, headers={'Authorization': 'Bearer ' + token['access_token']},
                    params={'q': "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
                            'orderBy': 'viewedByMeTime desc', 'pageSize': 20, 'spaces': 'drive',
                            'fields': 'files(id,name,mimeType,webViewLink,viewedByMeTime)'})
            if response.status_code == 401:
                raise HTTPException(401, 'Google authorization expired. Connect Drive again.')
            if response.status_code == 403:
                raise HTTPException(403, 'Drive access was denied. Check that the Drive API is enabled and your account is allowed.')
            if response.status_code == 429:
                raise HTTPException(429, 'Google is limiting requests. Try again shortly.')
            if response.status_code != 200:
                raise HTTPException(502, 'Google Drive is temporarily unavailable.')
            files = recent_files(response.json().get('files', []))
            cached = (time.monotonic() + 60, files)
            return {'connected': True, 'files': files}

    @router.post('/disconnect')
    async def disconnect():
        nonlocal cached
        async with lock:
            pending.clear()
            save_json(CONFIG, {})
            save_json(CONFIG, {})
            cached = None
        return {'ok': True}

    return router
