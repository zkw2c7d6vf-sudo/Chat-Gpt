#!/bin/zsh
set -eu
cd "${0:A:h}"
if [[ ! -x .venv/bin/python ]]; then
  if command -v uv >/dev/null 2>&1; then
    uv venv --python 3.11 .venv
  elif command -v python3.11 >/dev/null 2>&1; then
    python3.11 -m venv .venv
  else
    print 'Install Python 3.11 from https://www.python.org/downloads/macos/ and run this launcher again.'
    read '?Press Return to close.'
    exit 1
  fi
fi
if ! .venv/bin/python -c 'import fastapi, uvicorn, httpx, kasa, feedparser, icalendar, recurring_ical_events, trafilatura' >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python .venv/bin/python -r requirements.txt
  else
    .venv/bin/python -m pip install -r requirements.txt
  fi
fi
if ! .venv/bin/python scripts/fetch_assets.py; then
  print 'Background downloads are unavailable. Midnight will use its saved still images.'
fi
print 'Midnight Dashboard: http://127.0.0.1:8765/app'
print 'Keep this window open. Press Control+C to stop.'
(
  for attempt in {1..30}; do
    if /usr/bin/curl -fs --max-time 1 http://127.0.0.1:8765/app >/dev/null 2>&1; then
      /usr/bin/open http://127.0.0.1:8765/app
      exit 0
    fi
    sleep 1
  done
) &
opener=$!
trap 'kill "$opener" 2>/dev/null || true' EXIT
.venv/bin/python server.py
