#!/usr/bin/env bash
#
# Activates the CI workflow by moving it into .github/workflows/.
#
# WHY THIS SCRIPT EXISTS
# ----------------------
# The GitHub App token used to automate this repo does not hold the `workflows`
# permission, so it cannot create or update anything under .github/workflows/.
# Both routes are refused:
#
#   git push          -> "refusing to allow a GitHub App to create or update
#                        workflow `.github/workflows/ci.yml` without `workflows`
#                        permission"
#   Contents API PUT  -> 403 "Resource not accessible by integration"
#
# So the workflow is kept here, outside the protected path, and activated with
# whatever credential can write it: a token with `workflows` scope, or you, in
# the GitHub web UI.
#
# USAGE
# -----
#   ./ci/activate-ci.sh              # activates on the current branch
#   ./ci/activate-ci.sh main         # activates on a specific branch
#
# Requires: git, and either a `gh` login with the `workflows` scope or push
# access over SSH/HTTPS.

set -euo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
SRC="ci/github-actions-ci.yml"
DEST=".github/workflows/ci.yml"

if [ ! -f "$SRC" ]; then
  echo "error: $SRC not found. Run this from the repository root." >&2
  exit 1
fi

if git ls-files --error-unmatch "$DEST" >/dev/null 2>&1; then
  echo "Already active: $DEST is tracked on this branch. Nothing to do."
  exit 0
fi

echo "Activating CI on branch '$BRANCH'..."

git checkout "$BRANCH"
mkdir -p .github/workflows
git mv "$SRC" "$DEST" 2>/dev/null || { cp "$SRC" "$DEST" && git rm -q --cached "$SRC" 2>/dev/null || true; rm -f "$SRC"; }

git add "$DEST"
git commit -m "ci: activate the GitHub Actions workflow

Moves the workflow from ci/github-actions-ci.yml into .github/workflows/ci.yml,
which is the path GitHub reads. Runs typecheck -> test -> build on every push and
on pull requests targeting main.

Moved by ci/activate-ci.sh, which exists because the automating App token lacks
the workflows permission required to write to this path." 2>&1 | tail -3

echo
echo "Pushing to origin/$BRANCH ..."
if ! git push origin "$BRANCH"; then
  echo
  echo "Push refused. The credential in use lacks the 'workflows' scope." >&2
  echo "Run this instead from a machine logged in with that scope:" >&2
  echo "  gh auth refresh -s workflow" >&2
  echo "  git push origin $BRANCH" >&2
  exit 1
fi

echo
echo "Done. The workflow is now live."
echo "Watch it at: https://github.com/longsholdingsllc/neuropay-ai/actions"
