# Workflow: Project Setup

## Objective
Get the full KomalFin development environment running locally.

## Prerequisites
- Node.js 24+ and npm
- Python 3.12+
- Git
- Expo CLI (`npm install -g expo-cli`)
- Supabase account with a project created

## Steps

### 1. Clone and Configure Environment
```bash
cd "c:/Users/Komal/Documents/YT Apps/FInance Apps"
cp .env.example .env
# Fill in real Supabase credentials in .env
```

### 2. Set Up Web App
```bash
cd web
npm install
npm run dev
# Verify: http://localhost:3000 loads
```

### 3. Set Up Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows Git Bash
pip install -r requirements.txt
python main.py
# Verify: http://localhost:8000/health returns {"status": "ok"}
```

### 4. Set Up Mobile App
```bash
cd mobile
npm install
npx expo start
# Scan QR code with Expo Go app on phone
```

### 5. Run Database Migrations
```bash
cd tools
python run_migration.py ../supabase/migrations/
# Or apply migrations via Supabase Dashboard SQL editor
```

### 6. Seed Development Data
```bash
python seed_data.py
```

## Verification
- [ ] Web app loads login page at localhost:3000
- [ ] Backend health check returns 200 at localhost:8000/health
- [ ] Expo dev server starts and connects to mobile device
- [ ] Database tables exist with RLS policies enabled

## Troubleshooting
- **npm install fails on Node 24**: Try `npm install --legacy-peer-deps`
- **Python venv activation on Windows**: Use `venv/Scripts/activate` (not `venv/bin/activate`)
- **CORS errors**: Check `CORS_ORIGINS` in `.env` includes the correct frontend URLs
