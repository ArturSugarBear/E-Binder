#!/usr/bin/env bash
# install-cline-skills.sh — installs the E-Binder Cline skill set.
#
# Copies the curated Cline skills into .cline/skills/ of the current project
# (default) or into ~/.cline/skills/ (--global). Idempotent: existing skills
# are kept unless --force is passed. The vendored skill files are NOT tracked
# in this repository (.cline/ is gitignored); run this script to (re)install.
#
# Sources (see each upstream repo for its license):
#   - impeccable  https://github.com/pbakaus/impeccable
#       "The design vocabulary for your coding agent." Steer (polish/bolder),
#       review (critique/audit), 62-rule AI-slop detector. We ship its Cline
#       skill: SKILL.md + reference playbooks + engine launcher scripts.
#   - motion      https://github.com/frankxai/awesome-motion-design-agent-skills
#       Plugin bundle "motion-design-studio" with five skills:
#       motion-director, site-motion-excellence-director, web-motion-auditor,
#       remotion-video-agent, generative-media-director.
#   - ponytail    https://github.com/vgzx64/ponytail-for-cline
#       "Lazy senior dev mode" — 6-rung ladder (YAGNI -> stdlib -> native ->
#       dependency -> one-liner -> minimal). Intensity: lite|full|ultra.
#   - ui-taste    https://github.com/milad-ahmd/ui-taste
#       Scores CSS/Tailwind (type scale, palette, 4px grid, radii, contrast,
#       AI-slop signals) and consolidates one-off values into design tokens.
#
# Usage:
#   bash scripts/install-cline-skills.sh            # project scope (this repo)
#   bash scripts/install-cline-skills.sh --global   # all projects on this machine
#   bash scripts/install-cline-skills.sh --force    # reinstall/replace existing
set -euo pipefail

SCOPE=project
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --global) SCOPE=global ;;
    --force) FORCE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$SCOPE" = "global" ]; then
  DEST="$HOME/.cline/skills"
else
  DEST="$(pwd)/.cline/skills"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# clone_copy <repo-url> <source-path-in-repo> <skill-name> [extra git args...]
clone_copy() {
  local repo="$1" src="$2" name="$3"; shift 3
  if [ -d "$DEST/$name" ] && [ "$FORCE" != "1" ]; then
    echo "skip  $name (already installed; pass --force to replace)"
    return 0
  fi
  git clone --depth 1 "$@" "$repo" "$TMP/$name" >/dev/null 2>&1
  mkdir -p "$DEST"
  rm -rf "$DEST/$name"
  cp -RL "$TMP/$name/$src" "$DEST/$name"
  echo "ok    $name -> $DEST/$name"
}

echo "Installing Cline skills into: $DEST"
echo

# 1) impeccable — design vocabulary skill (SKILL.md + reference + scripts)
clone_copy "https://github.com/pbakaus/impeccable.git" \
  ".claude/skills/impeccable" "impeccable"

# 2) motion bundle — the five motion-design skills
MOTION_REPO="https://github.com/frankxai/awesome-motion-design-agent-skills.git"
for skill in \
  motion-director \
  site-motion-excellence-director \
  web-motion-auditor \
  remotion-video-agent \
  generative-media-director; do
  clone_copy "$MOTION_REPO" "skills/$skill" "$skill"
done

# 3) ponytail — lazy senior dev skill (needs its vendored submodule content)
clone_copy "https://github.com/vgzx64/ponytail-for-cline.git" \
  ".cline/skills/ponytail" "ponytail" --recurse-submodules

# 4) ui-taste — CSS/token "taste" skill
clone_copy "https://github.com/milad-ahmd/ui-taste.git" \
  "skills/ui-taste" "ui-taste"

echo
echo "Done. Cline picks these up automatically (reload the Cline panel if open)."
echo "Skills installed:"
ls -1 "$DEST" | sed 's/^/  - /'
