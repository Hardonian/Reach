#!/usr/bin/env node
/**
 * Reach Health Ping
 * 
 * Lightweight health check for the Reach daemon.
 * Returns 0 if healthy, non-zero if unhealthy.
 * 
 * Usage:
 *   node scripts/reach-health.mjs [host:port]
 * 
 * Environment:
 *   REACH_ENGINE_HOST - Override host:port (default: 127.0.0.1:9000)
 */

import { ProtocolClient } from '../src/protocol/client.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 9000;

function parseHostPort(arg) {
  if (arg) {
    const [host, port] = arg.split(':');
    return { host: host || DEFAULT_HOST, port: parseInt(port || DEFAULT_PORT, 10) };
  }
  
  if (process.env.REACH_ENGINE_HOST) {
    const [host, port] = process.env.REACH_ENGINE_HOST.split(':');
    return { host: host || DEFAULT_HOST, port: parseInt(port || DEFAULT_PORT, 10) };
  }
  
  return { host: DEFAULT_HOST, port: DEFAULT_PORT };
}

async function main() {
  const args = process.argv.slice(2);
  const { host, port } = parseHostPort(args[0]);
  
  const detailed = args.includes('--detailed') || args.includes('-d');
  
  console.log(`Checking health of ${host}:${port}...`);
  
  const client = new ProtocolClient({
    host,
    port,
    connectTimeoutMs: 5000,
    requestTimeoutMs: 10000,
    autoReconnect: false,
  });
  
  try {
    await client.connect();
    const health = await client.health(detailed);
    
    console.log('');
    console.log('Status:', health.status.type);
    console.log('Version:', health.version);
    console.log('Uptime:', formatDuration(health.uptime_us));
    
    if (detailed && health.load) {
      console.log('');
      console.log('Load Metrics:');
      console.log('  Active runs:', health.load.active_runs);
      console.log('  Queued runs:', health.load.queued_runs);
      console.log('  CPU:', (health.load.cpu_bps / 100).toFixed(1) + '%');
      console.log('  Memory:', (health.load.memory_bps / 100).toFixed(1) + '%');
    }
    
    await client.disconnect();
    
    if (health.status.type === 'healthy') {
      console.log('');
      console.log('✓ Daemon is healthy');
      process.exit(0);
    } else {
      console.log('');
      console.log('✗ Daemon is', health.status.type);
      if (health.status.reason) {
        console.log('  Reason:', health.status.reason);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('✗ Health check failed:', error.message);
    process.exit(2);
  }
}

function formatDuration(micros) {
  const seconds = Number(micros) / 1_000_000;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds)}s`;
}

main();
