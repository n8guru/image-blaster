"""Submit an image through the promoted Forage boundary without exposing credentials."""
import json, os, runpy, sys, urllib.error
from pathlib import Path
try:
    bridge=runpy.run_path(str(Path.home()/'.local/bin/forage-context'))
    result=bridge['request']('POST','/v3/peer-generate-artifact',body=json.load(sys.stdin))
    print(json.dumps(result))
except urllib.error.HTTPError as exc:
    print(f'Forage HTTP {exc.code}: {exc.read().decode()[:350]}',file=sys.stderr)
    sys.exit(1)
except Exception as exc:
    print(type(exc).__name__ + ': check the installed Forage connection bridge',file=sys.stderr)
    sys.exit(1)
