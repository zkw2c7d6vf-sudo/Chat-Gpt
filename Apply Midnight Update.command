#!/bin/zsh
set -eu
cd "${0:A:h}"
midnight_target="${1:-}"
if [[ -z "$midnight_target" ]]; then
  read 'midnight_target?Existing Midnight installation folder: '
fi
if [[ ! -x "$midnight_target/.venv/bin/python" ]]; then
  print 'Choose the existing Midnight folder with its .venv installation.'
  exit 1
fi
print 'Checking the release, then restarting Midnight with rollback protection.'
"$midnight_target/.venv/bin/python" scripts/apply_upgrade.py --target "$midnight_target" --restart
read '?Press Return to close.'
