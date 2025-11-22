# Deployment Folder

This folder contains all deployment-related files for the Nefol application, including built files ready for deployment.

## Folder Structure

```
deployment/
├── backend/
│   ├── dist/              # Backend built files
│   ├── package.json       # Backend dependencies
│   ├── migrate.js         # Database migration script
│   └── env.example        # Environment variables template
├── admin-panel/
│   └── dist/              # Admin panel built files
├── user-panel/
│   └── dist/              # User panel built files
├── deploy.sh              # Bash deployment script (Linux/Mac/Git Bash)
├── deploy.ps1             # PowerShell deployment script (Windows)
├── ecosystem.config.js    # PM2 process manager configuration
├── nginx.conf             # Nginx web server configuration
└── DEPLOYMENT_INSTRUCTIONS.md  # Detailed manual deployment guide
```

## Quick Start

### Using PowerShell (Windows)
```powershell
cd deployment
.\deploy.ps1
```

### Using Bash (Linux/Mac/Git Bash)
```bash
cd deployment
bash deploy.sh
```

## Server Information

- **Server IP**: 72.61.225.192
- **Domain**: thenefol.com
- **User**: root
- **Deployment Path**: /var/www/nefol

## What the Scripts Do

1. ✅ Create deployment directories on server
2. ✅ Upload all built files (backend, admin-panel, user-panel)
3. ✅ Install and configure PostgreSQL database
4. ✅ Install Node.js dependencies
5. ✅ Set up PM2 process manager
6. ✅ Configure Nginx web server
7. ✅ Set up SSL certificates (Let's Encrypt)
8. ✅ Set proper permissions
9. ✅ Create environment file from template

## Important Notes

⚠️ **Before deploying:**
- All projects are already built and included in this folder
- Update `.env` file on server with production values after deployment
- Change database password from default
- Update JWT_SECRET and ENCRYPTION_KEY with secure random values

## Post-Deployment

After deployment, SSH to the server and:
1. Update `/var/www/nefol/backend/.env` with production values:
   ```bash
   ssh root@72.61.225.192
   nano /var/www/nefol/backend/.env
   ```
2. Generate secure secrets:
   ```bash
   openssl rand -base64 32  # For JWT_SECRET
   openssl rand -base64 32  # For ENCRYPTION_KEY
   ```
3. Check PM2 status: `pm2 status`
4. Check logs: `pm2 logs nefol-backend`
5. Verify application: `https://thenefol.com`

## Access URLs

- **User Panel**: https://thenefol.com
- **Admin Panel**: https://thenefol.com/admin
- **API**: https://thenefol.com/api
