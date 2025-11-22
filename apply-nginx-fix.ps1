# PowerShell script to apply nginx configuration fixes for image serving
# Server: 72.61.225.192

$ErrorActionPreference = "Stop"

$SERVER_IP = "72.61.225.192"
$SERVER_USER = "root"
$SERVER_PASS = "Anoop2025@nefol"

Write-Host "🔧 Applying nginx configuration fixes..." -ForegroundColor Yellow

# Function to run commands on remote server
function Invoke-RemoteCommand {
    param([string]$Command)
    $escapedCommand = $Command -replace '"', '\"'
    $sshCommand = "sshpass -p '$SERVER_PASS' ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP `"$escapedCommand`""
    & bash -c $sshCommand
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Command failed, but continuing..."
    }
}

# Function to copy files to remote server
function Copy-ToRemote {
    param([string]$LocalPath, [string]$RemotePath)
    $scpCommand = "sshpass -p '$SERVER_PASS' scp -o StrictHostKeyChecking=no '$LocalPath' $SERVER_USER@$SERVER_IP`:$RemotePath"
    Write-Host "Copying: $LocalPath -> $RemotePath" -ForegroundColor Gray
    & bash -c $scpCommand
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Copy failed, but continuing..."
    }
}

Write-Host "📤 Step 1: Uploading updated nginx.conf..." -ForegroundColor Yellow
Copy-ToRemote "nginx.conf" "/etc/nginx/sites-available/thenefol.com"

Write-Host "✅ Step 2: Testing nginx configuration..." -ForegroundColor Yellow
$testResult = Invoke-RemoteCommand "nginx -t"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Nginx configuration is valid" -ForegroundColor Green
    Write-Host "🔄 Step 3: Reloading nginx..." -ForegroundColor Yellow
    Invoke-RemoteCommand "systemctl reload nginx"
    Write-Host "✅ Nginx reloaded successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Nginx configuration test failed! Not reloading." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Step 4: Verifying IMAGES directory exists..." -ForegroundColor Yellow
Invoke-RemoteCommand "ls -la /var/www/nefol/user-panel/dist/IMAGES/ 2>/dev/null || echo 'IMAGES directory not found in user-panel/dist'"
Invoke-RemoteCommand "ls -la /var/www/nefol/backend/uploads/ 2>/dev/null || echo 'uploads directory not found in backend'"

Write-Host ""
Write-Host "🧪 Step 5: Testing image routes..." -ForegroundColor Yellow
Write-Host "Testing /IMAGES/ route:" -ForegroundColor Gray
Invoke-RemoteCommand "curl -I http://localhost/IMAGES/body.jpg 2>/dev/null | head -3 || echo 'Image not found (this is expected if file does not exist)'"

Write-Host ""
Write-Host "Testing /api/uploads/ route:" -ForegroundColor Gray
Invoke-RemoteCommand "curl -I http://localhost/api/uploads/test.jpg 2>/dev/null | head -3 || echo 'Upload not found (this is expected if file does not exist)'"

Write-Host ""
Write-Host "✅ Nginx configuration fix applied!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: You still need to fix the frontend code to use relative paths" -ForegroundColor Yellow
Write-Host "   instead of hardcoded IP addresses (192.168.1.36:2000)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Search for: http://192.168.1.36:2000/IMAGES/" -ForegroundColor Gray
Write-Host "   Replace with: /IMAGES/" -ForegroundColor Gray
Write-Host ""

