# Workflow: Deployment

## Objective
Deploy KomalFin web app, backend API, and mobile app to production.

## Web App (Vercel)

### First-time Setup
1. Connect GitHub repo to Vercel
2. Set root directory to `web/`
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Deploy
```bash
cd web
vercel --prod
```

### Verify
- Visit production URL
- Check login/signup works
- Verify data loads from Supabase

## Backend API (VPS)

### First-time Setup
1. SSH into VPS
2. Clone repo
3. Set up Python venv and install dependencies
4. Create systemd service for uvicorn
5. Configure nginx reverse proxy

### Deploy
```bash
ssh user@your-vps
cd /path/to/komalfin/backend
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart komalfin-api
```

### Verify
- `curl https://api.yourdomain.com/health`
- Check systemd logs: `journalctl -u komalfin-api -f`

## Mobile App (EAS Build)

### First-time Setup
```bash
cd mobile
npx eas build:configure
```

### Build Android APK
```bash
npx eas build --platform android --profile preview
```

### Build Production AAB
```bash
npx eas build --platform android --profile production
```

### Submit to Play Store
```bash
npx eas submit --platform android
```

## Database Migrations (Production)
- Always run migrations in Supabase Dashboard SQL Editor for production
- Never run `tools/run_migration.py` against production without review
- Back up data before destructive migrations

## Rollback
- **Web**: Revert in Vercel dashboard (instant rollback to previous deployment)
- **Backend**: `git revert` + redeploy
- **Mobile**: Previous build versions available in EAS dashboard
- **Database**: No automatic rollback — write reverse migration SQL
