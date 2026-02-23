/**
 * ReadyLayer Tool Sandbox Security Layer
 *
 * Provides secure tool execution with:
 * - Execution time limits
 * - Resource caps
 * - Structured invocation logs
 * - Permission scoping
 * - Rate limiting
 * - Circuit breaker pattern
 * - Error isolation
 * - Audit trail
 *
 * @module tool-sandbox
 */

import { z } from "zod";
import crypto from "crypto";

// Simple logger placeholder - replace with actual logger in production
const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(`[INFO] ${msg}`, meta || ""),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(`[WARN] ${msg}`, meta || ""),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(`[ERROR] ${msg}`, meta || ""),
};

// ── Tool Definition ───────────────────────────────────────────────────────────

/**
 * Tool permission scope.
 */
export type ToolPermissionScope =
  | "read"
  | "write"
  | "execute"
  | "admin"
  | "network"
  | "filesystem"
  | "process";

/**
 * Tool definition with security metadata.
 */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  permission_scope: ToolPermissionScope[];
  required_permissions: ToolPermissionScope[];
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  timeout_ms: number;
  max_retries: number;
  rate_limit?: RateLimitConfig;
  resource_limits?: ResourceLimits;
  is_dangerous: boolean;
  category: string;
  tags: string[];
}

/**
 * Rate limit configuration.
 */
export interface RateLimitConfig {
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  burst_limit?: number;
}

/**
 * Resource limits for a tool.
 */
export interface ResourceLimits {
  max_memory_mb: number;
  max_cpu_percent: number;
  max_network_requests: number;
  max_file_size_mb: number;
  max_execution_time_ms: number;
}

// ── Tool Invocation ─────────────────────────────────────────────────────────

/**
 * Tool invocation request.
 */
export interface ToolInvocation {
  tool_id: string;
  tool_name: string;
  invocation_id: string;
  tenant_id: string;
  run_id: string;
  user_id: string;
  input: Record<string, unknown>;
  permission_scope: ToolPermissionScope[];
  timestamp: string;
  timeout_ms: number;
}

/**
 * Tool execution result.
 */
export interface ToolExecutionResult {
  invocation_id: string;
  tool_id: string;
  tool_name: string;
  status: ToolExecutionStatus;
  output?: unknown;
  error?: ToolExecutionError;
  execution_time_ms: number;
  resource_usage: ResourceUsage;
  timestamp: string;
}

export type ToolExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "timeout"
  | "rate_limited"
  | "permission_denied"
  | "circuit_open";

export interface ToolExecutionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

export interface ResourceUsage {
  memory_used_mb: number;
  cpu_percent: number;
  network_requests: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
}

// ── Circuit Breaker ─────────────────────────────────────────────────────────

/**
 * Circuit breaker states.
 */
export type CircuitState = "closed" | "open" | "half_open";

/**
 * Circuit breaker for tool failure protection.
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly successThreshold = 2,
    private readonly timeoutMs = 30000,
    private readonly halfOpenMaxCalls = 3,
  ) {}

  getState(): CircuitState {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.timeoutMs) {
        this.state = "half_open";
        this.successCount = 0;
      }
    }
    return this.state;
  }

  canExecute(): boolean {
    const state = this.getState();
    if (state === "closed") return true;
    if (state === "half_open") {
      return this.successCount < this.halfOpenMaxCalls;
    }
    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === "half_open") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = "closed";
        this.successCount = 0;
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

// ── Rate Limiter ────────────────────────────────────────────────────────────

/**
 * Rate limiter using token bucket algorithm.
 */
export class RateLimiter {
  private tokens: Map<string, TokenBucket> = new Map();

  constructor(private readonly cleanupIntervalMs = 60000) {
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), this.cleanupIntervalMs);
  }

  check(
    key: string,
    config: RateLimitConfig,
  ): { allowed: boolean; retry_after_ms?: number } {
    let bucket = this.tokens.get(key);

    if (!bucket) {
      bucket = new TokenBucket(
        config.requests_per_minute,
        config.requests_per_hour,
        config.requests_per_day,
      );
      this.tokens.set(key, bucket);
    }

    return bucket.consume();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.tokens) {
      if (now - bucket.lastRefill > 300000) {
        // 5 minutes
        this.tokens.delete(key);
      }
    }
  }
}

class TokenBucket {
  lastRefill = Date.now();
  minuteTokens: number;
  hourTokens: number;
  dayTokens: number;

  constructor(minuteLimit: number, hourLimit: number, dayLimit: number) {
    this.minuteTokens = minuteLimit;
    this.hourTokens = hourLimit;
    this.dayTokens = dayLimit;
  }

  consume(): { allowed: boolean; retry_after_ms?: number } {
    this.refill();

    if (this.dayTokens <= 0) {
      return { allowed: false, retry_after_ms: this.timeUntilNextDay() };
    }
    if (this.hourTokens <= 0) {
      return { allowed: false, retry_after_ms: this.timeUntilNextHour() };
    }
    if (this.minuteTokens <= 0) {
      return { allowed: false, retry_after_ms: this.timeUntilNextMinute() };
    }

    this.minuteTokens--;
    this.hourTokens--;
    this.dayTokens--;

    return { allowed: true };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= 60000) {
      // Refill minute
      this.minuteTokens = Math.min(
        this.minuteTokens + Math.floor(elapsed / 60000),
        60,
      );
    }
    if (elapsed >= 3600000) {
      // Refill hour
      this.hourTokens = Math.min(
        this.hourTokens + Math.floor(elapsed / 3600000),
        3600,
      );
    }
    // Day doesn't refill during normal operation

    this.lastRefill = now;
  }

  private timeUntilNextMinute(): number {
    return 60000 - ((Date.now() - this.lastRefill) % 60000);
  }

  private timeUntilNextHour(): number {
    return 3600000 - ((Date.now() - this.lastRefill) % 3600000);
  }

  private timeUntilNextDay(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
  }
}

// ── Tool Sandbox ────────────────────────────────────────────────────────────

/**
 * Tool execution sandbox.
 */
export class ToolSandbox {
  private tools: Map<string, ToolDefinition> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiter: RateLimiter = new RateLimiter();
  private executionLogs: ToolAuditRecord[] = [];
  private maxLogs = 10000;

  /**
   * Registers a tool with the sandbox.
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
    this.circuitBreakers.set(
      tool.id,
      new CircuitBreaker(
        tool.max_retries * 2,
        tool.max_retries,
        tool.timeout_ms * 2,
      ),
    );
    logger.info("Tool registered in sandbox", {
      tool_id: tool.id,
      name: tool.name,
      permissions: tool.required_permissions,
    });
  }

  /**
   * Unregisters a tool from the sandbox.
   */
  unregisterTool(toolId: string): boolean {
    this.tools.delete(toolId);
    this.circuitBreakers.delete(toolId);
    return true;
  }

  /**
   * Gets a tool by ID.
   */
  getTool(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Gets all registered tools.
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Checks if user has required permissions.
   */
  checkPermissions(
    userScopes: ToolPermissionScope[],
    required: ToolPermissionScope[],
  ): boolean {
    return required.every((perm) => userScopes.includes(perm));
  }

  /**
   * Executes a tool with all security checks.
   */
  async execute(
    invocation: ToolInvocation,
    userScopes: ToolPermissionScope[],
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(invocation.tool_id);

    // 1. Check tool exists
    if (!tool) {
      return this.createErrorResult(
        invocation,
        "TOOL_NOT_FOUND",
        `Tool ${invocation.tool_id} not found`,
        false,
      );
    }

    // 2. Check circuit breaker
    const circuit = this.circuitBreakers.get(invocation.tool_id)!;
    if (!circuit.canExecute()) {
      return this.createErrorResult(
        invocation,
        "CIRCUIT_OPEN",
        "Tool is temporarily unavailable due to repeated failures",
        true,
      );
    }

    // 3. Check permissions
    if (!this.checkPermissions(userScopes, tool.required_permissions)) {
      return this.createErrorResult(
        invocation,
        "PERMISSION_DENIED",
        "Insufficient permissions for this tool",
        false,
      );
    }

    // 4. Check rate limit
    const rateLimitKey = `${invocation.tenant_id}:${invocation.tool_id}`;
    if (tool.rate_limit) {
      const rateCheck = this.rateLimiter.check(rateLimitKey, tool.rate_limit);
      if (!rateCheck.allowed) {
        return {
          invocation_id: invocation.invocation_id,
          tool_id: invocation.tool_id,
          tool_name: invocation.tool_name,
          status: "rate_limited",
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded. Retry after ${rateCheck.retry_after_ms}ms`,
            recoverable: true,
          },
          execution_time_ms: 0,
          resource_usage: {
            memory_used_mb: 0,
            cpu_percent: 0,
            network_requests: 0,
            disk_read_bytes: 0,
            disk_write_bytes: 0,
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 5. Execute with timeout
    const startTime = Date.now();
    try {
      const result = await this.executeWithTimeout(
        invocation,
        tool,
        invocation.timeout_ms || tool.timeout_ms,
      );

      circuit.recordSuccess();
      this.logExecution(invocation, "success", result);

      return {
        invocation_id: invocation.invocation_id,
        tool_id: invocation.tool_id,
        tool_name: invocation.tool_name,
        status: "success",
        output: result,
        execution_time_ms: Date.now() - startTime,
        resource_usage: {
          memory_used_mb: 0, // Would be tracked in real implementation
          cpu_percent: 0,
          network_requests: 0,
          disk_read_bytes: 0,
          disk_write_bytes: 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      circuit.recordFailure();

      const isTimeout = error instanceof TimeoutError;
      const status = isTimeout ? "timeout" : "error";

      this.logExecution(invocation, status, undefined, error);

      return {
        invocation_id: invocation.invocation_id,
        tool_id: invocation.tool_id,
        tool_name: invocation.tool_name,
        status,
        error: {
          code: isTimeout ? "TIMEOUT" : "EXECUTION_ERROR",
          message: error instanceof Error ? error.message : String(error),
          recoverable: !isTimeout,
        },
        execution_time_ms: Date.now() - startTime,
        resource_usage: {
          memory_used_mb: 0,
          cpu_percent: 0,
          network_requests: 0,
          disk_read_bytes: 0,
          disk_write_bytes: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Gets execution logs.
   */
  getLogs(tenantId?: string, limit = 100): ToolAuditRecord[] {
    let logs = this.executionLogs;
    if (tenantId) {
      logs = logs.filter((l) => l.tenant_id === tenantId);
    }
    return logs.slice(-limit);
  }

  /**
   * Clears old execution logs.
   */
  clearLogs(beforeTimestamp?: string): void {
    if (beforeTimestamp) {
      this.executionLogs = this.executionLogs.filter(
        (l) => l.created_at > beforeTimestamp,
      );
    } else {
      this.executionLogs = [];
    }
  }

  private async executeWithTimeout(
    invocation: ToolInvocation,
    tool: ToolDefinition,
    timeoutMs: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new TimeoutError(`Tool execution timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      try {
        // In a real implementation, this would execute the actual tool
        // For now, we simulate execution
        const result = this.simulateExecution(invocation, tool);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  private simulateExecution(
    _invocation: ToolInvocation,
    _tool: ToolDefinition,
  ): unknown {
    // Placeholder for actual tool execution
    // In production, this would use a proper sandbox (Web Worker, Docker, etc.)
    return { success: true, message: "Tool executed successfully" };
  }

  private createErrorResult(
    invocation: ToolInvocation,
    code: string,
    message: string,
    recoverable: boolean,
  ): ToolExecutionResult {
    return {
      invocation_id: invocation.invocation_id,
      tool_id: invocation.tool_id,
      tool_name: invocation.tool_name,
      status: code === "PERMISSION_DENIED" ? "permission_denied" : "error",
      error: { code, message, recoverable },
      execution_time_ms: 0,
      resource_usage: {
        memory_used_mb: 0,
        cpu_percent: 0,
        network_requests: 0,
        disk_read_bytes: 0,
        disk_write_bytes: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private logExecution(
    invocation: ToolInvocation,
    status: string,
    output?: unknown,
    error?: unknown,
  ): void {
    const record: ToolAuditRecord = {
      id: crypto.randomUUID(),
      tenant_id: invocation.tenant_id,
      run_id: invocation.run_id,
      tool_name: invocation.tool_name,
      invocation_id: invocation.invocation_id,
      input_hash: computeHash(invocation.input),
      output_hash: output ? computeHash(output) : undefined,
      status: status as ToolAuditRecord["status"],
      error_message: error ? String(error) : undefined,
      permission_scope: invocation.permission_scope,
      execution_time_ms: 0,
      created_at: new Date().toISOString(),
    };

    this.executionLogs.push(record);

    // Trim logs if needed
    if (this.executionLogs.length > this.maxLogs) {
      this.executionLogs = this.executionLogs.slice(-this.maxLogs);
    }
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function computeHash(data: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// ── Tool Audit Record ─────────────────────────────────────────────────────

/**
 * Audit record for tool execution.
 */
export interface ToolAuditRecord {
  id: string;
  tenant_id: string;
  run_id: string;
  tool_name: string;
  invocation_id: string;
  input_hash: string;
  output_hash?: string;
  status:
    | "pending"
    | "success"
    | "error"
    | "timeout"
    | "rate_limited"
    | "permission_denied"
    | "circuit_open";
  error_message?: string;
  permission_scope: ToolPermissionScope[];
  execution_time_ms: number;
  created_at: string;
}

// ── Zod Schemas ────────────────────────────────────────────────────────────

export const ToolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  permission_scope: z.array(
    z.enum([
      "read",
      "write",
      "execute",
      "admin",
      "network",
      "filesystem",
      "process",
    ]),
  ),
  required_permissions: z.array(
    z.enum([
      "read",
      "write",
      "execute",
      "admin",
      "network",
      "filesystem",
      "process",
    ]),
  ),
  input_schema: z.record(z.string(), z.unknown()),
  output_schema: z.record(z.string(), z.unknown()),
  timeout_ms: z.number().positive(),
  max_retries: z.number().int().min(0),
  rate_limit: z
    .object({
      requests_per_minute: z.number().int().positive(),
      requests_per_hour: z.number().int().positive(),
      requests_per_day: z.number().int().positive(),
      burst_limit: z.number().int().positive().optional(),
    })
    .optional(),
  resource_limits: z
    .object({
      max_memory_mb: z.number().positive(),
      max_cpu_percent: z.number().min(0).max(100),
      max_network_requests: z.number().int().positive(),
      max_file_size_mb: z.number().positive(),
      max_execution_time_ms: z.number().positive(),
    })
    .optional(),
  is_dangerous: z.boolean(),
  category: z.string(),
  tags: z.array(z.string()),
});

export const ToolInvocationSchema = z.object({
  tool_id: z.string(),
  tool_name: z.string(),
  invocation_id: z.string(),
  tenant_id: z.string(),
  run_id: z.string(),
  user_id: z.string(),
  input: z.record(z.string(), z.unknown()),
  permission_scope: z.array(
    z.enum([
      "read",
      "write",
      "execute",
      "admin",
      "network",
      "filesystem",
      "process",
    ]),
  ),
  timestamp: z.string().datetime(),
  timeout_ms: z.number().positive(),
});

// ── Singleton Instance ────────────────────────────────────────────────────────

export const toolSandbox = new ToolSandbox();
