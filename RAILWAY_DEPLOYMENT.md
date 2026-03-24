# ==============================================
# GRACEFY - RAILWAY DEPLOYMENT GUIDE
# ==============================================
# This guide helps you deploy Gracefy with 
# horizontal scaling on Railway
# ==============================================

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository with your code
3. MongoDB Atlas cluster (you have this)
4. Upstash Redis (you have this)

---

## Quick Start (5 minutes)

### Step 1: Create Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your Gracefy repository
4. Railway will auto-detect the Dockerfile

### Step 2: Configure Services

You need TWO services:
- **Backend** (Python/FastAPI)
- **Frontend** (React/Nginx)

#### Create Backend Service:
1. Click "New Service" → "GitHub Repo"
2. Set root directory: `/backend`
3. Railway will use `backend/Dockerfile`

#### Create Frontend Service:
1. Click "New Service" → "GitHub Repo"  
2. Set root directory: `/frontend`
3. Railway will use `frontend/Dockerfile`

### Step 3: Set Environment Variables

#### Backend Environment Variables:
```
MONGO_URL=mongodb+srv://your-connection-string
DB_NAME=gracefy_db
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
JWT_SECRET=your-secret-key
FIREBASE_PROJECT_ID=your-project-id
BUNNY_API_KEY=your-bunny-key
BUNNY_STORAGE_ZONE=your-zone
BUNNY_CDN_URL=https://your-cdn.b-cdn.net
PORT=8001
```

#### Frontend Environment Variables:
```
REACT_APP_BACKEND_URL=https://your-backend.railway.app
```

### Step 4: Enable Horizontal Scaling

1. Go to Backend service → Settings
2. Find "Replicas" section
3. Set to 2-3 replicas for horizontal scaling
4. Enable "Health Checks" with path: `/api/health`

### Step 5: Configure Domain

1. Go to Settings → Domains
2. Add custom domain: `api.gracefy.net` for backend
3. Add custom domain: `gracefy.net` for frontend
4. Update DNS records as instructed

---

## Architecture on Railway

```
┌─────────────────────────────────────────────────────┐
│                    Railway Project                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           Frontend Service                   │   │
│  │  ┌─────────┐  ┌─────────┐                   │   │
│  │  │ React 1 │  │ React 2 │  (2 replicas)     │   │
│  │  └─────────┘  └─────────┘                   │   │
│  │         gracefy.net                         │   │
│  └─────────────────────────────────────────────┘   │
│                        │                           │
│                        ▼                           │
│  ┌─────────────────────────────────────────────┐   │
│  │           Backend Service                    │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐     │   │
│  │  │ API 1   │  │ API 2   │  │ API 3   │     │   │
│  │  └─────────┘  └─────────┘  └─────────┘     │   │
│  │         api.gracefy.net (3 replicas)        │   │
│  └─────────────────────────────────────────────┘   │
│                        │                           │
└────────────────────────┼───────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ MongoDB  │   │ Upstash  │   │ Bunny    │
   │ Atlas    │   │ Redis    │   │ CDN      │
   └──────────┘   └──────────┘   └──────────┘
```

---

## Scaling Commands

### Scale via Railway CLI:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Scale backend to 5 replicas
railway service backend replicas 5
```

### Scale via Dashboard:
1. Go to Backend service
2. Settings → Scaling
3. Adjust replica count

---

## Cost Estimation

| Replicas | Backend | Frontend | Total/Month |
|----------|---------|----------|-------------|
| 1 each   | $5      | $5       | ~$10        |
| 2 each   | $10     | $10      | ~$20        |
| 3 backend, 2 frontend | $15 | $10 | ~$25   |
| 5 backend, 2 frontend | $25 | $10 | ~$35   |

Plus:
- MongoDB Atlas M10: $57/mo (recommended for scaling)
- Upstash Pro: $10/mo (recommended for scaling)

---

## Health Checks

Backend health endpoint: `GET /api/health`

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "cache": "connected"
  }
}
```

---

## Monitoring

Railway provides built-in monitoring:
- CPU usage per replica
- Memory usage per replica
- Request count
- Response times
- Error rates

Access via: Dashboard → Service → Metrics

---

## Troubleshooting

### Common Issues:

1. **Build fails**: Check Dockerfile syntax
2. **Health check fails**: Ensure `/api/health` returns 200
3. **Database connection fails**: Check MONGO_URL env var
4. **Redis connection fails**: Check Upstash credentials

### View Logs:
```bash
railway logs -f
```

### Restart Service:
```bash
railway restart
```

---

## Production Checklist

- [ ] Set all environment variables
- [ ] Enable health checks
- [ ] Configure custom domains
- [ ] Set up SSL (automatic on Railway)
- [ ] Enable horizontal scaling (2+ replicas)
- [ ] Test failover (kill one replica)
- [ ] Set up monitoring alerts
- [ ] Configure backup strategy for MongoDB

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Gracefy Issues: Contact developer

