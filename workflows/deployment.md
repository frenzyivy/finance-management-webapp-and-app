# Workflow: Deployment (VPS + Supabase Cloud + APK)

## Objective
Deploy KomalFin to a self-hosted VPS with a custom domain, using Supabase Cloud for the database, and distribute the mobile app as an Android APK.

## Architecture

| Component | Where | URL |
|-----------|-------|-----|
| Web (Next.js) | VPS — PM2 + Nginx | `https://finance.allianzaai.com` |
| Backend (FastAPI) | VPS — systemd + Nginx | `https://api.finance.allianzaai.com` |
| Database | Supabase Cloud | — |
| Mobile | APK via EAS Build | sideloaded on Android |

**VPS:** `root@194.164.151.189` (Ubuntu)
**Repo:** `https://github.com/frenzyivy/finance-management-webapp-and-app`

---

## Secret Handling — READ FIRST

**NEVER commit `.env` files to git.** The root `.gitignore` blocks `.env`, `.env.*`, credentials, and keys.

Real secrets live in **three places only**:
1. Your local laptop (`.env`, `web/.env.local`, `mobile/.env`)
2. The VPS (`backend/.env`, `web/.env.production` — created by hand via `nano`, never via git)
3. Supabase dashboard (service role key, etc.)

Before every push run:
```bash
git status
git diff --cached | grep -iE "supabase.co|sk-ant-|eyJhbGc" && echo "STOP — secret detected" || echo "clean"
```

---

## PART 1 — DNS (do this first, propagation takes time)

At your domain registrar for `allianzaai.com`, add two A records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `finance` | `194.164.151.189` | 3600 |
| A | `api.finance` | `194.164.151.189` | 3600 |

Verify after 5–30 min:
```bash
nslookup finance.allianzaai.com
nslookup api.finance.allianzaai.com
```

---

## PART 2 — VPS Initial Setup

SSH in as root (first time only):
```bash
ssh root@194.164.151.189
```

Run on the VPS:
```bash
# System update
apt update && apt upgrade -y

# Create non-root user
adduser komal
usermod -aG sudo komal
rsync --archive --chown=komal:komal ~/.ssh /home/komal

# Essentials
apt install -y git curl ufw nginx python3.12 python3.12-venv python3-pip \
    certbot python3-certbot-nginx

# Node.js 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Switch to komal user
su - komal
```

---

## PART 3 — Deploy Code

### 3a. Clone the repo
```bash
cd ~
git clone https://github.com/frenzyivy/finance-management-webapp-and-app.git komalfin
cd komalfin
```

### 3b. Backend setup
```bash
cd ~/komalfin/backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3c. Backend `.env` (paste your real values)
```bash
nano ~/komalfin/backend/.env
```
```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=sk-ant-...
BACKEND_PORT=8000
JWT_SECRET=generate-a-long-random-string
CORS_ORIGINS=https://finance.allianzaai.com
```

Lock it down:
```bash
chmod 600 ~/komalfin/backend/.env
```

### 3d. systemd service for the API
```bash
sudo nano /etc/systemd/system/komalfin-api.service
```
```ini
[Unit]
Description=KomalFin FastAPI
After=network.target

[Service]
User=komal
WorkingDirectory=/home/komal/komalfin/backend
Environment="PATH=/home/komal/komalfin/backend/venv/bin"
EnvironmentFile=/home/komal/komalfin/backend/.env
ExecStart=/home/komal/komalfin/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now komalfin-api
sudo systemctl status komalfin-api
curl http://127.0.0.1:8000/health
```

### 3e. Web app build
```bash
cd ~/komalfin/web
npm install

nano ~/komalfin/web/.env.production
```
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=https://api.finance.allianzaai.com
```
```bash
chmod 600 ~/komalfin/web/.env.production
npm run build
pm2 start npm --name komalfin-web -- start
pm2 save
pm2 startup   # run the sudo command it prints
```

### 3f. Nginx — web site
```bash
sudo nano /etc/nginx/sites-available/finance.allianzaai.com
```
```nginx
server {
    listen 80;
    server_name finance.allianzaai.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3g. Nginx — API site
```bash
sudo nano /etc/nginx/sites-available/api.finance.allianzaai.com
```
```nginx
server {
    listen 80;
    server_name api.finance.allianzaai.com;
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/finance.allianzaai.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.finance.allianzaai.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 3h. SSL (free, auto-renewing)
```bash
sudo certbot --nginx -d finance.allianzaai.com -d api.finance.allianzaai.com
```
Choose option to redirect HTTP → HTTPS.

### 3i. Verify
- Browser: `https://finance.allianzaai.com` → web app
- Browser: `https://api.finance.allianzaai.com/health` → `{"status":"ok"}` JSON

---

## PART 4 — Mobile APK (Android)

On the local Windows machine:

```bash
cd mobile
```

Set the API URL in `mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_API_URL=https://api.finance.allianzaai.com
```

Build APK:
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

EAS returns a download link (~15 min). Transfer the APK to the Android phone and install (enable "install from unknown sources").

---

## Redeploy (after code changes)

On local:
```bash
git add <files>
git commit -m "..."
git push origin master
```

On VPS:
```bash
ssh komal@194.164.151.189
cd ~/komalfin
git pull

# Backend changed?
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart komalfin-api

# Web changed?
cd ~/komalfin/web
npm install
npm run build
pm2 restart komalfin-web
```

---

## Database Migrations
- Run production migrations in the Supabase Dashboard SQL Editor.
- Never run `tools/run_migration.py` against production without review.
- Back up before destructive changes.

---

## Rollback
- **Web:** `pm2 stop komalfin-web`, `git checkout <prev-commit>`, rebuild, `pm2 restart`.
- **Backend:** `git checkout <prev-commit>`, `sudo systemctl restart komalfin-api`.
- **Mobile:** Previous builds remain available in EAS dashboard.
- **Database:** No auto-rollback — write reverse migration SQL.

---

## Troubleshooting
- `sudo systemctl status komalfin-api` — backend health
- `sudo journalctl -u komalfin-api -f` — backend logs
- `pm2 logs komalfin-web` — web logs
- `sudo nginx -t` — nginx config check
- `sudo tail -f /var/log/nginx/error.log` — nginx errors
- `sudo certbot renew --dry-run` — test SSL renewal
