"""Process ownership checks and the legacy activation entry point."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import time
from urllib.request import urlopen
BASE='http://127.0.0.1:8765'

def process_cwd(pid):
    result = subprocess.run(['/usr/sbin/lsof', '-a', '-p', str(pid), '-d', 'cwd', '-Fn'],
                            capture_output=True, text=True)
    return next((Path(line[1:]) for line in result.stdout.splitlines() if line.startswith('n')), None)

def midnight_servers():
    if os.name=='nt':
        try:
            with urlopen(BASE+'/api/runtime',timeout=2) as response:info=json.load(response)
            return {int(info['pid']):Path(info['root'])}
        except (OSError,ValueError,KeyError):return {}
    output = subprocess.check_output(['/bin/ps', '-axo', 'pid=,args='], text=True)
    found = {}
    for line in output.splitlines():
        values = line.strip().split(None, 1)
        if len(values) != 2:
            continue
        pid, command = values
        try:
            args = shlex.split(command)
        except ValueError:
            continue
        if not args or not re.match(r'^(python[\d.]*|uvicorn)$', Path(args[0]).name):
            continue
        if not any(Path(arg).name in ('server.py', 'browser_server.py') or arg == 'server:app' for arg in args[1:]):
            continue
        cwd = process_cwd(int(pid))
        page = cwd / 'static/index.html' if cwd else None
        if page and page.is_file() and b'<title>Midnight Dashboard</title>' in page.read_bytes():
            found[int(pid)] = cwd
    return found

def listener_pids():
    if os.name=='nt':
        import socket
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1',8765))!=0:return set()
        return set(midnight_servers()) or {-1}
    result = subprocess.run(['/usr/sbin/lsof', '-nP', '-iTCP:8765', '-sTCP:LISTEN', '-t'],
                            capture_output=True, text=True)
    return {int(value) for value in result.stdout.split()}

def stop_servers(servers):
    if os.name=='nt':
        current=midnight_servers()
        for pid,root in servers.items():
            if current.get(pid)==root:subprocess.run(['taskkill','/PID',str(pid),'/T'],check=True,stdout=subprocess.DEVNULL)
        return
    for pid, cwd in servers.items():
        if process_cwd(pid) == cwd:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        remaining = {pid: cwd for pid, cwd in midnight_servers().items() if pid in servers}
        if not remaining:
            return
        time.sleep(.2)
    # Only the same, positively identified Midnight processes may be forced closed.
    for pid, cwd in remaining.items():
        if servers.get(pid) == cwd:
            os.kill(pid, signal.SIGKILL)
    time.sleep(.3)
    if set(midnight_servers()) & set(servers):
        raise RuntimeError('An older Midnight server did not stop. No new server started.')

def main():
    from apply_upgrade import apply
    parser=argparse.ArgumentParser();parser.add_argument('--target',type=Path,required=True);parser.add_argument('--check',action='store_true');options=parser.parse_args()
    apply(options.target,restart=not options.check,check=options.check)

if __name__=='__main__':main()
