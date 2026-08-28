import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerSchema, validate } from '@hyperjump/json-schema/draft-07';
import { BASIC } from '@hyperjump/json-schema/experimental';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = path.join(ROOT_DIR, 'scripts/vendor/dtcg/2025.10');
export const FORMAT_SCHEMA_URL = 'https://www.designtokens.org/schemas/2025.10/format.json';
export const RESOLVER_SCHEMA_URL = 'https://www.designtokens.org/schemas/2025.10/resolver.json';

let schemasRegistered = false;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readPinnedChecksums() {
  const checksumPath = path.join(SCHEMA_DIR, 'SHA256SUMS');
  const entries = fs
    .readFileSync(checksumPath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
      if (!match) throw new Error(`Invalid DTCG schema checksum line: ${line}`);
      return [match[2], match[1]];
    });
  return new Map(entries);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function verifyPinnedDtcgSchemaSnapshots() {
  const expected = readPinnedChecksums();
  for (const name of ['format.json', 'resolver.json']) {
    const expectedHash = expected.get(name);
    if (!expectedHash) throw new Error(`Missing pinned SHA-256 for ${name}`);
    const actualHash = sha256(path.join(SCHEMA_DIR, name));
    if (actualHash !== expectedHash) {
      throw new Error(`Vendored DTCG schema ${name} changed: expected ${expectedHash}, got ${actualHash}`);
    }
  }
}

function registerPinnedSchemas() {
  if (schemasRegistered) return;
  verifyPinnedDtcgSchemaSnapshots();

  const formatSchema = readJson(path.join(SCHEMA_DIR, 'format.json'));
  const resolverSchema = readJson(path.join(SCHEMA_DIR, 'resolver.json'));
  if (formatSchema.$id !== FORMAT_SCHEMA_URL) {
    throw new Error(`Unexpected vendored DTCG Format schema id: ${formatSchema.$id}`);
  }
  if (resolverSchema.$id !== RESOLVER_SCHEMA_URL) {
    throw new Error(`Unexpected vendored DTCG Resolver schema id: ${resolverSchema.$id}`);
  }

  registerSchema(formatSchema, FORMAT_SCHEMA_URL);
  registerSchema(resolverSchema, RESOLVER_SCHEMA_URL);
  schemasRegistered = true;
}

function summarizeErrors(output) {
  if (!output?.errors?.length) return JSON.stringify(output);
  return output.errors
    .flatMap((error) => [error, ...(error.errors ?? [])])
    .filter((error) => error.valid === false)
    .slice(0, 12)
    .map((error) => `${error.instanceLocation || '<root>'}: ${error.keyword}`)
    .join('; ');
}

async function assertSchemaValid(schemaUrl, value, label) {
  registerPinnedSchemas();
  const output = await validate(schemaUrl, value, BASIC);
  if (!output.valid) {
    throw new Error(`${label} does not validate against ${schemaUrl}: ${summarizeErrors(output)}`);
  }
  return output;
}

export async function validateOfficialDtcg2025_10({ canonical, resolver }) {
  await assertSchemaValid(FORMAT_SCHEMA_URL, canonical, 'BeeUI canonical token document');
  await assertSchemaValid(RESOLVER_SCHEMA_URL, resolver, 'BeeUI resolver document');
}

export async function validateOfficialDtcgFormat(value) {
  return assertSchemaValid(FORMAT_SCHEMA_URL, value, 'DTCG token document');
}

export async function validateOfficialDtcgResolver(value) {
  return assertSchemaValid(RESOLVER_SCHEMA_URL, value, 'DTCG resolver document');
}
