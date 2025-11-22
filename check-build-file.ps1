# PowerShell script to check if build file index-XxnLyRCS.js is available on the server
# Server: 72.61.225.192

$ErrorActionPreference = "Continue"

$SERVER_IP = "72.61.225.192"
$SERVER_USER = "root"
$SERVER_PASS = "Anoop2025@nefol"
$BUILD_FILE = "index-XxnLyRCS.js"

Write-Host "🔍 Checking if $BUILD_FILE is available on the server..." -ForegroundColor Yellow
Write-Host ""

# Function to run commands on remote server
function Invoke-RemoteCommand {
    param([string]$Command)
    $escapedCommand = $Command -replace '"', '\"'
    $sshCommand = "sshpass -p '$SERVER_PASS' ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP `"$escapedCommand`""
    & bash -c $sshCommand
}

Write-Host "1️⃣ Checking if file exists on server..." -ForegroundColor Yellow
$checkCommand = @"
    echo "Checking in user-panel (root):"
    ls -lh /var/www/nefol/user-panel/dist/assets/$BUILD_FILE 2>/dev/null && echo "✅ Found in user-panel" || echo "❌ Not found in user-panel"
    
    echo ""
    echo "Checking in admin-panel:"
    ls -lh /var/www/nefol/admin-panel/dist/assets/$BUILD_FILE 2>/dev/null && echo "✅ Found in admin-panel" || echo "❌ Not found in admin-panel"
    
    echo ""
    echo "All JS files in user-panel/dist/assets:"
    ls -lh /var/www/nefol/user-panel/dist/assets/*.js 2>/dev/null | head -10 || echo "No JS files found"
    
    echo ""
    echo "All JS files in admin-panel/dist/assets:"
    ls -lh /var/www/nefol/admin-panel/dist/assets/*.js 2>/dev/null | head -10 || echo "No JS files found"
"@

Invoke-RemoteCommand $checkCommand

Write-Host ""
Write-Host "2️⃣ Testing HTTP accessibility..." -ForegroundColor Yellow
Write-Host "Testing user-panel (root):" -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "https://thenefol.com/assets/$BUILD_FILE" -Method Head -SkipCertificateCheck -ErrorAction SilentlyContinue
    Write-Host "✅ File is accessible via HTTP (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Not accessible via HTTP" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing admin-panel:" -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "https://thenefol.com/admin/assets/$BUILD_FILE" -Method Head -SkipCertificateCheck -ErrorAction SilentlyContinue
    Write-Host "✅ File is accessible via HTTP (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Not accessible via HTTP" -ForegroundColor Red
}

Write-Host ""
Write-Host "3️⃣ Checking what index.html references:" -ForegroundColor Yellow
$htmlCheckCommand = @"
    echo "User panel index.html:"
    grep -o 'src="[^"]*\.js"' /var/www/nefol/user-panel/dist/index.html 2>/dev/null || echo "No JS files found in index.html"
    
    echo ""
    echo "Admin panel index.html:"
    grep -o 'src="[^"]*\.js"' /var/www/nefol/admin-panel/dist/index.html 2>/dev/null || echo "No JS files found in index.html"
"@

Invoke-RemoteCommand $htmlCheckCommand

Write-Host ""
Write-Host "✅ Check complete!" -ForegroundColor Green

