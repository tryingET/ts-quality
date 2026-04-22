#!/usr/bin/env bash
set -euo pipefail

# ROCS CI profile wrapper
# Profiles:
#   - local-dev   : offline-first by default (refs optional)
#   - branch-ci   : strict refs required
#   - main-strict : strict refs required (authoritative gate)

ROCS_CI_PROFILE="${ROCS_CI_PROFILE:-local-dev}"
ROCS_REPO="${ROCS_REPO:-.}"
ROCS_PROFILE="${ROCS_PROFILE:-}"
ROCS_CMD="${ROCS_CMD:-./scripts/rocs.sh}"
workspace_root="${ROCS_WORKSPACE_ROOT:-$HOME/ai-society}"
workspace_ref_mode="${ROCS_WORKSPACE_REF_MODE:-loose}"
export ROCS_AUTHORITY_AGGREGATE=1
export ROCS_WORKSPACE_ROOT="$workspace_root"
export ROCS_WORKSPACE_REF_MODE="$workspace_ref_mode"

common_args=(--repo "$ROCS_REPO")
if [[ -n "$ROCS_PROFILE" ]]; then
  common_args+=(--profile "$ROCS_PROFILE")
fi

run_rocs() {
  # shellcheck disable=SC2086
  ROCS_WORKSPACE_ROOT="$workspace_root" ROCS_WORKSPACE_REF_MODE="$workspace_ref_mode" $ROCS_CMD "$@"
}

clean_dist() {
  rm -rf "$ROCS_REPO/ontology/dist"
}

strict_gate() {
  clean_dist
  run_rocs validate "${common_args[@]}" --resolve-refs
  run_rocs build "${common_args[@]}" --resolve-refs
}

case "$ROCS_CI_PROFILE" in
  local-dev)
    # Keep local loops fast/offline unless explicitly requested.
    clean_dist
    if [[ "${ROCS_LOCAL_RESOLVE_REFS:-0}" == "1" ]]; then
      run_rocs validate "${common_args[@]}" --resolve-refs
      run_rocs build "${common_args[@]}" --resolve-refs
    else
      run_rocs validate "${common_args[@]}"
      run_rocs build "${common_args[@]}"
    fi
    ;;

  branch-ci)
    : "${ROCS_GITLAB_TIMEOUT_S:=30}"
    : "${ROCS_GITLAB_RETRIES:=3}"
    export ROCS_GITLAB_TIMEOUT_S ROCS_GITLAB_RETRIES
    strict_gate
    ;;

  main-strict)
    : "${ROCS_GITLAB_TIMEOUT_S:=60}"
    : "${ROCS_GITLAB_RETRIES:=3}"
    export ROCS_GITLAB_TIMEOUT_S ROCS_GITLAB_RETRIES
    strict_gate
    ;;

  *)
    echo "unknown ROCS_CI_PROFILE: $ROCS_CI_PROFILE (expected: local-dev|branch-ci|main-strict)" >&2
    exit 1
    ;;
esac
