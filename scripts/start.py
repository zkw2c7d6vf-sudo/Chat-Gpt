"""Use the persistent runtime selected by the release installer, or the local .venv."""
import os
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
def runtime(root=ROOT):
    selected=root/'.runtime-python'
    python=Path(selected.read_text().strip()) if selected.is_file() else root/('.venv/Scripts/python.exe' if os.name=='nt' else '.venv/bin/python')
    if not python.is_file() or '/tmp/' in str(python) or '/private/tmp/' in str(python):raise SystemExit('A persistent Midnight runtime is required. Run the release installer or set up .venv.')
    return python
if __name__=='__main__':
    python=runtime();subprocess.run([str(python),'-c','import fastapi,uvicorn,httpx,kasa,feedparser,icalendar,recurring_ical_events,trafilatura,PIL,pillow_heif,pypdfium2,reportlab,imageio_ffmpeg'],check=True)
    os.chdir(ROOT);os.execv(str(python),[str(python),'-u','server.py'])
