#!/bin/bash

# Computes the next semantic version (X.Y.Z) from Conventional Commits
# messages since the last vX.Y.Z tag reachable from HEAD:
#   - any commit with a "!" before the ":" (e.g. "feat!:") or a
#     "BREAKING CHANGE" footer  -> bump MAJOR (breaking changes)
#   - any "feat:" commit         -> bump MINOR (new functionality)
#   - anything else (fix/chore/refactor/...) -> bump PATCH (small fixes)
# No matching tag yet -> starts from 0.0.0.
#
# Deterministic and side-effect-free (never creates a tag itself) — the
# same commit history always produces the same version number, so both
# .github/workflows/docker-publish.yml (CI, tags the result after computing
# it) and scripts/deploy.sh's local-build fallback (just reads it, no
# tagging) always agree on what a given commit's version is, regardless of
# which one runs first.

set -e

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

LAST_TAG="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1)"

if [ -z "$LAST_TAG" ]; then
  BASE="0.0.0"
  RANGE="$(git rev-list --max-parents=0 HEAD | tail -1)..HEAD"
else
  BASE="${LAST_TAG#v}"
  RANGE="$LAST_TAG..HEAD"
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE"

COMMITS="$(git log "$RANGE" --format='%s%n%b' 2>/dev/null || true)"

if [ -z "$COMMITS" ]; then
  echo "${MAJOR}.${MINOR}.${PATCH}"
  exit 0
fi

if echo "$COMMITS" | grep -qE '^[a-zA-Z]+(\([^)]*\))?!:' || echo "$COMMITS" | grep -q 'BREAKING CHANGE'; then
  MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0
elif echo "$COMMITS" | grep -qE '^feat(\([^)]*\))?:'; then
  MINOR=$((MINOR + 1)); PATCH=0
else
  PATCH=$((PATCH + 1))
fi

echo "${MAJOR}.${MINOR}.${PATCH}"
