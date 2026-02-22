package errors

import "fmt"

/**
 * CloudNotEnabledError is returned when a user attempts to access a cloud-only
 * feature while running in OSS/Local mode.
 */
type CloudNotEnabledError struct {
	Feature string
}

func (e *CloudNotEnabledError) Error() string {
	return fmt.Sprintf("feature '%s' is not enabled in OSS mode. Set REACH_CLOUD=1 to enable cloud features (requires enterprise credentials).", e.Feature)
}

func NewCloudNotEnabledError(feature string) error {
	return &CloudNotEnabledError{Feature: feature}
}
