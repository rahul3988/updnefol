# Admin Panel API URL Fix

## Problem
The admin panel was built with a hardcoded local development URL (`http://192.168.1.36:2000`) instead of the production URL (`https://thenefol.com/api`).

## Solution: Rebuild Admin Panel with Production URLs

### Step 1: Update Admin Panel Configuration

Before rebuilding, you need to update the API base URL in your admin panel source code.

**Find and update the API configuration file** (usually in `admin-panel/src/config.js` or similar):

```javascript
// Change from:
const API_BASE_URL = 'http://192.168.1.36:2000/api';
const WS_URL = 'ws://192.168.1.36:2000/socket.io';

// To:
const API_BASE_URL = 'https://thenefol.com/api';
const WS_URL = 'wss://thenefol.com/socket.io';
```

Or use environment variables:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://thenefol.com/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://thenefol.com/socket.io';
```

### Step 2: Update Content Security Policy

In your admin panel's `index.html`, update the CSP to allow `wss://`:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' blob: https://thenefol.com wss://thenefol.com ws: wss:; img-src 'self' data: blob: https: http:; media-src 'self' blob: data: http: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' 'unsafe-eval';">
```

### Step 3: Rebuild Admin Panel

```bash
cd admin-panel
npm run build
# or
yarn build
# or
pnpm build
```

### Step 4: Deploy Updated Build

```bash
# From your local machine
scp -r admin-panel/dist root@72.61.225.192:/var/www/nefol/admin-panel/

# On server
ssh root@72.61.225.192
chown -R www-data:www-data /var/www/nefol/admin-panel
chmod -R 755 /var/www/nefol/admin-panel
```

## Alternative: Quick Fix with Environment Variables

If your admin panel uses Vite or similar build tool, you can set environment variables:

**Create `.env.production` in admin-panel directory:**

```env
VITE_API_URL=https://thenefol.com/api
VITE_WS_URL=wss://thenefol.com/socket.io
```

Then rebuild:

```bash
cd admin-panel
npm run build
```

## Temporary Workaround (If Rebuild Not Possible)

If you can't rebuild immediately, you can try injecting a configuration override script. However, this only works if the admin panel checks for `window.API_BASE_URL` or similar.

Create a file `/var/www/nefol/admin-panel/dist/config-override.js`:

```javascript
// Override API configuration
window.API_BASE_URL = 'https://thenefol.com/api';
window.WS_URL = 'wss://thenefol.com/socket.io';
```

Then update the HTML to load this script before the main app:

```html
<script src="/admin/config-override.js"></script>
<script type="module" crossorigin src="/assets/index-CaqskcWD.js"></script>
```

**Note:** This only works if the admin panel code checks for these window variables. Most likely, you'll need to rebuild.

## Verify Fix

After rebuilding and deploying:

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to log in
4. Verify the login request goes to: `https://thenefol.com/api/auth/login`
5. Check Console tab - no more CSP or WebSocket errors

## Common Build Tools Configuration

### Vite
```javascript
// vite.config.js
export default {
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://thenefol.com/api'),
    'import.meta.env.VITE_WS_URL': JSON.stringify('wss://thenefol.com/socket.io')
  }
}
```

### Create React App
```javascript
// .env.production
REACT_APP_API_URL=https://thenefol.com/api
REACT_APP_WS_URL=wss://thenefol.com/socket.io
```

### Next.js
```javascript
// next.config.js
module.exports = {
  env: {
    NEXT_PUBLIC_API_URL: 'https://thenefol.com/api',
    NEXT_PUBLIC_WS_URL: 'wss://thenefol.com/socket.io'
  }
}
```

