/**
 * Requiem C++ Engine Adapter
 * 
 * Adapter for the Requiem C++ execution engine.
 * Supports both binary (subprocess) and daemon modes.
 * 
 * @module engine/adapters/requiem
 */

import { BaseEngineAdapter, DaemonAdapter } from './base';
import {
  ExecRequest,
  ExecResult,
  EngineHealth,
  EngineCapabilities,
  EngineType,
  EngineConfig,
} from '../contract';
import { createEngineError, mapEngineError, shouldTriggerFallback } from '../errors';
import { toRequiemFormat, fromRequiemFormat, computeDeterministicHash } from '../translate';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

const execFile = promisify(require('child_process').execFile);

/**
 * Requiem Engine Adapter
 * 
 * Integrates with the Requiem C++ engine via:
 * 1. Binary mode (default): Spawns `requiem` as subprocess
 * 2. Daemon mode (optional): Connects to `requiem serve`
 */
export class RequiemEngineAdapter extends BaseEngineAdapter implements DaemonAdapter {
  readonly name = 'RequiemEngine';
  readonly engineType: EngineType = 'requiem';
  
  private config: EngineConfig;
  private binaryPath: string | null = null;
  private daemonProcess: ChildProcess | null = null;
  private daemonSocket: net.Socket | null = null;
  private requestCounter = 0;
  
  constructor(config?: Partial<EngineConfig>) {
    super();
    this.config = {
      ...require('../contract').DEFAULT_ENGINE_CONFIG,
      ...config,
    };
  }
  
  async initialize(): Promise<void> {
    // Locate Requiem binary
    this.binaryPath = await this.findBinary();
    
    if (!this.binaryPath) {
      console.warn('[RequiemEngine] Binary not found, will use fallback or stub mode');
    } else {
      console.log(`[RequiemEngine] Found binary at: ${this.binaryPath}`);
    }
    
    // Start daemon if configured
    if (this.config.daemon?.enabled && this.config.daemon.autoStart) {
      await this.startDaemon();
    }
    
    this.isInitialized = true;
  }
  
  async execute(request: ExecRequest): Promise<ExecResult> {
    this.validateRequest(request);
    
    // Check if forced to use Rust
    if (process.env[this.config.rollback.forceEnvVar]) {
      throw new Error(`Requiem disabled by ${this.config.rollback.forceEnvVar}`);
    }
    
    if (this.config.daemon?.enabled && this.daemonSocket) {
      return this.executeViaDaemon(request);
    }
    
    if (this.binaryPath) {
      return this.executeViaBinary(request);
    }
    
    // No binary available - return stub result for development
    return this.executeStubMode(request);
  }
  
  /**
   * Execute via subprocess (binary mode)
   */
  private async executeViaBinary(request: ExecRequest): Promise<ExecResult> {
    const startTime = Date.now();
    
    try {
      const inputJson = toRequiemFormat(request);
      
      // Write input to temp file (safer for large inputs)
      const tempDir = process.env.TEMP || process.env.TMP || '/tmp';
      const tempFile = path.join(tempDir, `requiem-${request.requestId}.json`);
      fs.writeFileSync(tempFile, inputJson);
      
      try {
        const { stdout, stderr } = await execFile(
          this.binaryPath!,
          ['exec', 'run', '--request', tempFile],
          {
            timeout: this.config.timeouts.defaultMs,
            encoding: 'utf8',
          },
        );
        
        if (stderr) {
          console.warn('[RequiemEngine] stderr:', stderr);
        }
        
        const durationMs = Date.now() - startTime;
        return fromRequiemFormat(stdout, request.requestId);
      } finally {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      throw this.handleExecutionError(error);
    }
  }
  
  /**
   * Execute via daemon (TCP/Unix socket)
   */
  private async executeViaDaemon(request: ExecRequest): Promise<ExecResult> {
    if (!this.daemonSocket) {
      throw new Error('Daemon not connected');
    }
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const inputJson = toRequiemFormat(request);
      const chunks: Buffer[] = [];
      
      const timeout = setTimeout(() => {
        reject(createEngineError('E_TIMEOUT', 'Daemon request timed out'));
      }, this.config.timeouts.defaultMs);
      
      this.daemonSocket!.once('data', (data) => {
        chunks.push(data);
      });
      
      this.daemonSocket!.once('end', () => {
        clearTimeout(timeout);
        try {
          const response = Buffer.concat(chunks).toString('utf8');
          const result = fromRequiemFormat(response, request.requestId);
          result.meta.durationMs = Date.now() - startTime;
          resolve(result);
        } catch (error) {
          reject(mapEngineError(error));
        }
      });
      
      this.daemonSocket!.once('error', (err) => {
        clearTimeout(timeout);
        reject(mapEngineError(err));
      });
      
      // Send request length-prefixed
      const data = Buffer.from(inputJson, 'utf8');
      const lengthPrefix = Buffer.alloc(4);
      lengthPrefix.writeUInt32BE(data.length, 0);
      this.daemonSocket!.write(Buffer.concat([lengthPrefix, data]));
    });
  }
  
  /**
   * Stub mode for development (when Requiem binary not available)
   * Mirrors the Rust engine behavior for testing
   */
  private async executeStubMode(request: ExecRequest): Promise<ExecResult> {
    console.warn('[RequiemEngine] Running in STUB MODE - results are simulated');
    
    const startTime = Date.now();
    const { params } = request;
    
    // Simple minimax regret implementation for stub
    const actions = params.actions;
    const states = params.states;
    const outcomes = params.outcomes;
    
    // Calculate max utility per state
    const maxStateUtility: Record<string, number> = {};
    for (const state of states) {
      let maxUtil = -Infinity;
      for (const action of actions) {
        const util = outcomes[action]?.[state] ?? 0;
        maxUtil = Math.max(maxUtil, util);
      }
      maxStateUtility[state] = maxUtil;
    }
    
    // Calculate regret table
    const regretTable: Record<string, Record<string, number>> = {};
    const maxRegret: Record<string, number> = {};
    
    for (const action of actions) {
      regretTable[action] = {};
      let maxR = 0;
      
      for (const state of states) {
        const util = outcomes[action]?.[state] ?? 0;
        const regret = maxStateUtility[state] - util;
        regretTable[action][state] = regret;
        maxR = Math.max(maxR, regret);
      }
      
      maxRegret[action] = maxR;
    }
    
    // Rank actions by regret (lower is better)
    const ranked = [...actions].sort((a, b) => {
      const diff = maxRegret[a] - maxRegret[b];
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
    
    const result: ExecResult = {
      requestId: request.requestId,
      status: 'success',
      recommendedAction: ranked[0],
      ranking: ranked,
      trace: {
        algorithm: 'minimax_regret',
        regretTable,
        maxRegret,
      },
      fingerprint: '', // Will be computed
      meta: {
        engine: 'requiem',
        engineVersion: '0.1.0-stub',
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      },
    };
    
    // Compute fingerprint
    result.fingerprint = computeDeterministicHash(result);
    
    return result;
  }
  
  /**
   * Handle execution errors with proper error codes
   */
  private handleExecutionError(error: unknown): Error {
    const engineError = mapEngineError(error);
    
    // Check if this should trigger fallback
    if (shouldTriggerFallback(engineError)) {
      if (this.config.autoFallback) {
        console.warn(`[RequiemEngine] Error ${engineError.code} - triggering fallback to Rust`);
      }
    }
    
    return new Error(JSON.stringify(engineError));
  }
  
  async health(): Promise<EngineHealth> {
    // Check if forced to use Rust
    if (process.env[this.config.rollback.forceEnvVar]) {
      return {
        healthy: false,
        engine: 'requiem',
        version: 'disabled',
        lastError: `Disabled by ${this.config.rollback.forceEnvVar}`,
        checkedAt: new Date().toISOString(),
      };
    }
    
    
    // Check binary exists
    if (!this.binaryPath) {
      // In stub mode, report healthy but with warning
      return {
        healthy: true,
        engine: 'requiem',
        version: '0.1.0-stub',
        lastError: 'Running in stub mode (binary not found)',
        checkedAt: new Date().toISOString(),
      };
    }
    
    try {
      // Try to get version from binary
      const { stdout } = await execFile(this.binaryPath, ['--version'], {
        timeout: this.config.timeouts.healthCheckMs,
      });
      
      this.isHealthy = true;
      return {
        healthy: true,
        engine: 'requiem',
        version: stdout.trim() || 'unknown',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.isHealthy = false;
      return {
        healthy: false,
        engine: 'requiem',
        version: 'unknown',
        lastError: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  }
  
  async capabilities(): Promise<EngineCapabilities> {
    const hasBinary = !!this.binaryPath;
    
    return {
      deterministicHashing: hasBinary,
      casSupport: hasBinary,
      replayValidation: hasBinary,
      sandboxing: hasBinary,
      windowsSupport: hasBinary,
      daemonMode: hasBinary && this.config.daemon?.enabled,
      version: await this.version(),
    };
  }
  
  async version(): Promise<string> {
    if (!this.binaryPath) {
      return '0.1.0-stub';
    }
    
    try {
      const { stdout } = await execFile(this.binaryPath, ['--version'], {
        timeout: this.config.timeouts.healthCheckMs,
      });
      return stdout.trim() || 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  // ============================================================================
  // Daemon Mode
  // ============================================================================
  
  async startDaemon(): Promise<void> {
    if (!this.binaryPath) {
      throw new Error('Cannot start daemon: binary not found');
    }
    
    if (await this.isDaemonRunning()) {
      console.log('[RequiemEngine] Daemon already running');
      return;
    }
    
    console.log('[RequiemEngine] Starting daemon...');
    
    const args = ['serve'];
    
    if (this.config.daemon?.port) {
      args.push('--port', String(this.config.daemon.port));
    }
    
    if (this.config.daemon?.socketPath) {
      args.push('--socket', this.config.daemon.socketPath);
    }
    
    this.daemonProcess = spawn(this.binaryPath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    // Wait for daemon to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Daemon startup timed out'));
      }, this.config.timeouts.daemonStartupMs);
      
      this.daemonProcess!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      
      // Give daemon a moment to start
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 1000);
    });
    
    // Connect to daemon
    await this.connectToDaemon();
  }
  
  async stopDaemon(): Promise<void> {
    if (this.daemonSocket) {
      this.daemonSocket.end();
      this.daemonSocket = null;
    }
    
    if (this.daemonProcess) {
      this.daemonProcess.kill();
      this.daemonProcess = null;
    }
  }
  
  async isDaemonRunning(): Promise<boolean> {
    if (!this.daemonProcess) {
      return false;
    }
    
    return this.daemonProcess.exitCode === null;
  }
  
  private async connectToDaemon(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Daemon connection timed out'));
      }, 5000);
      
      if (this.config.daemon?.port) {
        // TCP connection
        this.daemonSocket = net.createConnection({
          host: this.config.daemon.host || 'localhost',
          port: this.config.daemon.port,
        }, () => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
        // Unix socket or named pipe
        const socketPath = this.config.daemon?.socketPath || this.getDefaultSocketPath();
        this.daemonSocket = net.createConnection(socketPath, () => {
          clearTimeout(timeout);
          resolve();
        });
      }
      
      this.daemonSocket!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  
  private getDefaultSocketPath(): string {
    if (process.platform === 'win32') {
      return '\\\\.\\pipe\\requiem-daemon';
    }
    return '/tmp/requiem-daemon.sock';
  }
  
  // ============================================================================
  // Binary Discovery
  // ============================================================================
  
  private async findBinary(): Promise<string | null> {
    // 1. Check environment variable
    if (process.env.REQUIEM_BIN) {
      if (fs.existsSync(process.env.REQUIEM_BIN)) {
        return process.env.REQUIEM_BIN;
      }
    }
    
    // 2. Check default relative paths
    const searchPaths = [
      path.join(process.cwd(), 'requiem', 'bin', 'requiem'),
      path.join(process.cwd(), 'requiem', 'bin', 'requiem.exe'),
      path.join(process.cwd(), '..', 'requiem', 'bin', 'requiem'),
      path.join(process.cwd(), '..', 'requiem', 'bin', 'requiem.exe'),
    ];
    
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    // 3. Check PATH
    try {
      const { stdout } = await execFile('which', ['requiem'], { encoding: 'utf8' });
      const binPath = stdout.trim();
      if (binPath && fs.existsSync(binPath)) {
        return binPath;
      }
    } catch {
      // Not in PATH
    }
    
    // 4. Check Windows PATH
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execFile('where', ['requiem'], { encoding: 'utf8' });
        const binPath = stdout.trim().split('\n')[0];
        if (binPath && fs.existsSync(binPath)) {
          return binPath;
        }
      } catch {
        // Not in PATH
      }
    }
    
    return null;
  }
}

/**
 * Create a Requiem engine adapter instance
 */
export function createRequiemAdapter(config?: Partial<EngineConfig>): RequiemEngineAdapter {
  return new RequiemEngineAdapter(config);
}
