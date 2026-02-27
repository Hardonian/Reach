# Signing Plugin Interface

**Status:** Production Ready  
**Architecture:** Plugin-First

---

## Philosophy

Core only records **signature metadata**. Actual cryptographic operations are delegated to external signer plugins.

This design:
- Keeps heavy crypto libraries out of core
- Allows HSM/KMS integration
- Supports multiple signature algorithms
- Enables air-gapped signing
- Maintains small core bundle size

---

## Core Interface

Core records only metadata:

```typescript
interface SignatureMetadata {
  algorithm: string;      // 'ed25519', 'ecdsa', etc.
  keyId: string;          // Public key identifier
  timestamp: string;      // ISO 8601
  signatureRef?: string;  // External storage location
  signerPlugin: string;   // Which plugin signed
}
```

The actual signature is stored externally (HSM, KMS, file system, etc.).

---

## Signer Plugin Interface

All signer plugins must implement:

```typescript
interface SignerPlugin {
  readonly id: string;
  readonly name: string;
  readonly supportedAlgorithms: string[];
  
  isAvailable(): boolean;
  sign(data: string, options: SignOptions): Promise<SignResult>;
  verify(data: string, signature: string, keyId: string): Promise<boolean>;
  getKeyMetadata(keyId: string): Promise<KeyMetadata>;
}
```

---

## Built-in Plugins

### Stub Signer (Development)

```typescript
const signer = registry.get('stub');
```

- **Purpose:** Development and testing
- **Security:** NOT cryptographically secure
- **Algorithms:** `stub-ed25519`, `stub-ecdsa`

```bash
# Sign with stub (development only)
reach proof sign --bundle proof.json --key-id my-key --signer stub
```

---

## Creating a Signer Plugin

### 1. Implement the Interface

```typescript
import { SignerPlugin, SignOptions, SignResult } from './src/plugins/signing/interface.js';

export class HsmSignerPlugin implements SignerPlugin {
  readonly id = 'hsm';
  readonly name = 'HSM Signer';
  readonly supportedAlgorithms = ['ed25519', 'ecdsa-p256'];
  
  isAvailable(): boolean {
    // Check if HSM is connected
    return checkHsmConnection();
  }
  
  async sign(data: string, options: SignOptions): Promise<SignResult> {
    // Call HSM to sign
    const signature = await hsmSign(data, options.keyId);
    
    return {
      metadata: {
        algorithm: options.algorithm || 'ed25519',
        keyId: options.keyId,
        timestamp: new Date().toISOString(),
        signerPlugin: this.id,
        signatureRef: `hsm://${options.keyId}/${signature.slice(0, 16)}`,
      },
      signatureRef: `hsm://${options.keyId}/${signature.slice(0, 16)}`,
      signature, // May be empty if HSM doesn't return it
      keyId: options.keyId,
    };
  }
  
  async verify(data: string, signature: string, keyId: string): Promise<boolean> {
    // Call HSM to verify
    return hsmVerify(data, signature, keyId);
  }
  
  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    return {
      id: keyId,
      algorithm: 'ed25519',
      type: 'hsm-key',
      valid: true,
    };
  }
}
```

### 2. Register the Plugin

```typescript
import { getSignerRegistry } from './src/plugins/signing/interface.js';

const registry = getSignerRegistry();
registry.register(new HsmSignerPlugin());
```

### 3. Use the Plugin

```bash
reach proof sign --bundle proof.json --key-id my-key --signer hsm
```

---

## Example: File-based Signer

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { createSign, createVerify } from 'crypto';

export class FileSignerPlugin implements SignerPlugin {
  readonly id = 'file';
  readonly name = 'File-based Signer';
  readonly supportedAlgorithms = ['rsa-sha256'];
  
  private keyDir: string;
  
  constructor(keyDir: string) {
    this.keyDir = keyDir;
  }
  
  isAvailable(): boolean {
    return existsSync(this.keyDir);
  }
  
  async sign(data: string, options: SignOptions): Promise<SignResult> {
    const privateKey = readFileSync(`${this.keyDir}/${options.keyId}.pem`);
    
    const signer = createSign('RSA-SHA256');
    signer.update(data);
    const signature = signer.sign(privateKey, 'hex');
    
    // Store signature in file
    const sigPath = `${this.keyDir}/${options.keyId}-${Date.now()}.sig`;
    writeFileSync(sigPath, signature);
    
    return {
      metadata: {
        algorithm: 'rsa-sha256',
        keyId: options.keyId,
        timestamp: new Date().toISOString(),
        signerPlugin: this.id,
        signatureRef: `file://${sigPath}`,
      },
      signatureRef: `file://${sigPath}`,
      signature,
      keyId: options.keyId,
    };
  }
  
  async verify(data: string, signature: string, keyId: string): Promise<boolean> {
    const publicKey = readFileSync(`${this.keyDir}/${keyId}.pub`);
    
    const verifier = createVerify('RSA-SHA256');
    verifier.update(data);
    return verifier.verify(publicKey, signature, 'hex');
  }
  
  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    return {
      id: keyId,
      algorithm: 'rsa-sha256',
      type: 'rsa-key',
      valid: existsSync(`${this.keyDir}/${keyId}.pem`),
    };
  }
}
```

---

## Configuration

### Environment Variables

```bash
# Default signer plugin
REACH_DEFAULT_SIGNER=hsm

# HSM-specific config
REACH_HSM_ENDPOINT=https://hsm.example.com
REACH_HSM_KEY_ID=prod-key-001

# File signer config
REACH_FILE_KEY_DIR=/secure/keys
```

### Programmatic Configuration

```typescript
import { getSignerRegistry } from './src/plugins/signing/interface.js';
import { HsmSignerPlugin } from './my-signer.js';

const registry = getSignerRegistry();
registry.register(new HsmSignerPlugin({
  endpoint: process.env.REACH_HSM_ENDPOINT,
}));
```

---

## Verification Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Bundle    │────▶│   Core       │────▶│  Signer     │
│  Metadata   │     │  (metadata   │     │  (external) │
│             │     │   only)      │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
       │                                              │
       │                                              │
       │         ┌──────────────┐                     │
       │         │   HSM/KMS    │◀────────────────────┘
       │         │   (actual    │
       └────────▶│   crypto)    │
                 └──────────────┘
```

1. Core extracts signature metadata from bundle
2. Core calls signer plugin: `verify(data, signature, keyId)`
3. Signer plugin delegates to actual crypto implementation
4. Result returned to core

---

## Security Best Practices

1. **Never store private keys in core** — Always use external signer
2. **Use HSM for production** — Hardware security modules
3. **Key rotation** — Implement key rotation in plugin
4. **Audit logging** — Log all sign/verify operations
5. **Access control** — Restrict key access in plugin

---

## Testing

```typescript
import { StubSignerPlugin } from './src/plugins/signing/interface.js';

const signer = new StubSignerPlugin();
const result = await signer.sign('test-data', { keyId: 'test-key' });

// Verify
const valid = await signer.verify('test-data', result.signature!, 'test-key');
console.assert(valid === true);
```

---

## Available Plugins

| Plugin | ID | Status | Use Case |
|--------|-----|--------|----------|
| Stub | `stub` | Built-in | Development |
| File | `file` | Example | Testing |
| HSM | `hsm` | External | Production |
| AWS KMS | `aws-kms` | External | Production (AWS) |
| HashiCorp Vault | `vault` | External | Production (Enterprise) |

---

## CLI Reference

```bash
# Sign with default signer
reach proof sign --bundle proof.json --key-id my-key

# Sign with specific signer
reach proof sign --bundle proof.json --key-id my-key --signer hsm

# List available signers
reach proof sign --list-signers
```
