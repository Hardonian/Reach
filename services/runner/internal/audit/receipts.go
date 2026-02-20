package audit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
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
	if secret == "" {
		panic("audit: ReceiptManager requires a non-empty secret key")
	}
	return &ReceiptManager{SecretKey: secret}
}

// canonicalJSON produces deterministic JSON by sorting map keys,
// ensuring receipt hashes are reproducible across serialization order changes.
func canonicalJSON(v any) ([]byte, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var raw interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	return marshalSorted(raw)
}

func marshalSorted(v interface{}) ([]byte, error) {
	switch val := v.(type) {
	case map[string]interface{}:
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		out := []byte("{")
		for i, k := range keys {
			if i > 0 {
				out = append(out, ',')
			}
			keyBytes, _ := json.Marshal(k)
			out = append(out, keyBytes...)
			out = append(out, ':')
			valBytes, err := marshalSorted(val[k])
			if err != nil {
				return nil, err
			}
			out = append(out, valBytes...)
		}
		out = append(out, '}')
		return out, nil
	case []interface{}:
		out := []byte("[")
		for i, item := range val {
			if i > 0 {
				out = append(out, ',')
			}
			itemBytes, err := marshalSorted(item)
			if err != nil {
				return nil, err
			}
			out = append(out, itemBytes...)
		}
		out = append(out, ']')
		return out, nil
	default:
		return json.Marshal(v)
	}
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

	// Hash inputs using canonical (sorted) JSON for determinism
	inData, err := canonicalJSON(inputs)
	if err != nil {
		return nil, fmt.Errorf("marshaling inputs for receipt: %w", err)
	}
	h := sha256.New()
	h.Write(inData)
	receipt.InputHash = hex.EncodeToString(h.Sum(nil))

	// Hash outputs
	outData, err := canonicalJSON(outputs)
	if err != nil {
		return nil, fmt.Errorf("marshaling outputs for receipt: %w", err)
	}
	h.Reset()
	h.Write(outData)
	receipt.OutputHash = hex.EncodeToString(h.Sum(nil))

	// Compute receipt hash over deterministic canonical content
	rData, err := canonicalJSON(receipt)
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
	if r.RunID == "" || r.PackCID == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(m.SecretKey))
	mac.Write([]byte(r.ReceiptHash))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(r.Signature), []byte(expected))
}

// VerifyReceiptChain validates an ordered sequence of receipts for temporal consistency.
func VerifyReceiptChain(receipts []ExecutionReceipt) error {
	for i := 1; i < len(receipts); i++ {
		if receipts[i].Timestamp.Before(receipts[i-1].Timestamp) {
			return fmt.Errorf("receipt chain broken at index %d: timestamp %v is before previous %v",
				i, receipts[i].Timestamp, receipts[i-1].Timestamp)
		}
	}
	return nil
}
