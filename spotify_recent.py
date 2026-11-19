"""Project Spotify history into up to ten distinct album or playlist links."""
import re


def recent_collections(history):
    collections = {}
    for entry in history:
        track = entry.get('track') or {}
        album = track.get('album') or {}
        context = entry.get('context') or {}
        uri = context.get('uri') or ''
        if not re.fullmatch(r'spotify:(playlist|album):[a-zA-Z0-9]{1,64}', uri):
            uri = album.get('uri') or ''
        match = re.fullmatch(r'spotify:(playlist|album):([a-zA-Z0-9]+)', uri)
        if not match or uri in collections:
            continue
        kind, identifier = match.groups()
        album_matches = kind == 'album' and album.get('uri') == uri
        details = album if album_matches else {}
        collections[uri] = {
            'name': details.get('name') or kind.title(),
            'image': next(iter(details.get('images') or []), {}).get('url'),
            'url': f'https://open.spotify.com/{kind}/{identifier}',
        }
        if len(collections) == 10:
            break
    return collections


def recent_tracks(history):
    """Ten unique playable songs in listening order, keeping album and source context."""
    tracks = {}
    for entry in history:
        track = entry.get('track') or {}
        uri = track.get('uri') or ''
        if not re.fullmatch(r'spotify:track:[a-zA-Z0-9]{1,64}', uri) or uri in tracks or track.get('is_local') or track.get('is_playable') is False:
            continue
        album = track.get('album') or {}
        context = entry.get('context') or {}
        tracks[uri] = {
            'uri': uri, 'name': track.get('name') or 'Unknown song',
            'artist': ', '.join(a.get('name', '') for a in track.get('artists') or []),
            'album': album.get('name') or '',
            'image': next(iter(album.get('images') or []), {}).get('url'),
            'context_uri': context.get('uri'),
            'url': 'https://open.spotify.com/track/' + uri.split(':')[-1],
        }
        if len(tracks) == 10:
            break
    return list(tracks.values())
