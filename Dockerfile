# Reach Development Dockerfile
# Multi-stage build for efficient development and production images

# Stage 1: Build environment
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make curl rust cargo nodejs npm

# Set working directory
WORKDIR /build

# Copy Go module files first for better layer caching
COPY services/runner/go.mod services/runner/go.sum ./services/runner/
COPY go.mod go.sum ./
RUN cd services/runner && go mod download

# Copy the rest of the source
COPY . .

# Build the runner service
RUN cd services/runner && go build -o /build/reach-runner ./cmd/server

# Stage 2: Development image
FROM golang:1.23-alpine AS dev

# Install development tools
RUN apk add --no-cache git make curl sqlite

# Install hot-reload tool (air)
RUN go install github.com/cosmtrek/air@latest

WORKDIR /app

# Copy Go modules for development
COPY services/runner/go.mod services/runner/go.sum ./
RUN go mod download

# Expose ports
EXPOSE 8080 8081

# Default command for development with hot reload
CMD ["air", "-c", ".air.toml"]

# Stage 3: Production image
FROM alpine:3.19 AS production

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite-libs

# Create non-root user
RUN adduser -D -u 1000 reach

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/reach-runner /app/reach-runner

# Create data directory
RUN mkdir -p /app/data && chown -R reach:reach /app

# Switch to non-root user
USER reach

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Run the server
ENTRYPOINT ["/app/reach-runner"]
