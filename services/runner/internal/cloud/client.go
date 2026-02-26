// Package cloud provides Reach Cloud API client functionality.
package cloud

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	defaultBaseURL = "https://api.reach.dev"
	requestTimeout = 30 * time.Second
)

// Client provides access to Reach Cloud APIs.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewClient creates a new cloud API client.
func NewClient(token string) *Client {
	return NewClientWithURL(token, defaultBaseURL)
}

// NewClientWithURL creates a client with a custom base URL.
func NewClientWithURL(token, baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		httpClient: &http.Client{
			Timeout: requestTimeout,
		},
	}
}

// User represents the current user.
type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

// Org represents an organization.
type Org struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	Plan     string `json:"plan"`
	IsActive bool   `json:"is_active"`
}

// GetMe retrieves the current user.
func (c *Client) GetMe(ctx context.Context) (*User, error) {
	var user User
	if err := c.get(ctx, "/v1/auth/me", &user); err != nil {
		return nil, err
	}
	return &user, nil
}

// ListOrgs retrieves organizations for the current user.
func (c *Client) ListOrgs(ctx context.Context) ([]Org, error) {
	var response struct {
		Orgs []Org `json:"orgs"`
	}
	if err := c.get(ctx, "/v1/tenants", &response); err != nil {
		return nil, err
	}
	return response.Orgs, nil
}

// GetOrg retrieves a specific organization.
func (c *Client) GetOrg(ctx context.Context, orgID string) (*Org, error) {
	var org Org
	if err := c.get(ctx, "/v1/tenants/"+orgID, &org); err != nil {
		return nil, err
	}
	return &org, nil
}

// CloudStatus represents the cloud service status.
type CloudStatus struct {
	Connected   bool   `json:"connected"`
	Plan        string `json:"plan"`
	OrgName     string `json:"org_name"`
	RunsUsed    int    `json:"runs_used"`
	RunsLimit   int    `json:"runs_limit"`
	StorageUsed int64  `json:"storage_used"`
}

// GetStatus retrieves the cloud status.
func (c *Client) GetStatus(ctx context.Context) (*CloudStatus, error) {
	var status CloudStatus
	if err := c.get(ctx, "/v1/status", &status); err != nil {
		return nil, err
	}
	return &status, nil
}

// StartAuthFlow initiates the OAuth device flow.
func (c *Client) StartAuthFlow(ctx context.Context) (*AuthFlow, error) {
	var flow AuthFlow
	if err := c.post(ctx, "/v1/auth/device", nil, &flow); err != nil {
		return nil, err
	}
	return &flow, nil
}

// PollAuthFlow polls for auth flow completion.
func (c *Client) PollAuthFlow(ctx context.Context, deviceCode string) (*AuthResult, error) {
	var result AuthResult
	if err := c.post(ctx, "/v1/auth/device/poll", map[string]string{
		"device_code": deviceCode,
	}, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// AuthFlow represents an OAuth device flow.
type AuthFlow struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

// AuthResult represents the result of authentication.
type AuthResult struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	User         User   `json:"user"`
	Org          Org    `json:"org"`
}

// HTTP helpers

func (c *Client) get(ctx context.Context, path string, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
	if err != nil {
		return err
	}
	
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	req.Header.Set("Accept", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	
	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("decode error: %w", err)
		}
	}
	
	return nil
}

func (c *Client) post(ctx context.Context, path string, body, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(data)
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bodyReader)
	if err != nil {
		return err
	}
	
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}
	
	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("decode error: %w", err)
		}
	}
	
	return nil
}

// APIKey represents an API key.
type APIKey struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Token    string `json:"token,omitempty"`
	LastUsed string `json:"last_used"`
	Created  string `json:"created"`
}

// ListAPIKeys retrieves API keys for the current user.
func (c *Client) ListAPIKeys(ctx context.Context) ([]APIKey, error) {
	var response struct {
		Keys []APIKey `json:"keys"`
	}
	if err := c.get(ctx, "/v1/api-keys", &response); err != nil {
		return nil, err
	}
	return response.Keys, nil
}

// CreateAPIKey creates a new API key.
func (c *Client) CreateAPIKey(ctx context.Context, name string) (*APIKey, error) {
	var key APIKey
	if err := c.post(ctx, "/v1/api-keys", map[string]string{"name": name}, &key); err != nil {
		return nil, err
	}
	return &key, nil
}

// RevokeAPIKey revokes an API key.
func (c *Client) RevokeAPIKey(ctx context.Context, keyID string) error {
	return c.post(ctx, "/v1/api-keys/"+keyID+"/revoke", nil, nil)
}

// Post performs a POST request (exposed for auth commands).
func (c *Client) Post(ctx context.Context, path string, body, result interface{}) error {
	return c.post(ctx, path, body, result)
}

// IsCloudAvailable checks if the cloud service is accessible.
func IsCloudAvailable() bool {
	client := NewClient("")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	req, err := http.NewRequestWithContext(ctx, "GET", defaultBaseURL+"/health", nil)
	if err != nil {
		return false
	}
	
	resp, err := client.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	
	return resp.StatusCode == http.StatusOK
}
