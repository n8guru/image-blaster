#!/bin/bash
# Local provider fork: do not ask the operator to paste provider secrets.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(dirname "$0")/../.."
echo 'image-blaster local fork: image edits -> Forage; 3D objects -> local TRELLIS.'
if [ ! -f .env ]; then
  echo 'Using local provider defaults. Copy .env.example to .env for configuration.'
fi
if [ ! -x "$HOME/.local/bin/forage-context" ]; then
  echo 'Forage connection bridge is missing; local image submission needs the installed bridge.'
fi
echo 'Environment splats still require a separate local scene backend or explicitly selected World Labs; SFX remains cloud-only. Do not call either stage automatically in a local-only blast.'
if [ -d worlds ]; then
  echo "Worlds: $(ls worlds/ 2>/dev/null | tr '\n' ' ')"
fi
