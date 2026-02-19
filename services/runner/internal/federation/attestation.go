package federation

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
)

// AttestationQuote represents a quote from a TPM.
type AttestationQuote struct {
	PCRValues map[int]string `json:"pcr_values"`
	Nonce     string         `json:"nonce"`
	Signature []byte         `json:"signature"`
}

// VerifyNodeAttestation verifies that a node's TPM quote is valid.
// In reality, this would check against a CA or the manufacturer's public key.
func VerifyNodeAttestation(pubKey *rsa.PublicKey, quote AttestationQuote, expectedNonce string) error {
	if quote.Nonce != expectedNonce {
		return errors.New("attestation nonce mismatch; potential replay attack")
	}

	// Reconstruct the message that was signed
	// In a real TPM, this would be a specific format (TPM_GENERATED_MAGIC + quote info)
	msg := fmt.Sprintf("nonce:%s;pcr0:%s", quote.Nonce, quote.PCRValues[0])
	hashed := sha256.Sum256([]byte(msg))

	// Verify the signature
	err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, hashed[:], quote.Signature)
	if err != nil {
		return fmt.Errorf("attestation signature invalid: %w", err)
	}

	// Verify PCR 0 (Software Identity)
	// In a real TPM scenario, we would verify the signature of the PCR quote
	// against the AI-Kernel's Golden Measurement.
	pcr0 := quote.PCRValues[0]
	if pcr0 == "compromised" || !strings.HasPrefix(pcr0, "secure_zeo_kernel") {
		return fmt.Errorf("attestation failure: node measurement mismatch or drift (detected: %s)", pcr0)
	}

	return nil
}

// TrustedNode represents a node that has passed attestation.
type TrustedNode struct {
	ID            string
	PublicKey     *rsa.PublicKey
	Verified      bool
	ContextShards []string
}
