#!/usr/bin/env bash
set -euo pipefail

# ROCS CI profile wrapper
# Profiles:
#   - local-dev   : workspace refs resolved from the enclosing workspace (launcher default)
#   - branch-ci   : strict refs required
#   - main-strict : strict refs required (authoritative gate)

ROCS_CI_PROFILE="${ROCS_CI_PROFILE:-local-dev}"
ROCS_REPO="${ROCS_REPO:-.}"
ROCS_PROFILE="${ROCS_PROFILE:-}"
ROCS_CMD="${ROCS_CMD:-./scripts/rocs.sh}"
export ROCS_AUTHORITY_AGGREGATE=1

common_args=(--repo "$ROCS_REPO")
if [[ -n "$ROCS_PROFILE" ]]; then
  common_args+=(--profile "$ROCS_PROFILE")
fi

run_rocs() {
  # shellcheck disable=SC2086
  $ROCS_CMD "$@"
}

case "$ROCS_CI_PROFILE" in
  local-dev) ;;
  branch-ci)
    : "${ROCS_GITLAB_TIMEOUT_S:=30}"
    : "${ROCS_GITLAB_RETRIES:=3}"
    export ROCS_GITLAB_TIMEOUT_S ROCS_GITLAB_RETRIES
    ;;
  main-strict)
    : "${ROCS_GITLAB_TIMEOUT_S:=60}"
    : "${ROCS_GITLAB_RETRIES:=3}"
    export ROCS_GITLAB_TIMEOUT_S ROCS_GITLAB_RETRIES
    ;;
  *)
    echo "unknown ROCS_CI_PROFILE: $ROCS_CI_PROFILE (expected: local-dev|branch-ci|main-strict)" >&2
    exit 1
    ;;
esac

run_rocs version
# Managed ROCS gate: cleanup -> validate -> build (validate before build; never wipe ontology/dist first).
# ontology/dist is gitignored generated output; the sealed launcher resolves refs from the enclosing workspace.
rocs_ref_mode_args=""
case "$ROCS_CI_PROFILE" in
main-strict | branch-ci) rocs_ref_mode_args="--workspace-ref-mode strict" ;;
esac
run_rocs cleanup "${common_args[@]}"
# shellcheck disable=SC2086
run_rocs validate "${common_args[@]}" $rocs_ref_mode_args
# shellcheck disable=SC2086
run_rocs build "${common_args[@]}" $rocs_ref_mode_args
