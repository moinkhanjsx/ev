# Multi-Platform Deployment Guide

## Current Setup
- **Frontend**: Vercel (`evhelper-rm37.vercel.app`)
- **Backend**: Render (`evhelper.onrender.com`)

## Environment Configuration

### Local Development (.env)
```
VITE_API_URL=http://localhost:5000/api
```
Frontend will use local backend on port 5000.

### Production (.env.production)
```
VITE_API_URL=https://evhelper.onrender.com/api
```
Frontend will use Render backend in production.

### Vercel Deployment (.env.vercel)
```
VITE_API_URL=https://evhelper.onrender.com/api
```
Vercel will use Render backend.

---

## Setup Instructions

### Step 1: Configure Vercel Environment Variables
In Vercel Dashboard → Settings → Environment Variables:
```
VITE_API_URL = https://evhelper.onrender.com/api
```

### Step 2: Update Backend CORS (Render)
In `server/src/app.js`, ensure CORS allows Vercel domain:
```javascript
cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://evhelper-rm37.vercel.app',
    'https://evhelper.onrender.com'
  ],
  credentials: true
})
```

### Step 3: Redeploy
1. Push changes to Git
2. Vercel will auto-redeploy frontend
3. Render will auto-redeploy backend (if connected to same repo)

---

## Testing

### Local Dev
```bash
npm install
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
```

### Production
- Frontend: https://evhelper-rm37.vercel.app
- Backend API: https://evhelper.onrender.com/api

---

## Alternative: Deploy Everything to One Platform

### Option A: Vercel (Frontend + Serverless API)
```
frontend/ → /
api/ → /api (serverless functions)
```

### Option B: Render (Frontend + Backend)
```
frontend/ → /public
backend/ → /api
Both on same domain
```

Currently, **Option 1** (Vercel + Render) is working well and is the most flexible.
