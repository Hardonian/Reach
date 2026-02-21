/**
 * ReadyLayer Internal Telemetry Engine
 * 
 * Provides internal event tracking for:
 * - first_success_event
 * - gate_enabled_event
 * - monitor_created_event
 * - simulation_run_event
 * 
 * Includes internal metrics endpoint and event validation guard.
 * 
 * @module telemetry-engine
 */

import { z } from 'zod';

// ── Event Types ────────────────────────────────────────────────────────────────

/**
 * Internal telemetry event types.
 */
export type TelemetryEventType = 
  | 'first_success_event'
  | 'gate_enabled_event'
  | 'monitor_created_event'
  | 'simulation_run_event'
  | 'workflow_created'
  | 'workflow_executed'
  | 'pack_installed'
  | 'gate_triggered'
  | 'alert_triggered'
  | 'provider_switched';

/**
 * Telemetry event payload.
 */
export interface TelemetryEvent {
  id: string;
  event_type: TelemetryEventType;
  tenant_id?: string;
  user_id?: string;
  session_id?: string;
  properties: Record<string, unknown>;
  timestamp: string;
  validated: boolean;
  valid: boolean;
  validation_errors?: string[];
}

// ── Event Schemas ───────────────────────────────────────────────────────────

/**
 * Schema for first_success_event.
 */
export const FirstSuccessEventSchema = z.object({
  event_type: z.literal('first_success_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  workflow_id: z.string(),
  run_id: z.string(),
  latency_ms: z.number().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

/**
 * Schema for gate_enabled_event.
 */
export const GateEnabledEventSchema = z.object({
  event_type: z.literal('gate_enabled_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  gate_id: z.string(),
  gate_name: z.string(),
  repo_provider: z.string().optional(),
  repo_full_name: z.string().optional(),
  trigger_types: z.array(z.string()).optional(),
});

/**
 * Schema for monitor_created_event.
 */
export const MonitorCreatedEventSchema = z.object({
  event_type: z.literal('monitor_created_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  signal_id: z.string(),
  signal_type: z.string(),
  threshold_config: z.record(z.unknown()).optional(),
});

/**
 * Schema for simulation_run_event.
 */
export const SimulationRunEventSchema = z.object({
  event_type: z.literal('simulation_run_event'),
  tenant_id: z.string(),
  user_id: z.string(),
  scenario_id: z.string(),
  scenario_run_id: z.string(),
  variant_count: z.number().int().positive(),
  status: z.enum(['running', 'completed', 'failed']),
  duration_ms: z.number().optional(),
});

/**
 * Union schema for all event types.
 */
export const TelemetryEventSchema = z.union([
  FirstSuccessEventSchema,
  GateEnabledEventSchema,
  MonitorCreatedEventSchema,
  SimulationRunEventSchema,
  z.object({
    event_type: z.string(),
    tenant_id: z.string().optional(),
    user_id: z.string().optional(),
    properties: z.record(z.unknown()).optional(),
  }),
]);

// ── Event Validator ─────────────────────────────────────────────────────────

/**
 * Validates an event against its schema.
 */
export function validateEvent(data: unknown): {
  valid: boolean;
  errors?: string[];
  event?: TelemetryEvent;
} {
  const result = TelemetryEventSchema.safeParse(data);
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
  
  return {
    valid: true,
    event: {
      id: generateEventId(),
      event_type: result.data.event_type,
      tenant_id: result.data.tenant_id,
      user_id: result.data.user_id,
      properties: result.data.properties || {},
      timestamp: new Date().toISOString(),
      validated: true,
      valid: true,
    },
  };
}

/**
 * Guard function to validate event type.
 */
export function isValidEventType(type: string): type is TelemetryEventType {
  return [
    'first_success_event',
    'gate_enabled_event',
    'monitor_created_event',
    'simulation_run_event',
    'workflow_created',
    'workflow_executed',
    'pack_installed',
    'gate_triggered',
    'alert_triggered',
    'provider_switched',
  ].includes(type);
}

// ── Telemetry Collector ─────────────────────────────────────────────────────

/**
 * Internal telemetry collector.
 */
export class TelemetryCollector {
  private events: TelemetryEvent[] = [];
  private maxEvents = 10000;
  private listeners: ((event: TelemetryEvent) => void)[] = [];
  
  /**
   * Records a telemetry event.
   */
  record(data: unknown): TelemetryEvent | null {
    const validation = validateEvent(data);
    
    if (!validation.event) {
      console.warn('Invalid telemetry event:', validation.errors);
      return null;
    }
    
    this.events.push(validation.event);
    
    // Trim if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(validation.event);
      } catch (err) {
        console.error('Telemetry listener error:', err);
      }
    }
    
    return validation.event;
  }
  
  /**
   * Gets events filtered by type and tenant.
   */
  getEvents(options?: {
    eventType?: TelemetryEventType;
    tenantId?: string;
    since?: string;
    limit?: number;
  }): TelemetryEvent[] {
    let filtered = this.events;
    
    if (options?.eventType) {
      filtered = filtered.filter(e => e.event_type === options.eventType);
    }
    
    if (options?.tenantId) {
      filtered = filtered.filter(e => e.tenant_id === options.tenantId);
    }
    
    if (options?.since) {
      const since = new Date(options.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= since);
    }
    
    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }
    
    return filtered;
  }
  
  /**
   * Gets event counts by type.
   */
  getEventCounts(tenantId?: string): Record<TelemetryEventType, number> {
    let events = this.events;
    
    if (tenantId) {
      events = events.filter(e => e.tenant_id === tenantId);
    }
    
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    }
    
    return counts as Record<TelemetryEventType, number>;
  }
  
  /**
   * Gets aggregate metrics.
   */
  getMetrics(tenantId?: string): TelemetryMetrics {
    let events = this.events;
    
    if (tenantId) {
      events = events.filter(e => e.tenant_id === tenantId);
    }
    
    const counts = this.getEventCounts(tenantId);
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    
    const eventsLastHour = events.filter(e => new Date(e.timestamp).getTime() > hourAgo).length;
    const eventsLastDay = events.filter(e => new Date(e.timestamp).getTime() > dayAgo).length;
    
    return {
      total_events: events.length,
      events_last_hour: eventsLastHour,
      events_last_day: eventsLastDay,
      by_type: counts,
      oldest_event: events.length > 0 
        ? events.reduce((oldest, e) => 
            new Date(e.timestamp) < new Date(oldest) ? e.timestamp : oldest
          , events[0].timestamp)
        : null,
      newest_event: events.length > 0 
        ? events.reduce((newest, e) => 
            new Date(e.timestamp) > new Date(newest) ? e.timestamp : newest
          , events[0].timestamp)
        : null,
    };
  }
  
  /**
   * Adds an event listener.
   */
  addListener(listener: (event: TelemetryEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Clears all events.
   */
  clear(): void {
    this.events = [];
  }
  
  /**
   * Exports events for external consumption.
   */
  export(options?: {
    format?: 'json' | 'ndjson';
    since?: string;
    tenantId?: string;
  }): string {
    const events = this.getEvents({
      since: options?.since,
      tenantId: options?.tenantId,
    });
    
    if (options?.format === 'ndjson') {
      return events.map(e => JSON.stringify(e)).join('\n');
    }
    
    return JSON.stringify(events, null, 2);
  }
}

export interface TelemetryMetrics {
  total_events: number;
  events_last_hour: number;
  events_last_day: number;
  by_type: Record<TelemetryEventType, number>;
  oldest_event: string | null;
  newest_event: string | null;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ── Singleton Instance ────────────────────────────────────────────────────────

export const telemetryCollector = new TelemetryCollector();

// ── Event Trackers ────────────────────────────────────────────────────────────

/**
 * Tracks first_success_event.
 */
export function trackFirstSuccess(data: {
  tenant_id: string;
  user_id: string;
  workflow_id: string;
  run_id: string;
  latency_ms?: number;
  model?: string;
  provider?: string;
}): TelemetryEvent | null {
  return telemetryCollector.record({
    event_type: 'first_success_event',
    ...data,
  });
}

/**
 * Tracks gate_enabled_event.
 */
export function trackGateEnabled(data: {
  tenant_id: string;
  user_id: string;
  gate_id: string;
  gate_name: string;
  repo_provider?: string;
  repo_full_name?: string;
  trigger_types?: string[];
}): TelemetryEvent | null {
  return telemetryCollector.record({
    event_type: 'gate_enabled_event',
    ...data,
  });
}

/**
 * Tracks monitor_created_event.
 */
export function trackMonitorCreated(data: {
  tenant_id: string;
  user_id: string;
  signal_id: string;
  signal_type: string;
  threshold_config?: Record<string, unknown>;
}): TelemetryEvent | null {
  return telemetryCollector.record({
    event_type: 'monitor_created_event',
    ...data,
  });
}

/**
 * Tracks simulation_run_event.
 */
export function trackSimulationRun(data: {
  tenant_id: string;
  user_id: string;
  scenario_id: string;
  scenario_run_id: string;
  variant_count: number;
  status: 'running' | 'completed' | 'failed';
  duration_ms?: number;
}): TelemetryEvent | null {
  return telemetryCollector.record({
    event_type: 'simulation_run_event',
    ...data,
  });
}
