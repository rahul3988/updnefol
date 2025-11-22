# Fix Image Serving Issues

## Problems Identified

1. **Mixed Content Errors**: Frontend trying to load images from `http://192.168.1.36:2000/IMAGES/...` (local IP, HTTP)
2. **404 Errors**: Images not found at `/IMAGES/` and `/api/uploads/`
3. **Favicon 503**: Favicon not being served

## Solutions Applied

### 1. Updated nginx.conf
- Added `/IMAGES/` location block to proxy to backend
- Added `/favicon.ico` location block
- Ensured proper CORS headers for images

### 2. Frontend Code Fix Needed

The frontend code is hardcoded to use `http://192.168.1.36:2000/IMAGES/...` which is a local development IP. This needs to be changed to use:

**Option A: Relative paths (Recommended)**
```javascript
// Instead of: http://192.168.1.36:2000/IMAGES/body.jpg
// Use: /IMAGES/body.jpg
```

**Option B: Use environment variable**
```javascript
// Use: ${process.env.REACT_APP_API_URL || ''}/IMAGES/body.jpg
// Or: ${import.meta.env.VITE_API_URL || ''}/IMAGES/body.jpg
```

## Deployment Steps

1. **Upload updated nginx.conf to server:**
```bash
scp nginx.conf root@72.61.225.192:/etc/nginx/sites-available/thenefol.com
```

2. **Test nginx configuration:**
```bash
ssh root@72.61.225.192 "nginx -t"
```

3. **Reload nginx:**
```bash
ssh root@72.61.225.192 "systemctl reload nginx"
```

4. **Verify IMAGES directory exists on backend:**
```bash
ssh root@72.61.225.192 "ls -la /var/www/nefol/user-panel/dist/IMAGES/"
ssh root@72.61.225.192 "ls -la /var/www/nefol/backend/uploads/"
```

5. **Test image serving:**
```bash
# Test IMAGES route
curl -I https://thenefol.com/IMAGES/body.jpg

# Test API uploads route
curl -I https://thenefol.com/api/uploads/test.jpg

# Test favicon
curl -I https://thenefol.com/favicon.ico
```

## Verify Backend is Serving Images

Check if backend is running and serving images:
```bash
ssh root@72.61.225.192 "pm2 logs nefol-backend --lines 50"
```

Look for:
- `Serving IMAGES from: /path/to/IMAGES`
- `Path exists: true`
- `Uploads directory exists: /path/to/uploads`

## Fix Frontend Code

You need to update your frontend code to use relative paths or the domain instead of the local IP:

1. **Search for hardcoded IP addresses:**
```bash
# In your frontend code, search for:
grep -r "192.168.1.36" admin-panel/src/
grep -r "192.168.1.36" user-panel/src/
```

2. **Replace with relative paths:**
```javascript
// Change from:
const imageUrl = `http://192.168.1.36:2000/IMAGES/${imageName}`;

// To:
const imageUrl = `/IMAGES/${imageName}`;
```

3. **Or use environment variable:**
```javascript
const API_URL = import.meta.env.VITE_API_URL || '';
const imageUrl = `${API_URL}/IMAGES/${imageName}`;
```

## After Fixes

1. Rebuild frontend with corrected image URLs
2. Redeploy frontend files
3. Clear browser cache
4. Test image loading

