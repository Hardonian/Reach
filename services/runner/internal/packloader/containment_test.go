package packloader

import (
	"fmt"
	"testing"
	"time"
)

func TestFailureContainment_Register(t *testing.T) {
	fc := NewFailureContainment(DefaultContainmentPolicy())
	fc.Register("pack-a")

	h, ok := fc.GetHealth("pack-a")
	if !ok {
		t.Fatal("expected health to be registered")
	}
	if h.Status != PackStatusActive {
		t.Errorf("expected active status, got %s", h.Status)
	}
}

func TestFailureContainment_RecordSuccess(t *testing.T) {
	fc := NewFailureContainment(DefaultContainmentPolicy())
	fc.Register("pack-a")

	fc.RecordFailure("pack-a", fmt.Errorf("test error"))
	fc.RecordFailure("pack-a", fmt.Errorf("test error"))
	fc.RecordSuccess("pack-a")

	h, _ := fc.GetHealth("pack-a")
	if h.Status != PackStatusActive {
		t.Errorf("expected active after success clears degraded, got %s", h.Status)
	}
}

func TestFailureContainment_DegradedStatus(t *testing.T) {
	policy := ContainmentPolicy{
		MaxFailures:   6,
		FailureWindow: 5 * time.Minute,
	}
	fc := NewFailureContainment(policy)
	fc.Register("pack-a")

	// More than half (3) failures should trigger degraded
	for i := 0; i < 4; i++ {
		fc.RecordFailure("pack-a", fmt.Errorf("error %d", i))
	}

	h, _ := fc.GetHealth("pack-a")
	if h.Status != PackStatusDegraded {
		t.Errorf("expected degraded status, got %s", h.Status)
	}
}

func TestFailureContainment_DisableOnThreshold(t *testing.T) {
	policy := ContainmentPolicy{
		MaxFailures:   3,
		FailureWindow: 5 * time.Minute,
	}
	fc := NewFailureContainment(policy)
	fc.Register("pack-a")

	var disabledPack string
	fc.OnDisable(func(packID, reason string) {
		disabledPack = packID
	})

	for i := 0; i < 3; i++ {
		fc.RecordFailure("pack-a", fmt.Errorf("error %d", i))
	}

	h, _ := fc.GetHealth("pack-a")
	if h.Status != PackStatusDisabled {
		t.Errorf("expected disabled, got %s", h.Status)
	}

	// Wait for async callback
	time.Sleep(50 * time.Millisecond)
	if disabledPack != "pack-a" {
		t.Errorf("expected onDisable callback for pack-a, got %s", disabledPack)
	}
}

func TestFailureContainment_IsActive(t *testing.T) {
	fc := NewFailureContainment(DefaultContainmentPolicy())
	fc.Register("pack-a")

	if !fc.IsActive("pack-a") {
		t.Error("pack should be active")
	}

	fc.DisablePack("pack-a", "manual disable")
	if fc.IsActive("pack-a") {
		t.Error("pack should not be active after disable")
	}
}

func TestFailureContainment_ManualDisableEnable(t *testing.T) {
	fc := NewFailureContainment(DefaultContainmentPolicy())
	fc.Register("pack-a")

	fc.DisablePack("pack-a", "maintenance")
	h, _ := fc.GetHealth("pack-a")
	if h.Status != PackStatusDisabled {
		t.Errorf("expected disabled, got %s", h.Status)
	}
	if h.DisableReason != "maintenance" {
		t.Errorf("expected reason 'maintenance', got %s", h.DisableReason)
	}

	fc.EnablePack("pack-a")
	h, _ = fc.GetHealth("pack-a")
	if h.Status != PackStatusActive {
		t.Errorf("expected active after enable, got %s", h.Status)
	}
	if h.FailureCount != 0 {
		t.Errorf("expected failure count reset, got %d", h.FailureCount)
	}
}

func TestFailureContainment_GetAllHealth(t *testing.T) {
	fc := NewFailureContainment(DefaultContainmentPolicy())
	fc.Register("pack-a")
	fc.Register("pack-b")

	all := fc.GetAllHealth()
	if len(all) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(all))
	}
}

func TestFailureContainment_UnknownPack(t *testing.T) {
	fc := NewFailureContainment(DefaultContainmentPolicy())

	_, ok := fc.GetHealth("unknown")
	if ok {
		t.Error("expected false for unknown pack")
	}

	if fc.IsActive("unknown") {
		t.Error("unknown pack should not be active")
	}
}

func TestFailureContainment_AutoRecover(t *testing.T) {
	policy := ContainmentPolicy{
		MaxFailures:   1,
		FailureWindow: 5 * time.Minute,
		AutoRecover:   true,
		RecoverAfter:  1 * time.Millisecond, // tiny for testing
	}
	fc := NewFailureContainment(policy)
	fc.Register("pack-a")

	fc.RecordFailure("pack-a", fmt.Errorf("error"))
	h, _ := fc.GetHealth("pack-a")
	if h.Status != PackStatusDisabled {
		t.Fatalf("expected disabled, got %s", h.Status)
	}

	// Wait for recovery period
	time.Sleep(10 * time.Millisecond)

	recovered := fc.CheckAutoRecover()
	if len(recovered) != 1 || recovered[0] != "pack-a" {
		t.Errorf("expected pack-a to auto-recover, got %v", recovered)
	}

	h, _ = fc.GetHealth("pack-a")
	if h.Status != PackStatusActive {
		t.Errorf("expected active after auto-recover, got %s", h.Status)
	}
}

func TestFailureContainment_NoAutoRecoverWhenDisabled(t *testing.T) {
	policy := ContainmentPolicy{
		MaxFailures:   1,
		FailureWindow: 5 * time.Minute,
		AutoRecover:   false,
	}
	fc := NewFailureContainment(policy)
	fc.Register("pack-a")

	fc.RecordFailure("pack-a", fmt.Errorf("error"))

	recovered := fc.CheckAutoRecover()
	if len(recovered) != 0 {
		t.Errorf("expected no auto-recovery, got %v", recovered)
	}
}

func TestFailureContainment_RecordFailure_CountsCorrectly(t *testing.T) {
	policy := ContainmentPolicy{
		MaxFailures:   100,
		FailureWindow: 5 * time.Minute,
	}
	fc := NewFailureContainment(policy)
	fc.Register("pack-a")

	for i := 0; i < 10; i++ {
		fc.RecordFailure("pack-a", fmt.Errorf("error %d", i))
	}

	h, _ := fc.GetHealth("pack-a")
	if h.FailureCount != 10 {
		t.Errorf("expected 10 failures, got %d", h.FailureCount)
	}
}
