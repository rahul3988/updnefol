#!/bin/bash
# Script to resolve git conflict on server and get latest versions
# Run this on the server: bash resolve-server-conflict.sh

echo "Resolving git conflict and syncing with remote..."

# Step 1: Resolve the conflict by accepting remote version (file was deleted)
git rm admin-panel/dist/assets/index-CaqskcWD.js 2>/dev/null || true

# Step 2: Abort current merge to start fresh
git merge --abort 2>/dev/null || true

# Step 3: Reset to match remote exactly (this will get latest user-panel, backend, admin-panel)
echo "Resetting to remote main branch..."
git fetch origin
git reset --hard origin/main

# Step 4: Clean any untracked files
git clean -fd

echo "Done! Your repository is now synced with remote."
echo "Directories user-panel, backend, and admin-panel should now be up to date."
ls -la

