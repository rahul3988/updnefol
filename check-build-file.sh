#!/bin/bash

# Script to check if build file index-XxnLyRCS.js is available on the server
# Server: 72.61.225.192

SERVER_IP="72.61.225.192"
SERVER_USER="root"
SERVER_PASS="Anoop2025@nefol"
BUILD_FILE="index-XxnLyRCS.js"

echo "🔍 Checking if $BUILD_FILE is available on the server..."
echo ""

# Check if file exists on server
echo "1️⃣ Checking if file exists on server..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'EOF'
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
EOF

echo ""
echo "2️⃣ Testing HTTP accessibility..."
echo "Testing user-panel (root):"
curl -I -k "https://thenefol.com/assets/$BUILD_FILE" 2>/dev/null | head -5 || echo "❌ Not accessible via HTTP"

echo ""
echo "Testing admin-panel:"
curl -I -k "https://thenefol.com/admin/assets/$BUILD_FILE" 2>/dev/null | head -5 || echo "❌ Not accessible via HTTP"

echo ""
echo "3️⃣ Checking what index.html references:"
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'EOF'
    echo "User panel index.html:"
    grep -o 'src="[^"]*\.js"' /var/www/nefol/user-panel/dist/index.html 2>/dev/null || echo "No JS files found in index.html"
    
    echo ""
    echo "Admin panel index.html:"
    grep -o 'src="[^"]*\.js"' /var/www/nefol/admin-panel/dist/index.html 2>/dev/null || echo "No JS files found in index.html"
EOF

echo ""
echo "✅ Check complete!"

