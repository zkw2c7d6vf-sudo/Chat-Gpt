@echo off
setlocal
cd /d "%~dp0"
if exist ".runtime-python" goto :selected_runtime
py -3.11 --version >nul 2>&1
if errorlevel 1 (
  echo Python 3.11 is required. Install it from https://www.python.org/downloads/windows/
  echo Enable the Python launcher during installation, then run this file again.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv
  if errorlevel 1 goto :failed
  .venv\Scripts\python.exe -m pip install --require-hashes -r requirements.lock
  if errorlevel 1 goto :failed
)
.venv\Scripts\python.exe -c "import fastapi, uvicorn, httpx, kasa, feedparser, icalendar, recurring_ical_events, trafilatura, PIL, pillow_heif, pypdfium2, reportlab, imageio_ffmpeg" >nul 2>&1
if errorlevel 1 (
  .venv\Scripts\python.exe -m pip install --require-hashes -r requirements.lock
  if errorlevel 1 goto :failed
)
set "midnight_python=%CD%\.venv\Scripts\python.exe"
.venv\Scripts\python.exe scripts\fetch_assets.py
if errorlevel 1 echo Background downloads unavailable. Saved still images remain available.
:run
echo Midnight Dashboard - keep this window open. Press Ctrl+C to stop.
echo Open http://127.0.0.1:8765 in Edge or Chrome.
start "" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Open Dashboard.ps1"
"%midnight_python%" scripts\start.py
if errorlevel 1 goto :failed
exit /b 0
:failed
echo Setup or startup failed. See the message above. Check Python, internet, or port 8765.
pause
exit /b 1

:selected_runtime
set /p midnight_python=<.runtime-python
goto :run
