# Gracefy High Availability Infrastructure Guide

## Overview

This document outlines the high-availability (HA) infrastructure implementation for the Gracefy API, designed to handle high traffic with resilience and scalability.

## Architecture Components

### 1. Load Balancer (Kubernetes Ingress)

The application is designed to work behind a Kubernetes Ingress controller (NGINX) that provides:

- **SSL/TLS termination**
- **Rate limiting** (100 req/s per client)
- **Connection limiting** (50 concurrent connections)
- **Session affinity** (sticky sessions for WebSocket)
- **GZip compression**
- **Health check routing**

**Configuration:** `/app/k8s/ingress.yaml`

### 2. Redis Cache Layer

Distributed caching with automatic fallback to in-memory cache.

**Features:**
- Automatic connection retry
- In-memory fallback when Redis unavailable
- Adaptive TTL based on traffic levels
- Cache invalidation patterns
- Statistics and monitoring

**Configuration:**
```bash
REDIS_URL=redis://your-redis-host:6379
REDIS_ENABLED=true
REDIS_PREFIX=gracefy:
```

**Endpoints:**
- `GET /api/system/status` - View cache statistics
- Cache auto-adjusts TTL based on traffic (1x at low traffic → 4x at critical)

### 3. Horizontal Pod Autoscaler (HPA)

Kubernetes HPA automatically scales pods based on CPU/memory usage.

**Configuration:** `/app/k8s/deployment.yaml`

```yaml
minReplicas: 2
maxReplicas: 20
metrics:
  - CPU utilization > 70%
  - Memory utilization > 80%
```

**Scaling Behavior:**
- Scale up: Immediate (can double pods every 15 seconds)
- Scale down: After 5 minutes of low utilization

### 4. RabbitMQ Message Queue

Distributed task queue for async processing with in-memory fallback.

**Features:**
- Persistent message delivery
- Multiple queue types (analytics, notifications, cache invalidation)
- Job retry with exponential backoff
- Fallback to in-memory queue

**Configuration:**
```bash
RABBITMQ_URL=amqp://user:pass@rabbitmq-host:5672/
RABBITMQ_ENABLED=true
```

**Queues:**
- `gracefy.analytics` - Analytics event processing
- `gracefy.notifications` - User notifications
- `gracefy.emails` - Email sending
- `gracefy.audio_processing` - Audio file processing
- `gracefy.cache_invalidation` - Distributed cache invalidation

### 5. Circuit Breakers

Prevents cascading failures when external services are down.

**Pre-configured Circuits:**
| Circuit | Failure Threshold | Timeout | Purpose |
|---------|------------------|---------|---------|
| `cdn` | 5 failures | 60s | CDN/media access |
| `payment` | 3 failures | 120s | Payment gateway |
| `sms` | 5 failures | 300s | SMS service |
| `external_api` | 5 failures | 60s | General external APIs |

**States:**
- **CLOSED**: Normal operation
- **OPEN**: Blocking requests (too many failures)
- **HALF_OPEN**: Testing if service recovered

**Admin Endpoint:**
- `POST /api/admin/circuits/reset` - Reset all circuit breakers

## Health Check Endpoints

Kubernetes-compatible health probes:

| Endpoint | Purpose | Success Code | Failure Code |
|----------|---------|--------------|--------------|
| `/api/health/live` | Liveness probe | 200 | 503 |
| `/api/health/ready` | Readiness probe | 200 | 503 |
| `/api/health/startup` | Startup probe | 200 | 503 |
| `/api/system/status` | Full system status | 200 | - |

## Deployment

### 1. Deploy Infrastructure Services

```bash
# Deploy Redis
kubectl apply -f /app/k8s/services.yaml

# Deploy API
kubectl apply -f /app/k8s/deployment.yaml

# Deploy Ingress
kubectl apply -f /app/k8s/ingress.yaml

# Apply ConfigMap
kubectl apply -f /app/k8s/configmap.yaml
```

### 2. Environment Variables

Required environment variables for production:

```bash
# Database
MONGO_URL=mongodb://mongodb:27017
DB_NAME=gracefy_production

# Redis
REDIS_URL=redis://redis:6379
REDIS_ENABLED=true

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672/
RABBITMQ_ENABLED=true

# Shutdown
SHUTDOWN_TIMEOUT=30
```

### 3. Resource Requirements

**API Pods:**
- Minimum: 256Mi memory, 100m CPU
- Maximum: 1Gi memory, 1000m CPU

**Redis:**
- Minimum: 128Mi memory
- Maximum: 512Mi memory (256MB data)

**RabbitMQ:**
- Minimum: 256Mi memory
- Maximum: 1Gi memory

## Monitoring

### Key Metrics

1. **Traffic Level**: `GET /api/system/status → traffic.traffic_level`
2. **Cache Hit Rate**: `GET /api/system/status → cache.hit_rate`
3. **Queue Backlog**: `GET /api/system/status → queue.enqueued`
4. **Circuit States**: `GET /api/system/status → circuits`

### Recommended Alerts

| Metric | Warning | Critical |
|--------|---------|----------|
| Cache hit rate | < 80% | < 50% |
| Circuit open | Any circuit | Payment circuit |
| Queue backlog | > 1000 | > 5000 |
| Response time | > 500ms | > 2000ms |

## Graceful Shutdown

The application supports graceful shutdown for zero-downtime deployments:

1. SIGTERM received
2. Mark as shutting down (stop accepting new requests)
3. Wait for active requests to complete (30s timeout)
4. Close database connections
5. Exit

## Scaling Guidelines

| Traffic Level | Recommended Pods | Redis Memory | Cache TTL |
|---------------|------------------|--------------|-----------|
| Low (<50 req/s) | 2 | 256MB | 1x |
| Medium (50-150 req/s) | 4-6 | 512MB | 2x |
| High (150-300 req/s) | 8-12 | 1GB | 3x |
| Critical (>300 req/s) | 15-20 | 2GB | 4x |

## Files Reference

- `/app/backend/core/redis_cache.py` - Redis caching implementation
- `/app/backend/core/message_queue.py` - RabbitMQ queue implementation
- `/app/backend/core/circuit_breaker.py` - Circuit breaker implementation
- `/app/backend/core/load_balancer.py` - Health checks & LB support
- `/app/k8s/deployment.yaml` - Kubernetes deployment + HPA
- `/app/k8s/services.yaml` - Redis & RabbitMQ deployments
- `/app/k8s/ingress.yaml` - Ingress configuration
- `/app/k8s/configmap.yaml` - Configuration & secrets template
