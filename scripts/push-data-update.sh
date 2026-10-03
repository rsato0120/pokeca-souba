#!/usr/bin/env bash
set -euo pipefail

branch="${1:?branch is required}"
# Separate data jobs write different files, but their pushes may finish together.
for attempt in 1 2 3; do
  git pull --rebase origin "$branch"
  if git push origin "HEAD:$branch"; then
    exit 0
  fi
  if [ "$attempt" -lt 3 ]; then
    sleep 2
  fi
done
echo "::error::Could not publish the acquired data after three push attempts."
exit 1
