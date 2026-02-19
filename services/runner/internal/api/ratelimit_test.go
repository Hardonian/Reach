package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"reach/services/runner/internal/backpressure"
)

func TestDefaultRateLimitConfig(t *testing.T) {
	cfg := DefaultRateLimitConfig()

	if cfg.RequestsPerMinutePerTenant != 120 {
		t.Errorf("expected RequestsPerMinutePerTenant=120, got %d", cfg.RequestsPerMinutePerTenant)
	}
	if cfg.RequestsPerMinutePerIP != 60 {
		t.Errorf("expected RequestsPerMinutePerIP=60, got %d", cfg.RequestsPerMinutePerIP)
	}
	if cfg.BurstSizePerTenant != 20 {
		t.Errorf("expected BurstSizePerTenant=20, got %d", cfg.BurstSizePerTenant)
	}
	if cfg.BurstSizePerIP != 10 {
		t.Errorf("expected BurstSizePerIP=10, got %d", cfg.BurstSizePerIP)
	}
	if cfg.CleanupInterval != 5*time.Minute {
		t.Errorf("expected CleanupInterval=5m, got %v", cfg.CleanupInterval)
	}
	if cfg.MaxAge != 10*time.Minute {
		t.Errorf("expected MaxAge=10m, got %v", cfg.MaxAge)
	}
}

func TestNewRateLimiterMiddleware(t *testing.T) {
	cfg := DefaultRateLimitConfig()
	rl := NewRateLimiterMiddleware(cfg)

	if rl == nil {
		t.Fatal("expected non-nil RateLimiterMiddleware")
	}
	if rl.tenantLimiters == nil {
		t.Error("expected tenantLimiters to be initialized")
	}
	if rl.ipLimiters == nil {
		t.Error("expected ipLimiters to be initialized")
	}
	if rl.config.RequestsPerMinutePerTenant != 120 {
		t.Error("config not set correctly")
	}

	rl.Stop()
}

func TestNewRateLimiterMiddlewareDefaults(t *testing.T) {
	// Test with zero values - should use defaults
	cfg := RateLimitConfig{}
	rl := NewRateLimiterMiddleware(cfg)

	if rl.config.RequestsPerMinutePerTenant != 120 {
		t.Errorf("expected default RequestsPerMinutePerTenant=120, got %d", rl.config.RequestsPerMinutePerTenant)
	}
	if rl.config.RequestsPerMinutePerIP != 60 {
		t.Errorf("expected default RequestsPerMinutePerIP=60, got %d", rl.config.RequestsPerMinutePerIP)
	}

	rl.Stop()
}

func TestRateLimiterMiddleware(t *testing.T) {
	cfg := RateLimitConfig{
		RequestsPerMinutePerTenant: 120,
		RequestsPerMinutePerIP:     60,
		BurstSizePerTenant:         10,
		BurstSizePerIP:             10,
	}
	rl := NewRateLimiterMiddleware(cfg)
	defer rl.Stop()

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	// First request should succeed
	req1 := httptest.NewRequest("GET", "/test", nil)
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)

	if rr1.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr1.Code)
	}
}

func TestRateLimiterMiddlewareWithTenant(t *testing.T) {
	cfg := RateLimitConfig{
		RequestsPerMinutePerTenant: 120,
		RequestsPerMinutePerIP:     60,
		BurstSizePerTenant:         10,
		BurstSizePerIP:             10,
	}
	rl := NewRateLimiterMiddleware(cfg)
	defer rl.Stop()

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Request with tenant context
	ctx := context.WithValue(context.Background(), tenantKey, "tenant-123")
	req := httptest.NewRequest("GET", "/test", nil).WithContext(ctx)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}
}

func TestGetClientIP(t *testing.T) {
	cfg := DefaultRateLimitConfig()
	rl := NewRateLimiterMiddleware(cfg)
	defer rl.Stop()

	tests := []struct {
		name       string
		remoteAddr string
		headers    map[string]string
		expected   string
	}{
		{
			name:       "RemoteAddr only",
			remoteAddr: "192.168.1.1:1234",
			expected:   "192.168.1.1",
		},
		{
			name:       "X-Forwarded-For",
			remoteAddr: "192.168.1.1:1234",
			headers:    map[string]string{"X-Forwarded-For": "10.0.0.1"},
			expected:   "10.0.0.1",
		},
		{
			name:       "X-Forwarded-For multiple",
			remoteAddr: "192.168.1.1:1234",
			headers:    map[string]string{"X-Forwarded-For": "10.0.0.1, 10.0.0.2, 10.0.0.3"},
			expected:   "10.0.0.1",
		},
		{
			name:       "X-Real-Ip",
			remoteAddr: "192.168.1.1:1234",
			headers:    map[string]string{"X-Real-Ip": "172.16.0.1"},
			expected:   "172.16.0.1",
		},
		{
			name:       "X-Forwarded-For takes precedence",
			remoteAddr: "192.168.1.1:1234",
			headers:    map[string]string{"X-Forwarded-For": "10.0.0.1", "X-Real-Ip": "172.16.0.1"},
			expected:   "10.0.0.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			req.RemoteAddr = tt.remoteAddr
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}

			got := rl.getClientIP(req)
			if got != tt.expected {
				t.Errorf("expected IP %s, got %s", tt.expected, got)
			}
		})
	}
}

func TestWriteRateLimitResponse(t *testing.T) {
	cfg := DefaultRateLimitConfig()
	rl := NewRateLimiterMiddleware(cfg)
	defer rl.Stop()

	rr := httptest.NewRecorder()
	rl.writeRateLimitResponse(rr, "tenant")

	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected status 429, got %d", rr.Code)
	}

	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type 'application/json', got %s", contentType)
	}

	retryAfter := rr.Header().Get("Retry-After")
	if retryAfter != "60" {
		t.Errorf("expected Retry-After '60', got %s", retryAfter)
	}

	body := rr.Body.String()
	if body == "" {
		t.Error("expected non-empty response body")
	}
}

func TestRateLimiterMiddlewareBurst(t *testing.T) {
	cfg := RateLimitConfig{
		RequestsPerMinutePerTenant: 600, // High rate to avoid refill issues
		RequestsPerMinutePerIP:     600,
		BurstSizePerTenant:         5,
		BurstSizePerIP:             5,
	}
	rl := NewRateLimiterMiddleware(cfg)
	defer rl.Stop()

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First 5 requests should succeed (burst size)
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("request %d: expected status 200, got %d", i+1, rr.Code)
		}
	}

	// 6th request should be rate limited (exhausted burst)
	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected status 429 after burst, got %d", rr.Code)
	}
}

func TestRateLimiterMiddlewareDifferentTenants(t *testing.T) {
	cfg := RateLimitConfig{
		RequestsPerMinutePerTenant: 600,
		RequestsPerMinutePerIP:     600,
		BurstSizePerTenant:         2,
		BurstSizePerIP:             10, // High IP burst so only tenant limit matters
	}
	rl := NewRateLimiterMiddleware(cfg)
	defer rl.Stop()

	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Exhaust burst for tenant-1
	ctx1 := context.WithValue(context.Background(), tenantKey, "tenant-1")
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/test", nil).WithContext(ctx1)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Errorf("tenant-1 request %d: expected status 200, got %d", i+1, rr.Code)
		}
	}

	// tenant-1 should now be rate limited
	req := httptest.NewRequest("GET", "/test", nil).WithContext(ctx1)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected tenant-1 to be rate limited, got status %d", rr.Code)
	}

	// tenant-2 should still be able to make requests
	ctx2 := context.WithValue(context.Background(), tenantKey, "tenant-2")
	req2 := httptest.NewRequest("GET", "/test", nil).WithContext(ctx2)
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Errorf("tenant-2 should not be rate limited, got status %d", rr2.Code)
	}
}

func TestRateLimiterStop(t *testing.T) {
	cfg := DefaultRateLimitConfig()
	rl := NewRateLimiterMiddleware(cfg)

	// Create some limiters
	_ = rl.getTenantLimiter("tenant-1")
	_ = rl.getIPLimiter("192.168.1.1")

	rl.Stop()

	// After stop, maps should be cleared
	rl.mu.RLock()
	if len(rl.tenantLimiters) != 0 {
		t.Error("expected tenantLimiters to be cleared after stop")
	}
	if len(rl.ipLimiters) != 0 {
		t.Error("expected ipLimiters to be cleared after stop")
	}
	rl.mu.RUnlock()
}

func TestServerWithRateLimit(t *testing.T) {
	// This tests the integration with the Server struct
	rl := &RateLimiterMiddleware{
		tenantLimiters: make(map[string]*backpressure.RateLimiter),
		ipLimiters:     make(map[string]*backpressure.RateLimiter),
		config:         DefaultRateLimitConfig(),
	}
	defer rl.Stop()

	s := &Server{rateLimiter: rl}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := s.withRateLimit(handler)
	if wrapped == nil {
		t.Error("expected non-nil handler")
	}

	// Test that it works
	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()
	wrapped.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}
}
