# Gracefy Production Deployment Guide

## Auto-Scaling Features Implemented

### 1. Traffic Monitoring
The system automatically monitors traffic and adjusts settings:
- **Low traffic** (<50 req/s): Normal cache TTL
- **Medium traffic** (50-150 req/s): 1.5x cache TTL
- **High traffic** (150-300 req/s): 2.5x cache TTL  
- **Critical traffic** (>300 req/s): 4x cache TTL

### 2. Adaptive Cache
Cache TTL automatically increases during high traffic to reduce database load:
- Home screen: 60s → 240s (during critical)
- Albums: 120s → 480s (during critical)
- Categories: 600s → 2400s (during critical)

### 3. Monitoring Endpoints
- `GET /api/admin/traffic` - Real-time traffic stats
- `GET /api/admin/auto-scaling` - Auto-scaling status & recommendations
- `GET /api/admin/cache/stats` - Cache hit rates and stats

---

## Production Deployment Steps

### Step 1: Update Uvicorn Workers (4x capacity)

In your production server's supervisor config, change:
```ini
# FROM:
command=uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1

# TO:
command=uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

This gives you 4x the request handling capacity.

### Step 2: Environment Variables

Add to your production `.env`:
```bash
# Performance tuning
MONGO_POOL_SIZE=100
MAX_CACHE_ENTRIES=15000

# Rate limiting (adjust based on your needs)
RATE_LIMIT_PER_MINUTE=500
```

### Step 3: MongoDB Indexes

Run the index creation script on production:
```bash
cd /app/backend
python create_indexes.py
```

This creates 175 indexes for optimal query performance.

### Step 4: Verify Deployment

After deploying, check:
```bash
# Check traffic stats
curl https://your-domain.com/api/admin/traffic

# Check auto-scaling status
curl https://your-domain.com/api/admin/auto-scaling
```

---

## Capacity Estimates

| Configuration | Concurrent Users | Requests/sec |
|--------------|------------------|--------------|
| 1 Worker (current) | 500-1,500 | ~300 |
| 4 Workers (recommended) | 2,000-6,000 | ~1,200 |
| 4 Workers + Redis | 5,000-15,000 | ~2,000 |

---

## Scaling for 15,000+ Users

If you need more capacity:

### Option A: More Workers
```ini
command=uvicorn server:app --host 0.0.0.0 --port 8001 --workers 8
```

### Option B: Add Redis Cache
1. Install Redis on your server
2. Update `.env`:
   ```
   REDIS_URL=redis://localhost:6379
   ```
3. Restart backend

### Option C: Horizontal Scaling
1. Deploy multiple backend instances
2. Use a load balancer (nginx/HAProxy)
3. Use shared Redis for cache
4. Use MongoDB replica set

---

## Monitoring in Production

### Real-time Traffic Dashboard
The auto-scaling system logs traffic levels automatically:
```
📊 Traffic: 150.3 req/s, Level: high
⚠️ HIGH TRAFFIC: 320.5 req/s, Level: critical, Cache TTL multiplier: 4x
```

### Key Metrics to Watch
1. **RPS (Requests per second)** - Higher = more load
2. **Traffic Level** - Should stay at "low" or "medium" normally
3. **Cache Hit Rate** - Should be >70% for good performance
4. **Avg Response Time** - Should be <500ms

---

## Troubleshooting

### High Response Times
1. Check cache hit rate: `GET /api/admin/cache/stats`
2. If hit rate <50%, increase cache TTL
3. Check MongoDB indexes: `python create_indexes.py verify`

### Rate Limiting Issues
1. Check current limit: 500 req/min per IP
2. Adjust in `server.py`:
   ```python
   app.add_middleware(RateLimitMiddleware, requests_per_minute=1000)
   ```

### Memory Issues
1. Reduce `MAX_CACHE_ENTRIES` in `.env`
2. Add more RAM to server
3. Enable Redis for external caching

---

## Contact
For production deployment support, contact Emergent Labs.
