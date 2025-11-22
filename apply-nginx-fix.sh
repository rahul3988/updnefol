#!/bin/bash

# Quick script to apply nginx configuration fixes for image serving
# Server: 72.61.225.192

set -e

SERVER_IP="72.61.225.192"
SERVER_USER="root"
SERVER_PASS="Anoop2025@nefol"

echo "🔧 Applying nginx configuration fixes..."

# Function to run commands on remote server
run_remote() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$1"
}

# Function to copy files to remote server
copy_to_remote() {
    sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no "$1" "$SERVER_USER@$SERVER_IP:$2"
}

echo "📤 Step 1: Uploading updated nginx.conf..."
copy_to_remote "nginx.conf" "/etc/nginx/sites-available/thenefol.com"

echo "✅ Step 2: Testing nginx configuration..."
run_remote "nginx -t"

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    echo "🔄 Step 3: Reloading nginx..."
    run_remote "systemctl reload nginx"
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed! Not reloading."
    exit 1
fi

echo ""
echo "🔍 Step 4: Verifying IMAGES directory exists..."
run_remote "ls -la /var/www/nefol/user-panel/dist/IMAGES/ 2>/dev/null || echo 'IMAGES directory not found in user-panel/dist'"
run_remote "ls -la /var/www/nefol/backend/uploads/ 2>/dev/null || echo 'uploads directory not found in backend'"

echo ""
echo "🧪 Step 5: Testing image routes..."
echo "Testing /IMAGES/ route:"
run_remote "curl -I http://localhost/IMAGES/body.jpg 2>/dev/null | head -3 || echo 'Image not found (this is expected if file doesn\'t exist)'"

echo ""
echo "Testing /api/uploads/ route:"
run_remote "curl -I http://localhost/api/uploads/test.jpg 2>/dev/null | head -3 || echo 'Upload not found (this is expected if file doesn\'t exist)'"

echo ""
echo "✅ Nginx configuration fix applied!"
echo ""
echo "⚠️  IMPORTANT: You still need to fix the frontend code to use relative paths"
echo "   instead of hardcoded IP addresses (192.168.1.36:2000)"
echo ""
echo "   Search for: http://192.168.1.36:2000/IMAGES/"
echo "   Replace with: /IMAGES/"
echo ""

