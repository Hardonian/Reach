# Reach Portability Guide ## Overview

Reach is designed to be highly portable across different environments and deployment scenarios.

## Deployment Matrix | Environment | Installation Method | Complexity | Best For |

|-------------|-------------------|------------|----------|
| Local Dev | npm/npx | Low | Development, testing |
| Local Dev | Docker | Low | Isolated environments |
| CI/CD | npm/pip | Low | Automated testing |
| Production | Docker | Medium | Container orchestration |
| Production | Binary | Low | Bare metal, VMs |
| Edge | Single Binary | Medium | Resource-constrained environments |

## Local Development ### Using npx (No Installation)

```bash
# Run without installing npx @reach/cli doctor
npx @reach/cli serve
```

### Using Docker Compose ```yaml

version: '3.8'
services:
reach:
image: reach/reach:latest
ports: - "8787:8787"
volumes: - ./data:/data
environment: - REACH_DATA_DIR=/data

````

## CI/CD Integration ### GitHub Actions

```yaml
name: Reach Tests

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Reach
        uses: reach/setup-action@v1
        with:
          version: 'latest'

      - name: Run tests
        run: |
          reach doctor
          reach serve &
          npm run test:integration
````

### GitLab CI ```yaml

test:
image: reach/reach:latest
script: - reach doctor - reach serve --daemon - pytest tests/

````

## Production Deployment ### Docker

```dockerfile
FROM reach/reach:latest

COPY config.yaml /etc/reach/config.yaml

EXPOSE 8787

CMD ["reach", "serve", "--config", "/etc/reach/config.yaml"]
````

### Kubernetes ```yaml

apiVersion: apps/v1
kind: Deployment
metadata:
name: reach
spec:
replicas: 3
selector:
matchLabels:
app: reach
template:
metadata:
labels:
app: reach
spec:
containers: - name: reach
image: reach/reach:latest
ports: - containerPort: 8787
env: - name: REACH_DATA_DIR
value: /data
volumeMounts: - name: data
mountPath: /data
volumes: - name: data
persistentVolumeClaim:
claimName: reach-data

---

apiVersion: v1
kind: Service
metadata:
name: reach
spec:
selector:
app: reach
ports: - port: 8787
targetPort: 8787

````

### systemd Service ```ini
# /etc/systemd/system/reach.service [Unit]
Description=Reach Server
After=network.target

[Service]
Type=simple
User=reach
ExecStart=/usr/local/bin/reach serve --port 8787
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
````

## Single Binary Deployment For environments where a single binary is preferred:

### Building ```bash

# Build static binary make build-static

# Output: ./reach-static ```

### Deployment ```bash

# Copy to target system scp reach-static user@server:/usr/local/bin/reach

# Run directly reach serve

````

### Limitations - Single binary mode has limited plugin support
- Some features may require additional configuration
- Database is SQLite-only in single binary mode

## Cross-Platform Support | Platform | Tier | Notes |
|----------|------|-------|
| Linux x64 | Tier 1 | Full support |
| macOS x64/ARM | Tier 1 | Full support |
| Windows x64 | Tier 2 | Full support, PowerShell recommended |
| Linux ARM64 | Tier 2 | Full support |
| FreeBSD | Tier 3 | Community support |

## Reverse Proxy Configuration ### Nginx

```nginx
server {
    listen 80;
    server_name reach.example.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
````

### Traefik ```yaml

labels:

- "traefik.enable=true"
- "traefik.http.routers.reach.rule=Host(`reach.example.com`)"
- "traefik.http.services.reach.loadbalancer.server.port=8787"

````

## Offline-First Mode Reach is designed to work completely offline:

```bash
# Start in offline mode (no external dependencies) reach serve --offline

# All features work locally: # - Run execution
# - Event logging # - Capsule creation/verification
# - Pack management # - Federation status (local nodes only)
````

## Migration Between Environments ### Export Data

```bash
# Export all runs tar czf reach-backup.tar.gz data/
```

### Import Data ```bash

# Import to new environment tar xzf reach-backup.tar.gz

reach serve

```

## Security Considerations - Always bind to `127.0.0.1` in local development
- Use `0.0.0.0` only behind a reverse proxy
- Enable authentication in production
- Use TLS for external access
- Regular backups of the data directory
```
