package api

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"reach/services/runner/internal/backpressure"
)

// trackedLimiter wraps a rate limiter with last-access tracking for cleanup.
type trackedLimiter struct {
	limiter    *backpressure.RateLimiter
	lastAccess time.Time
}

// RateLimiterMiddleware provides per-tenant and per-IP rate limiting
type RateLimiterMiddleware struct {
	// tenantLimiters maps tenantID to rate limiter
	tenantLimiters map[string]*trackedLimiter
	// ipLimiters maps IP address to rate limiter
	ipLimiters map[string]*trackedLimiter
	// mu protects the maps
	mu sync.RWMutex
	// config for rate limiting
	config RateLimitConfig
}

// RateLimitConfig configures rate limiting behavior
type RateLimitConfig struct {
	// RequestsPerMinutePerTenant is the rate limit per tenant
	RequestsPerMinutePerTenant int
	// RequestsPerMinutePerIP is the rate limit per IP address
	RequestsPerMinutePerIP int
	// BurstSizePerTenant is the burst size per tenant
	BurstSizePerTenant int
	// BurstSizePerIP is the burst size per IP
	BurstSizePerIP int
	// CleanupInterval is how often to clean up stale limiters
	CleanupInterval time.Duration
	// MaxAge is how long to keep limiters after last use
	MaxAge time.Duration
}

// DefaultRateLimitConfig returns sensible defaults
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerMinutePerTenant: 120,
		RequestsPerMinutePerIP:     60,
		BurstSizePerTenant:         20,
		BurstSizePerIP:             10,
		CleanupInterval:            5 * time.Minute,
		MaxAge:                     10 * time.Minute,
	}
}

// NewRateLimiterMiddleware creates a new rate limiting middleware
func NewRateLimiterMiddleware(config RateLimitConfig) *RateLimiterMiddleware {
	if config.RequestsPerMinutePerTenant <= 0 {
		config.RequestsPerMinutePerTenant = 120
	}
	if config.RequestsPerMinutePerIP <= 0 {
		config.RequestsPerMinutePerIP = 60
	}
	if config.BurstSizePerTenant <= 0 {
		config.BurstSizePerTenant = 20
	}
	if config.BurstSizePerIP <= 0 {
		config.BurstSizePerIP = 10
	}
	if config.CleanupInterval <= 0 {
		config.CleanupInterval = 5 * time.Minute
	}
	if config.MaxAge <= 0 {
		config.MaxAge = 10 * time.Minute
	}

	rl := &RateLimiterMiddleware{
		tenantLimiters: make(map[string]*trackedLimiter),
		ipLimiters:     make(map[string]*trackedLimiter),
		config:         config,
	}

	// Start cleanup goroutine
	go rl.cleanupLoop()

	return rl
}

// Middleware returns an HTTP middleware function
func (rl *RateLimiterMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get tenant ID from context (set by auth middleware)
		tenantID, hasTenant := r.Context().Value(tenantKey).(string)
		if hasTenant && tenantID != "" {
			limiter := rl.getTenantLimiter(tenantID)
			if !limiter.TryWait() {
				rl.writeRateLimitResponse(w, "tenant")
				return
			}
		}

		// Also check IP-based rate limiting
		ip := rl.getClientIP(r)
		if ip != "" {
			limiter := rl.getIPLimiter(ip)
			if !limiter.TryWait() {
				rl.writeRateLimitResponse(w, "ip")
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// getTenantLimiter gets or creates a rate limiter for a tenant
func (rl *RateLimiterMiddleware) getTenantLimiter(tenantID string) *backpressure.RateLimiter {
	rl.mu.RLock()
	tl, exists := rl.tenantLimiters[tenantID]
	rl.mu.RUnlock()

	if exists {
		tl.lastAccess = time.Now()
		return tl.limiter
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Double-check after acquiring write lock
	if tl, exists := rl.tenantLimiters[tenantID]; exists {
		tl.lastAccess = time.Now()
		return tl.limiter
	}

	// Create new limiter: requests per minute converted to per second
	rate := float64(rl.config.RequestsPerMinutePerTenant) / 60.0
	tl = &trackedLimiter{
		limiter:    backpressure.NewRateLimiter(rate, rl.config.BurstSizePerTenant),
		lastAccess: time.Now(),
	}
	rl.tenantLimiters[tenantID] = tl

	return tl.limiter
}

// getIPLimiter gets or creates a rate limiter for an IP
func (rl *RateLimiterMiddleware) getIPLimiter(ip string) *backpressure.RateLimiter {
	rl.mu.RLock()
	tl, exists := rl.ipLimiters[ip]
	rl.mu.RUnlock()

	if exists {
		tl.lastAccess = time.Now()
		return tl.limiter
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Double-check after acquiring write lock
	if tl, exists := rl.ipLimiters[ip]; exists {
		tl.lastAccess = time.Now()
		return tl.limiter
	}

	// Create new limiter: requests per minute converted to per second
	rate := float64(rl.config.RequestsPerMinutePerIP) / 60.0
	tl = &trackedLimiter{
		limiter:    backpressure.NewRateLimiter(rate, rl.config.BurstSizePerIP),
		lastAccess: time.Now(),
	}
	rl.ipLimiters[ip] = tl

	return tl.limiter
}

// getClientIP extracts the client IP from the request
func (rl *RateLimiterMiddleware) getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP if multiple are present
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}

	// Check X-Real-Ip header
	xri := r.Header.Get("X-Real-Ip")
	if xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fall back to RemoteAddr
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// writeRateLimitResponse writes a 429 Too Many Requests response
func (rl *RateLimiterMiddleware) writeRateLimitResponse(w http.ResponseWriter, scope string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", "60")
	w.WriteHeader(http.StatusTooManyRequests)

	response := map[string]any{
		"error":   "rate limited",
		"message": "Too many requests. Please try again later.",
		"scope":   scope,
	}

	json.NewEncoder(w).Encode(response)
}

// cleanupLoop periodically removes stale rate limiters
func (rl *RateLimiterMiddleware) cleanupLoop() {
	ticker := time.NewTicker(rl.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.cleanup()
	}
}

// cleanup removes stale rate limiters that haven't been accessed within MaxAge.
func (rl *RateLimiterMiddleware) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-rl.config.MaxAge)

	for key, tl := range rl.tenantLimiters {
		if tl.lastAccess.Before(cutoff) {
			tl.limiter.Stop()
			delete(rl.tenantLimiters, key)
		}
	}
	for key, tl := range rl.ipLimiters {
		if tl.lastAccess.Before(cutoff) {
			tl.limiter.Stop()
			delete(rl.ipLimiters, key)
		}
	}
}

// Stop stops all rate limiters and cleanup goroutine
func (rl *RateLimiterMiddleware) Stop() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	for _, tl := range rl.tenantLimiters {
		tl.limiter.Stop()
	}
	for _, tl := range rl.ipLimiters {
		tl.limiter.Stop()
	}

	rl.tenantLimiters = make(map[string]*trackedLimiter)
	rl.ipLimiters = make(map[string]*trackedLimiter)
}

// withRateLimit wraps a handler with rate limiting middleware
func (s *Server) withRateLimit(next http.Handler) http.Handler {
	return s.rateLimiter.Middleware(next)
}
