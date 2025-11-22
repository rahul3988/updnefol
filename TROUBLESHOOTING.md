# Troubleshooting Guide

## Issue 1: API Returns "Cannot GET /api/"

### Solution:
The updated `nginx.conf` now includes a handler for `/api` that returns API information. 

**Steps to fix:**
1. Upload the updated `nginx.conf` to the server:
   ```bash
   scp nginx.conf root@72.61.225.192:/var/www/nefol/
   ```

2. SSH into the server:
   ```bash
   ssh root@72.61.225.192
   ```

3. Copy the nginx config and test it:
   ```bash
   cp /var/www/nefol/nginx.conf /etc/nginx/sites-available/thenefol.com
   nginx -t
   ```

4. If test passes, reload nginx:
   ```bash
   systemctl reload nginx
   ```

5. Test the API:
   ```bash
   curl https://thenefol.com/api
   # Should return: {"status":"ok","message":"Nefol API is running",...}
   ```

---

## Issue 2: Admin Panel Shows User Panel

### Solution:
The nginx config has been updated to properly route `/admin` requests. You also need to verify the admin panel files are deployed.

**Steps to fix:**

1. **Check if admin panel files exist:**
   ```bash
   ssh root@72.61.225.192
   ls -la /var/www/nefol/admin-panel/dist/
   ```

2. **If files don't exist, deploy them:**
   ```bash
   # From your local machine
   scp -r admin-panel/dist root@72.61.225.192:/var/www/nefol/admin-panel/
   ```

3. **Update nginx config (if not done already):**
   ```bash
   # On server
   cp /var/www/nefol/nginx.conf /etc/nginx/sites-available/thenefol.com
   nginx -t
   systemctl reload nginx
   ```

4. **Verify admin panel files have correct permissions:**
   ```bash
   chown -R www-data:www-data /var/www/nefol/admin-panel
   chmod -R 755 /var/www/nefol/admin-panel
   ```

5. **Test admin panel:**
   ```bash
   curl -I https://thenefol.com/admin
   # Should return 200 OK
   ```

---

## Additional Checks

### Check if Backend is Running:
```bash
ssh root@72.61.225.192
pm2 status
pm2 logs nefol-backend --lines 50
```

### Check if Backend is Accessible:
```bash
curl http://localhost:2000/api/products
# Should return product data or error message
```

### Check Nginx Error Logs:
```bash
tail -f /var/log/nginx/nefol_error.log
```

### Check Nginx Access Logs:
```bash
tail -f /var/log/nginx/nefol_access.log
```

### Restart Services if Needed:
```bash
# Restart backend
pm2 restart nefol-backend

# Restart nginx
systemctl restart nginx
```

---

## Quick Fix Commands (Run on Server)

```bash
# 1. Update nginx config
cp /var/www/nefol/nginx.conf /etc/nginx/sites-available/thenefol.com
nginx -t && systemctl reload nginx

# 2. Check admin panel files
ls -la /var/www/nefol/admin-panel/dist/

# 3. Fix permissions
chown -R www-data:www-data /var/www/nefol
chmod -R 755 /var/www/nefol

# 4. Check backend status
pm2 status
pm2 logs nefol-backend --lines 20

# 5. Test endpoints
curl https://thenefol.com/api
curl -I https://thenefol.com/admin
```

---

## Expected Results After Fix

✅ **https://thenefol.com/api** → Returns JSON with API status  
✅ **https://thenefol.com/api/products** → Returns product data  
✅ **https://thenefol.com/admin** → Shows admin panel login page  
✅ **https://thenefol.com** → Shows user panel  

