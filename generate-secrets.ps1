# PowerShell script to generate secure JWT_SECRET and ENCRYPTION_KEY

Write-Host "Generating secure keys..." -ForegroundColor Green
Write-Host ""

# Generate JWT_SECRET
$jwtSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Generate ENCRYPTION_KEY
$encryptionKey = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

Write-Host "# Security Configuration" -ForegroundColor Cyan
Write-Host "JWT_SECRET=$jwtSecret" -ForegroundColor Yellow
Write-Host "ENCRYPTION_KEY=$encryptionKey" -ForegroundColor Yellow
Write-Host ""
Write-Host "Copy the above values to your .env file" -ForegroundColor Green

