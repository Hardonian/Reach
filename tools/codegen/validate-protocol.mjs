import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const schemasDir = path.join(repoRoot, 'protocol', 'schemas');
const examplesDir = path.join(repoRoot, 'protocol', 'examples');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSchemaShape(schema, expectedIdSuffix) {
  const errors = [];

  if (!isObject(schema)) {
    errors.push('Schema must be a JSON object.');
    return errors;
  }

  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('Schema must declare draft 2020-12 via $schema.');
  }

  if (typeof schema.$id !== 'string' || !schema.$id.endsWith(expectedIdSuffix)) {
    errors.push(`Schema $id must end with ${expectedIdSuffix}.`);
  }

  if (schema.type !== 'object' && !Array.isArray(schema.oneOf)) {
    errors.push('Schema should describe an object or a discriminated union.');
  }

  return errors;
}

function validateVersionedObject(value, context, errors) {
  if (!isObject(value)) {
    errors.push(`${context} must be an object.`);
    return;
  }

  if (value.schemaVersion !== '0.1.0') {
    errors.push(`${context}.schemaVersion must be "0.1.0".`);
  }
}

function validateEventLine(event, lineNumber) {
  const errors = [];
  const prefix = `line ${lineNumber}`;

  validateVersionedObject(event, `${prefix} event`, errors);

  const requiredStrings = ['eventId', 'runId', 'type', 'timestamp'];
  for (const key of requiredStrings) {
    if (typeof event?.[key] !== 'string' || event[key].length === 0) {
      errors.push(`${prefix} event.${key} must be a non-empty string.`);
    }
  }

  if (!isObject(event?.payload)) {
    errors.push(`${prefix} event.payload must be an object.`);
    return errors;
  }

  validateVersionedObject(event.payload, `${prefix} payload`, errors);

  switch (event.type) {
    case 'run.started': {
      if (typeof event.payload.initiator !== 'string' || event.payload.initiator.length === 0) {
        errors.push(`${prefix} payload.initiator must be a non-empty string.`);
      }
      break;
    }
    case 'tool.call': {
      if (typeof event.payload.callId !== 'string' || event.payload.callId.length === 0) {
        errors.push(`${prefix} payload.callId must be a non-empty string.`);
      }
      if (typeof event.payload.toolName !== 'string' || event.payload.toolName.length === 0) {
        errors.push(`${prefix} payload.toolName must be a non-empty string.`);
      }
      if (!isObject(event.payload.input)) {
        errors.push(`${prefix} payload.input must be an object.`);
      }
      break;
    }
    case 'tool.result': {
      if (typeof event.payload.callId !== 'string' || event.payload.callId.length === 0) {
        errors.push(`${prefix} payload.callId must be a non-empty string.`);
      }
      if (!['ok', 'error'].includes(event.payload.status)) {
        errors.push(`${prefix} payload.status must be "ok" or "error".`);
      }
      if (event.payload.status === 'ok' && !isObject(event.payload.output)) {
        errors.push(`${prefix} payload.output must be an object when status is "ok".`);
      }
      if (event.payload.status === 'error') {
        if (!isObject(event.payload.error) || typeof event.payload.error.message !== 'string' || event.payload.error.message.length === 0) {
          errors.push(`${prefix} payload.error.message is required when status is "error".`);
        }
      }
      break;
    }
    case 'artifact.created': {
      if (typeof event.payload.artifactId !== 'string' || event.payload.artifactId.length === 0) {
        errors.push(`${prefix} payload.artifactId must be a non-empty string.`);
      }
      if (typeof event.payload.uri !== 'string' || event.payload.uri.length === 0) {
        errors.push(`${prefix} payload.uri must be a non-empty string.`);
      }
      if (typeof event.payload.mediaType !== 'string' || event.payload.mediaType.length === 0) {
        errors.push(`${prefix} payload.mediaType must be a non-empty string.`);
      }
      break;
    }
    case 'run.completed': {
      if (!['succeeded', 'failed', 'cancelled'].includes(event.payload.status)) {
        errors.push(`${prefix} payload.status must be one of succeeded|failed|cancelled.`);
      }
      break;
    }
    default:
      errors.push(`${prefix} event.type is unknown: ${String(event.type)}.`);
  }

  return errors;
}

function main() {
  const schemaFiles = [
    ['events.schema.json', 'events.schema.json'],
    ['toolcall.schema.json', 'toolcall.schema.json'],
    ['artifact.schema.json', 'artifact.schema.json'],
    ['plugin-manifest.schema.json', 'plugin-manifest.schema.json']
  ];

  const allErrors = [];

  for (const [fileName, idSuffix] of schemaFiles) {
    const schemaPath = path.join(schemasDir, fileName);
    const schema = readJson(schemaPath);
    const errors = validateSchemaShape(schema, idSuffix);
    for (const error of errors) {
      allErrors.push(`${path.relative(repoRoot, schemaPath)}: ${error}`);
    }
  }

  const ndjsonPath = path.join(examplesDir, 'run-event.ndjson');
  const lines = fs.readFileSync(ndjsonPath, 'utf8').split('\n').filter(Boolean);

  for (const [index, line] of lines.entries()) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      allErrors.push(`${path.relative(repoRoot, ndjsonPath)} line ${index + 1}: invalid JSON (${error.message}).`);
      continue;
    }

    const lineErrors = validateEventLine(parsed, index + 1);
    for (const error of lineErrors) {
      allErrors.push(`${path.relative(repoRoot, ndjsonPath)} ${error}`);
    }
  }

  if (allErrors.length > 0) {
    for (const error of allErrors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Protocol schemas and NDJSON examples validated.');
}

main();
