#!/usr/bin/env bash
# install-opencode-skills.sh — mirrors the curated Cline skills into OpenCode.
#
# Cline and OpenCode both read a directory of `<skill>/SKILL.md` folders, so the
# skills installed by scripts/install-cline-skills.sh can be copied as-is.
# Run the Cline installer first (npm run skills:install does both).
#
# Usage:
#   bash scripts/install-opencode-skills.sh            # project: .opencode/skills
#   bash scripts/install-opencode-skills.sh --global   # all projects: ~/.config/opencode/skills
set -euo pipefail

SCOPE=project
for arg in "$@"; do
  case "$arg" in
    --global) SCOPE=global ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$SCOPE" = "global" ]; then
  SRC="$HOME/.cline/skills"
  DEST="$HOME/.config/opencode/skills"
else
  SRC="$(pwd)/.cline/skills"
  DEST="$(pwd)/.opencode/skills"
fi

if [ ! -d "$SRC" ]; then
  echo "No Cline skills found at: $SRC" >&2
  echo "Run scripts/install-cline-skills.sh first." >&2
  exit 1
fi

mkdir -p "$DEST"
installed=0

for dir in "$SRC"/*/; do
  [ -f "$dir/SKILL.md" ] || continue
  name="$(basename "$dir")"
  rm -rf "$DEST/$name"
  cp -a "$dir" "$DEST/$name"
  echo "ok    $name -> $DEST/$name"
  installed=$((installed + 1))
done

if [ "$installed" -eq 0 ]; then
  echo "No SKILL.md folders found in: $SRC" >&2
  exit 1
fi

echo
echo "Done. OpenCode reloads skills automatically."
echo "Copied $installed skills into: $DEST"
