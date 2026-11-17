"""Isolated browser-test bridge to the actual FastAPI app; never uses private data."""
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import AsyncMock

sys.path.insert(0, os.environ.get('MIDNIGHT_SOURCE_ROOT', str(Path(__file__).resolve().parents[1])))
TEST_DATA = tempfile.TemporaryDirectory(prefix='midnight-browser-')
os.environ['MIDNIGHT_DATA'] = TEST_DATA.name
os.environ['PYDANTIC_DISABLE_PLUGINS'] = '__all__'
from fastapi.testclient import TestClient
import server
if os.environ.get('MIDNIGHT_WIDGET_FIXTURES'):
    from widget_fixtures import install
    install(server, os.environ['MIDNIGHT_WIDGET_FIXTURES'])
server.Discover.discover_single = AsyncMock(side_effect=AssertionError('No device connections in browser tests'))

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def serve(self):
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'origin', 'connection')}
        headers['Host'] = '127.0.0.1:8765'
        if self.headers.get('Origin'):
            headers['Origin'] = server.BASE
        response = client.request(self.command, self.path, headers=headers,
                                  content=self.rfile.read(int(self.headers.get('Content-Length', 0))))
        self.send_response(response.status_code)
        for key, value in response.headers.items():
            if key.lower() not in ('transfer-encoding', 'content-encoding', 'content-length', 'connection'):
                self.send_header(key, value)
        self.send_header('Content-Length', str(len(response.content)))
        self.end_headers()
        try:
            self.wfile.write(response.content)
        except (BrokenPipeError, ConnectionResetError):
            pass # Browsers cancel video range requests when changing scenes.

    do_GET = serve
    do_POST = serve

if __name__ == '__main__':
    with TestClient(server.app, base_url=server.BASE) as client:
        httpd = ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('MIDNIGHT_TEST_PORT','8879'))), Handler)
        print('Isolated real-backend browser server ready', flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            httpd.server_close()
            TEST_DATA.cleanup()
