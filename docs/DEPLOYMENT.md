# Reach Deployment Guide

## Deployment Scenarios

### Local Development

```bash
# Quick start
reach serve

# With custom port
reach serve --port 8080

# With custom data directory
reach serve --data ./my-data
```

### Docker Deployment

```bash
# Run with Docker
docker run -d \
  --name reach \
  -p 8787:8787 \
  -v $(pwd)/data:/data \
  reach/reach:latest

# View logs
docker logs -f reach

# Stop
docker stop reach
```

### Docker Compose

```yaml
version: '3.8'

services:
  reach:
    image: reach/reach:latest
    container_name: reach
    ports:
      - "8787:8787"
    volumes:
      - reach-data:/data
    environment:
      - REACH_DATA_DIR=/data
      - REACH_LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8787/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  reach-data:
```

### Kubernetes

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: reach
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reach
  namespace: reach
spec:
  replicas: 1
  selector:
    matchLabels:
      app: reach
  template:
    metadata:
      labels:
        app: reach
    spec:
      containers:
        - name: reach
          image: reach/reach:latest
          ports:
            - containerPort: 8787
              name: http
          env:
            - name: REACH_DATA_DIR
              value: /data
          volumeMounts:
            - name: data
              mountPath: /data
          livenessProbe:
            httpGet:
              path: /health
              port: 8787
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8787
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: reach-data
---
apiVersion: v1
kind: Service
metadata:
  name: reach
  namespace: reach
spec:
  selector:
    app: reach
  ports:
    - port: 8787
      targetPort: 8787
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: reach-data
  namespace: reach
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## Reverse Proxy Setup

### Nginx

```nginx
upstream reach {
    server 127.0.0.1:8787;
}

server {
    listen 443 ssl http2;
    server_name reach.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://reach;
        proxy_http_version 1.1;
        
        # SSE support
        proxy_set_header Connection '';
        proxy_buffering off;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```caddy
reach.example.com {
    reverse_proxy localhost:8787
}
```

### Traefik

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.reach.rule=Host(`reach.example.com`)"
  - "traefik.http.routers.reach.tls=true"
  - "traefik.http.routers.reach.tls.certresolver=letsencrypt"
  - "traefik.http.services.reach.loadbalancer.server.port=8787"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACH_DATA_DIR` | Data directory | `./data` |
| `REACH_LOG_LEVEL` | Log level | `info` |
| `REACH_BIND` | Bind address | `127.0.0.1` |
| `REACH_PORT` | Server port | `8787` |

## Health Checks

```bash
# Basic health check
curl http://localhost:8787/health

# Version check
curl http://localhost:8787/version
```

## Monitoring

### Prometheus Metrics

Enable metrics endpoint:

```bash
export RUNNER_METRICS_ENABLED=1
reach serve
```

Access metrics:

```bash
curl http://localhost:8787/metrics
```

### Grafana Dashboard

Import the official Reach dashboard (ID: 12345) or use the provided JSON in `monitoring/grafana-dashboard.json`.

## Backup and Recovery

### Automated Backups

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/reach"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
tar czf "$BACKUP_DIR/reach_$DATE.tar.gz" data/

# Keep only last 7 days
find "$BACKUP_DIR" -name "reach_*.tar.gz" -mtime +7 -delete
```

### Recovery

```bash
# Stop server
pkill reach

# Restore from backup
tar xzf reach_20240101_120000.tar.gz

# Restart server
reach serve
```

## Troubleshooting

### Server Won't Start

```bash
# Check port availability
lsof -i :8787

# Check data directory permissions
ls -la data/

# Check logs
reach serve 2>&1 | tee reach.log
```

### High Memory Usage

```bash
# Limit memory with Docker
docker run -m 512m reach/reach:latest

# Monitor memory
docker stats reach
```

### Database Issues

```bash
# Verify database integrity
sqlite3 data/reach.sqlite "PRAGMA integrity_check;"

# Backup database
cp data/reach.sqlite data/reach.sqlite.backup
```
