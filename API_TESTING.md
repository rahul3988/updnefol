# API Testing Guide

## Quick API Status Check

### 1. Check API Root Endpoint
```bash
# From server
curl https://thenefol.com/api

# Expected response:
# {"status":"ok","message":"Nefol API is running","version":"1.0","endpoints":["/api/products","/api/auth/login","/api/users","/api/orders"]}
```

### 2. Check API Health (Backend Direct)
```bash
# From server - test backend directly
curl http://localhost:2000/api/products

# Or test health endpoint
curl http://localhost:2000/health
```

### 3. Test Products Endpoint
```bash
# Get all products
curl https://thenefol.com/api/products

# Get specific product by ID
curl https://thenefol.com/api/products/1

# Get product by slug
curl https://thenefol.com/api/products/slug/product-name
```

### 4. Test Authentication Endpoint
```bash
# Test login endpoint (POST request)
curl -X POST https://thenefol.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"info@nefol.in","password":"Anoop@2025$3"}'
```

### 5. Check Backend Status (PM2)
```bash
# Check if backend is running
pm2 status

# Check backend logs
pm2 logs nefol-backend --lines 50

# Check backend info
pm2 info nefol-backend
```

### 6. Test API from Browser
- Open browser and go to: `https://thenefol.com/api`
- Should see JSON response with API status

### 7. Test API with Browser DevTools
1. Open browser DevTools (F12)
2. Go to Network tab
3. Visit: `https://thenefol.com/api/products`
4. Check the response

### 8. Check Nginx Proxy
```bash
# Check if nginx is proxying correctly
curl -I https://thenefol.com/api/products

# Check nginx access logs
tail -f /var/log/nginx/nefol_access.log | grep "/api"
```

### 9. Test Database Connection
```bash
# SSH into server
ssh root@72.61.225.192

# Check if backend can connect to database
cd /var/www/nefol/backend
node -e "require('dotenv/config'); const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()').then(r => {console.log('DB OK:', r.rows[0]); pool.end();}).catch(e => {console.error('DB Error:', e.message); pool.end();});"
```

### 10. Common API Endpoints to Test

```bash
# Products
curl https://thenefol.com/api/products

# Users (may require auth)
curl https://thenefol.com/api/users

# Orders (may require auth)
curl https://thenefol.com/api/orders

# Cart (requires auth token)
curl https://thenefol.com/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### If API returns 502 Bad Gateway
```bash
# Check if backend is running
pm2 status

# Restart backend
pm2 restart nefol-backend

# Check backend logs
pm2 logs nefol-backend --lines 100
```

### If API returns 404
```bash
# Check nginx config
nginx -t

# Check if route exists in backend
grep -r "app.get.*'/api" /var/www/nefol/backend/dist/
```

### If API returns 500
```bash
# Check backend logs
pm2 logs nefol-backend --lines 100

# Check database connection
# (use the database test command above)
```

### Check Port 2000
```bash
# Check if port 2000 is listening
netstat -tulpn | grep 2000

# Or
ss -tulpn | grep 2000
```

## Quick Health Check Script

Save this as `check-api.sh`:

```bash
#!/bin/bash

echo "🔍 Checking API Status..."
echo ""

echo "1. API Root:"
curl -s https://thenefol.com/api | jq '.' || curl -s https://thenefol.com/api
echo ""

echo "2. Backend Direct:"
curl -s http://localhost:2000/api/products | head -c 200
echo ""

echo "3. PM2 Status:"
pm2 status
echo ""

echo "4. Port 2000:"
netstat -tulpn | grep 2000 || echo "Port 2000 not listening"
echo ""

echo "✅ Check complete!"
```

Make it executable and run:
```bash
chmod +x check-api.sh
./check-api.sh
```

