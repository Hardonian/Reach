import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const protocolV1Dir = path.join(repoRoot, 'protocol', 'v1');
const examplesDir = path.join(repoRoot, 'protocol', 'examples');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mustString(value, field, errors) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${field} must be a non-empty string.`);
  }
}

function mustArray(value, field, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array.`);
  }
}

function validateSchemaShape(schema, expectedIdSuffix) {
  const errors = [];
  if (!isObject(schema)) {
    errors.push('schema must be an object.');
    return errors;
  }
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('schema must declare draft 2020-12.');
  }
  if (typeof schema.$id !== 'string' || !schema.$id.endsWith(expectedIdSuffix)) {
    errors.push(`$id must end with ${expectedIdSuffix}.`);
  }
  if (!isObject(schema.properties)) {
    errors.push('schema must define properties.');
  }
  return errors;
}

function validateSession(payload, ctx, errors) {
  if (!isObject(payload)) {
    errors.push(`${ctx} must be an object.`);
    return;
  }
  if (payload.schemaVersion !== '1.0.0') errors.push(`${ctx}.schemaVersion must be "1.0.0".`);
  mustString(payload.sessionId, `${ctx}.sessionId`, errors);
  mustString(payload.tenantId, `${ctx}.tenantId`, errors);
  mustString(payload.status, `${ctx}.status`, errors);
  mustString(payload.startedAt, `${ctx}.startedAt`, errors);
  mustArray(payload.members, `${ctx}.members`, errors);
}

function validateSpawn(payload, ctx, errors) {
  if (!isObject(payload)) {
    errors.push(`${ctx} must be an object.`);
    return;
  }
  if (payload.schemaVersion !== '1.0.0') errors.push(`${ctx}.schemaVersion must be "1.0.0".`);
  mustString(payload.spawnId, `${ctx}.spawnId`, errors);
  mustString(payload.sessionId, `${ctx}.sessionId`, errors);
  mustString(payload.goal, `${ctx}.goal`, errors);
  if (!Number.isInteger(payload.depth) || payload.depth < 0) errors.push(`${ctx}.depth must be a non-negative integer.`);
  mustString(payload.status, `${ctx}.status`, errors);
}

function validateConnector(payload, ctx, errors) {
  if (!isObject(payload)) {
    errors.push(`${ctx} must be an object.`);
    return;
  }
  if (payload.schemaVersion !== '1.0.0') errors.push(`${ctx}.schemaVersion must be "1.0.0".`);
  mustString(payload.connectorId, `${ctx}.connectorId`, errors);
  mustString(payload.provider, `${ctx}.provider`, errors);
  mustArray(payload.scopes, `${ctx}.scopes`, errors);
}

function validateCapsule(payload, ctx, errors) {
  if (!isObject(payload)) {
    errors.push(`${ctx} must be an object.`);
    return;
  }
  if (payload.schemaVersion !== '1.0.0') errors.push(`${ctx}.schemaVersion must be "1.0.0".`);
  mustString(payload.capsuleId, `${ctx}.capsuleId`, errors);
  validateSession(payload.session, `${ctx}.session`, errors);
  validateSpawn(payload.spawn, `${ctx}.spawn`, errors);
  if (payload.connectors !== undefined) {
    mustArray(payload.connectors, `${ctx}.connectors`, errors);
    for (const [idx, connector] of (payload.connectors ?? []).entries()) {
      validateConnector(connector, `${ctx}.connectors[${idx}]`, errors);
    }
  }
}

function validateEventFixture(event, fileName) {
  const errors = [];
  if (!isObject(event)) {
    return ['fixture must be a JSON object.'];
  }
  if (event.schemaVersion !== '1.0.0') errors.push('event.schemaVersion must be "1.0.0".');
  mustString(event.eventId, 'event.eventId', errors);
  mustString(event.type, 'event.type', errors);
  mustString(event.timestamp, 'event.timestamp', errors);

  switch (event.type) {
    case 'spawn.event':
      validateSpawn(event.payload, 'event.payload', errors);
      break;
    case 'guardrail.stop': {
      if (!isObject(event.payload)) {
        errors.push('event.payload must be an object.');
        break;
      }
      if (event.payload.schemaVersion !== '1.0.0') errors.push('event.payload.schemaVersion must be "1.0.0".');
      mustString(event.payload.reason, 'event.payload.reason', errors);
      mustString(event.payload.triggeredBy, 'event.payload.triggeredBy', errors);
      mustString(event.payload.runId, 'event.payload.runId', errors);
      break;
    }
    case 'session.started':
      validateSession(event.payload, 'event.payload', errors);
      break;
    case 'capsule.sync':
      validateCapsule(event.payload, 'event.payload', errors);
      break;
    default:
      errors.push(`unsupported event.type in ${fileName}: ${String(event.type)}.`);
  }

  return errors;
}

function main() {
  const schemaFiles = ['event.schema.json', 'session.schema.json', 'spawn.schema.json', 'connector.schema.json', 'capsule.schema.json'];
  const fixtureFiles = ['spawn_event.json', 'guardrail_stop.json', 'session_started.json', 'capsule_sync.json'];
  const allErrors = [];

  for (const fileName of schemaFiles) {
    const schemaPath = path.join(protocolV1Dir, fileName);
    const schema = readJson(schemaPath);
    const errors = validateSchemaShape(schema, fileName);
    for (const error of errors) {
      allErrors.push(`protocol/v1/${fileName}: ${error}`);
    }
  }

  for (const fileName of fixtureFiles) {
    const fixturePath = path.join(examplesDir, fileName);
    const fixture = readJson(fixturePath);
    const errors = validateEventFixture(fixture, fileName);
    for (const error of errors) {
      allErrors.push(`protocol/examples/${fileName}: ${error}`);
    }
  }

  if (allErrors.length > 0) {
    for (const error of allErrors) console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log('Protocol v1 schemas and fixtures validated.');
}

main();
