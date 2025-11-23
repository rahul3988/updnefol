# PowerShell script to ensure user-panel, backend, and admin-panel are always tracked
# Run this before committing: .\ensure-tracked.ps1

Write-Host "Checking and staging user-panel, backend, and admin-panel..." -ForegroundColor Cyan

# Check if directories exist
$dirs = @("user-panel", "backend", "admin-panel")
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "Staging $dir..." -ForegroundColor Green
        git add $dir
    } else {
        Write-Host "Warning: $dir not found!" -ForegroundColor Yellow
    }
}

Write-Host "Done! All directories are staged." -ForegroundColor Green
git status --short

