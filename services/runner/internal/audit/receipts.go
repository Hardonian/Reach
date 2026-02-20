package audit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// ExecutionReceipt is a signed proof of a pack execution.
type ExecutionReceipt struct {
	RunID       string    `json:"run_id"`
	PackCID     string    `json:"pack_cid"`
	Timestamp   time.Time `json:"timestamp"`
	InputHash   string    `json:"input_hash"`
	OutputHash  string    `json:"output_hash"`
	NodeResults []string  `json:"node_results_hashes"`
	ReceiptHash string    `json:"receipt_hash"` // SHA256 of the receipt content
	Signature   string    `json:"signature"`    // HMAC-SHA256 signature
}

// ReceiptManager handles creation and verification of receipts.
type ReceiptManager struct {
	SecretKey string
}

func NewReceiptManager(secret string) *ReceiptManager {
	return &ReceiptManager{SecretKey: secret}
}

// GenerateReceipt creates a signed receipt for an execution run.
func (m *ReceiptManager) GenerateReceipt(runID, packCID string, inputs, outputs any) (*ExecutionReceipt, error) {
	if runID == "" || packCID == "" {
		return nil, fmt.Errorf("runID and packCID are required")
	}

	receipt := &ExecutionReceipt{
		RunID:     runID,
		PackCID:   packCID,
		Timestamp: time.Now().UTC(),
	}

	// Hash inputs
	inData, err := json.Marshal(inputs)
	if err != nil {
		return nil, fmt.Errorf("marshaling inputs for receipt: %w", err)
	}
	h := sha256.New()
	h.Write(inData)
	receipt.InputHash = hex.EncodeToString(h.Sum(nil))

	// Hash outputs
	outData, err := json.Marshal(outputs)
	if err != nil {
		return nil, fmt.Errorf("marshaling outputs for receipt: %w", err)
	}
	h.Reset()
	h.Write(outData)
	receipt.OutputHash = hex.EncodeToString(h.Sum(nil))

	// Compute receipt hash over the deterministic content
	rData, err := json.Marshal(receipt)
	if err != nil {
		return nil, fmt.Errorf("marshaling receipt for hashing: %w", err)
	}
	h.Reset()
	h.Write(rData)
	receipt.ReceiptHash = hex.EncodeToString(h.Sum(nil))

	// Sign with HMAC-SHA256
	mac := hmac.New(sha256.New, []byte(m.SecretKey))
	mac.Write([]byte(receipt.ReceiptHash))
	receipt.Signature = hex.EncodeToString(mac.Sum(nil))

	return receipt, nil
}

// VerifyReceipt checks the integrity and signature of a receipt.
func (m *ReceiptManager) VerifyReceipt(r *ExecutionReceipt) bool {
	if r == nil || r.ReceiptHash == "" || r.Signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(m.SecretKey))
	mac.Write([]byte(r.ReceiptHash))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(r.Signature), []byte(expected))
}
