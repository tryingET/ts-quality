#!/usr/bin/env sh
# ROCS launcher: runs the workspace rocs-cli core checkout pinned by this repo.
#
# - Pin: rocs_cli_pin (copier answer `rocs_cli_version`). The core checkout must
#   report the same major.minor and a patch >= the pin; anything else exits 2.
# - Core: ROCS_CORE_PROJECT (default: $HOME/ai-society/core/rocs-cli), run via
#   `uv run --frozen --project <core>` (the core pins its Python via .python-version).
# - Workspace: when ROCS_WORKSPACE_ROOT is unset it defaults to the nearest
#   ancestor of the repo that contains every <repo:PATH@ref> layer named by the
#   ontology manifest (else $HOME/ai-society); ROCS_RESOLVE_REFS defaults to 1,
#   so plain `./scripts/rocs.sh validate --repo .` checks every layer.
# No ephemeral-tool, PATH, or vendored fallbacks.
set -eu

rocs_cli_pin="0.4.4"

repo="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
core="${ROCS_CORE_PROJECT:-$HOME/ai-society/core/rocs-cli}"

err() {
  printf '%s\n' "$*" >&2
}

fail_setup() {
  err "error: $*"
  exit 2
}

usage() {
  cat <<'EOF'
usage: scripts/rocs.sh [--doctor|--help] [rocs args...]

Runs the pinned workspace rocs-cli core checkout:
  uv run --frozen --project "${ROCS_CORE_PROJECT:-$HOME/ai-society/core/rocs-cli}" python -m rocs_cli <args>

Examples:
  ./scripts/rocs.sh --doctor
  ./scripts/rocs.sh validate --repo .
  ./scripts/rocs.sh build --repo .
EOF
}

core_version() {
  sed -n 's/^[[:space:]]*version[[:space:]]*=[[:space:]]*["'\'']\([^"'\'']*\)["'\''].*/\1/p' "$core/pyproject.toml" 2>/dev/null | head -n 1
}

# 0 when $1 (core) is compatible with $2 (pin): same major.minor, patch >= pin.
version_compatible() {
  have="$1"
  want="$2"
  for candidate in "$have" "$want"; do
    case "$candidate" in
      *.*.*.* | *[!0-9.]* | '') return 1 ;;
      *.*.*) ;;
      *) return 1 ;;
    esac
  done
  have_major="${have%%.*}"
  have_rest="${have#*.}"
  have_minor="${have_rest%%.*}"
  have_patch="${have_rest#*.}"
  want_major="${want%%.*}"
  want_rest="${want#*.}"
  want_minor="${want_rest%%.*}"
  want_patch="${want_rest#*.}"
  for part in "$have_major" "$have_minor" "$have_patch" "$want_major" "$want_minor" "$want_patch"; do
    case "$part" in
      '' | *[!0-9]*) return 1 ;;
    esac
  done
  [ "$have_major" -eq "$want_major" ] && [ "$have_minor" -eq "$want_minor" ] && [ "$have_patch" -ge "$want_patch" ]
}

require_core() {
  if [ ! -f "$core/pyproject.toml" ] || [ ! -d "$core/src/rocs_cli" ]; then
    fail_setup "rocs-cli core checkout not found at $core (pin $rocs_cli_pin). Clone ai-society/core/rocs-cli there, or set ROCS_CORE_PROJECT to a rocs-cli $rocs_cli_pin checkout."
  fi
  version="$(core_version)"
  if [ -z "$version" ]; then
    fail_setup "cannot read the rocs-cli version from $core/pyproject.toml (pin $rocs_cli_pin)."
  fi
  if ! version_compatible "$version" "$rocs_cli_pin"; then
    fail_setup "rocs-cli core at $core is $version but this repo pins $rocs_cli_pin (accepts ${rocs_cli_pin%.*}.x with patch >= ${rocs_cli_pin##*.}). Update the core checkout to $rocs_cli_pin or newer within ${rocs_cli_pin%.*}.x, or re-render with a matching rocs_cli_version."
  fi
  command -v uv >/dev/null 2>&1 || fail_setup "uv is required to run the rocs-cli core checkout at $core."
}

# Workspace default (mirrors rocs-cli >= 0.4.3 verified_runtime._GENERIC_WORKSPACE_DEFAULT,
# falling back to $HOME/ai-society instead of the repo).
if [ -z "${ROCS_WORKSPACE_ROOT:-}" ]; then
  ROCS_WORKSPACE_ROOT="$HOME/ai-society"
  refs="$(sed -n 's/.*<repo:\([^@>]*\)@.*/\1/p' "$repo/ontology/manifest.yaml" "$repo/manifest.yaml" 2>/dev/null || true)"
  if [ -n "$refs" ]; then
    ws="$(dirname -- "$repo")"
    while :; do
      found=1
      for ref in $refs; do
        if [ ! -d "$ws/$ref" ] && [ ! -d "$ws/${ref#*/}" ]; then
          found=0
          break
        fi
      done
      if [ "$found" = 1 ]; then
        ROCS_WORKSPACE_ROOT="$ws"
        break
      fi
      [ "$ws" = / ] && break
      ws="$(dirname -- "$ws")"
    done
  fi
fi
export ROCS_WORKSPACE_ROOT
ROCS_RESOLVE_REFS="${ROCS_RESOLVE_REFS:-1}"
export ROCS_RESOLVE_REFS

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
  --doctor)
    printf 'repo: %s\n' "$repo"
    printf 'core: %s\n' "$core"
    printf 'core version: %s\n' "$(core_version || true)"
    printf 'pin: %s\n' "$rocs_cli_pin"
    printf 'workspace root: %s\n' "$ROCS_WORKSPACE_ROOT"
    printf 'resolve refs: %s\n' "$ROCS_RESOLVE_REFS"
    require_core
    printf 'ok: rocs-cli %s satisfies pin %s\n' "$version" "$rocs_cli_pin"
    exit 0
    ;;
esac

require_core
exec uv run --frozen --project "$core" python -m rocs_cli "$@"
