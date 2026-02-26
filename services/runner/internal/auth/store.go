// Package auth provides secure credential storage for Reach Cloud authentication.
package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// Credentials represents stored authentication credentials.
type Credentials struct {
	Token       string    `json:"token"`
	RefreshToken string   `json:"refresh_token,omitempty"`
	UserID      string    `json:"user_id"`
	Email       string    `json:"email"`
	OrgID       string    `json:"org_id,omitempty"`
	OrgName     string    `json:"org_name,omitempty"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
}

// Store manages credential persistence.
type Store struct {
	configDir string
}

// NewStore creates a new credential store.
func NewStore() (*Store, error) {
	configDir, err := getConfigDir()
	if err != nil {
		return nil, fmt.Errorf("config dir: %w", err)
	}
	
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return nil, fmt.Errorf("mkdir: %w", err)
	}
	
	return &Store{configDir: configDir}, nil
}

// NewStoreWithDir creates a store with a specific directory (for testing).
func NewStoreWithDir(dir string) *Store {
	return &Store{configDir: dir}
}

// Save stores credentials securely.
func (s *Store) Save(creds *Credentials) error {
	data, err := json.MarshalIndent(creds, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	
	credPath := filepath.Join(s.configDir, "credentials")
	
	// Write with restricted permissions (owner only)
	if err := os.WriteFile(credPath, data, 0600); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	
	return nil
}

// Load retrieves stored credentials.
func (s *Store) Load() (*Credentials, error) {
	credPath := filepath.Join(s.configDir, "credentials")
	
	data, err := os.ReadFile(credPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("not logged in")
		}
		return nil, fmt.Errorf("read: %w", err)
	}
	
	var creds Credentials
	if err := json.Unmarshal(data, &creds); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	
	// Check expiration
	if !creds.ExpiresAt.IsZero() && time.Now().After(creds.ExpiresAt) {
		return nil, fmt.Errorf("token expired")
	}
	
	return &creds, nil
}

// Clear removes stored credentials.
func (s *Store) Clear() error {
	credPath := filepath.Join(s.configDir, "credentials")
	
	if err := os.Remove(credPath); err != nil {
		if os.IsNotExist(err) {
			return nil // Already logged out
		}
		return fmt.Errorf("remove: %w", err)
	}
	
	return nil
}

// Exists checks if credentials exist.
func (s *Store) Exists() bool {
	credPath := filepath.Join(s.configDir, "credentials")
	_, err := os.Stat(credPath)
	return err == nil
}

// getConfigDir returns the platform-specific config directory.
func getConfigDir() (string, error) {
	var baseDir string
	
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		baseDir = filepath.Join(home, "Library", "Application Support", "reach")
		
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			appData = filepath.Join(home, "AppData", "Roaming")
		}
		baseDir = filepath.Join(appData, "reach")
		
	default: // Linux and other Unix
		configHome := os.Getenv("XDG_CONFIG_HOME")
		if configHome == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			configHome = filepath.Join(home, ".config")
		}
		baseDir = filepath.Join(configHome, "reach")
	}
	
	return baseDir, nil
}

// GetToken returns the current auth token or empty string if not logged in.
func (s *Store) GetToken() string {
	creds, err := s.Load()
	if err != nil {
		return ""
	}
	return creds.Token
}
