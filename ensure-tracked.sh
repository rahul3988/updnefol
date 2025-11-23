#!/bin/bash
# Script to ensure user-panel, backend, and admin-panel are always tracked
# Run this before committing: ./ensure-tracked.sh

echo "Checking and staging user-panel, backend, and admin-panel..."

# Check if directories exist and stage them
for dir in user-panel backend admin-panel; do
    if [ -d "$dir" ]; then
        echo "Staging $dir..."
        git add "$dir"
    else
        echo "Warning: $dir not found!"
    fi
done

echo "Done! All directories are staged."
git status --short

