/**
 * Rust Engine Adapter Tests
 * 
 * Tests for:
 * - WASM module loading and initialization
 * - Error handling during load failures
 * - Interface compliance
 * 
 * @module engine/adapters/rust.test
 */

import { describe, it, expect } from 'vitest';
import { RustEngineAdapter } from './rust';

describe('RustEngineAdapter', () => {
  describe('Initialization', () => {
    it('starts in unready state', () => {
      const adapter = new RustEngineAdapter();
      expect(adapter.isReady()).toBe(false);
      expect(adapter.getVersion()).toBeNull();
    });

    it('handles WASM loading failure', async () => {
      const adapter = new RustEngineAdapter();
      
      // Attempt to initialize with a non-existent module path
      // This should cause the dynamic import to fail
      await expect(adapter.initialize('/non/existent/path.js')).rejects.toThrow();
      
      expect(adapter.isReady()).toBe(false);
      expect(adapter.getLoadError()).toBeDefined();
    });
  });
});