# Git Workflow - Always Keep user-panel, backend, and admin-panel Updated

This repository is configured to ensure that `user-panel`, `backend`, and `admin-panel` directories are always tracked and updated when you push and pull.

## Automatic Tracking

The `.gitignore` file is configured to **always include** these directories:
- `user-panel/`
- `backend/`
- `admin-panel/`

## Manual Scripts (Optional)

If you want to manually ensure these directories are staged before committing:

### Windows (PowerShell)
```powershell
.\ensure-tracked.ps1
```

### Linux/Mac (Bash)
```bash
./ensure-tracked.sh
```

## Git Hooks

### Pre-commit Hook
A pre-commit hook automatically stages any changes in these directories if they're not already staged.

### Post-merge Hook
After pulling, the post-merge hook verifies these directories are present.

## Workflow

### When Pushing:
1. Make your changes
2. Run `git add .` (or use the ensure-tracked scripts)
3. Commit: `git commit -m "your message"`
4. Push: `git push`

The pre-commit hook will automatically ensure these directories are included.

### When Pulling:
1. Pull: `git pull`
2. The post-merge hook will verify the directories are present
3. All updates to user-panel, backend, and admin-panel will be automatically pulled

## Important Notes

- These directories are **never ignored** by `.gitignore`
- All changes in these directories will be tracked
- The `dist/` folders within these directories are also tracked
- `env.example` files are tracked, but `.env` files are ignored

## Troubleshooting

If these directories are not being tracked:
1. Check `.gitignore` - these directories should NOT be listed
2. Run: `git add user-panel/ backend/ admin-panel/`
3. Verify with: `git status`

