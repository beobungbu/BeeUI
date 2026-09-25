#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, isScalar, parseAllDocuments } from 'yaml';

// Every other CI contract test reads workflows as text, so a file GitHub cannot
// load (a second `on:` key, a missing `jobs:` map) passed all of them and was
// only rejected after it reached main. This parses each workflow the way
// GitHub does and checks the minimum shape GitHub requires before it will
// schedule anything.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_DIR = '.github/workflows';
const JOB_ID_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function keyName(pair) {
  return isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
}

function mapKeys(node) {
  return node.items.map(keyName);
}

function hasKey(node, key) {
  return mapKeys(node).includes(key);
}

export function checkWorkflowSource(source, name = 'workflow') {
  // The YAML 1.2 core schema keeps `on` a string key; YAML 1.1 would read it as
  // boolean true. uniqueKeys (the default) rejects a repeated key, which is the
  // exact error GitHub raised for the duplicate `on:`.
  const documents = parseAllDocuments(source, { uniqueKeys: true, prettyErrors: true });
  const list = Array.isArray(documents) ? documents : [documents];
  if (list.length !== 1) {
    return [`${name}: expected exactly one YAML document, found ${list.length}`];
  }

  const [doc] = list;
  if (doc.errors.length > 0) {
    return doc.errors.map((error) => `${name}: YAML parse error: ${error.message}`);
  }

  const root = doc.contents;
  if (!isMap(root)) return [`${name}: top level must be a mapping`];

  const errors = [];
  const keys = mapKeys(root);

  const onCount = keys.filter((key) => key === 'on').length;
  if (onCount !== 1) errors.push(`${name}: expected exactly one \`on\` key, found ${onCount}`);

  const jobsPair = root.items.find((pair) => keyName(pair) === 'jobs');
  if (!jobsPair) {
    errors.push(`${name}: missing \`jobs\` map`);
    return errors;
  }
  if (!isMap(jobsPair.value) || jobsPair.value.items.length === 0) {
    errors.push(`${name}: \`jobs\` must be a non-empty map`);
    return errors;
  }

  for (const jobPair of jobsPair.value.items) {
    const jobId = keyName(jobPair);
    if (!JOB_ID_RE.test(jobId)) {
      errors.push(`${name}: job id \`${jobId}\` must start with a letter or _ and contain only alphanumerics, - or _`);
    }
    const job = jobPair.value;
    if (!isMap(job)) {
      errors.push(`${name}: job \`${jobId}\` must be a map`);
      continue;
    }
    const runsOn = hasKey(job, 'runs-on');
    const uses = hasKey(job, 'uses');
    if (!runsOn && !uses) {
      errors.push(`${name}: job \`${jobId}\` needs \`runs-on\` or a reusable-workflow \`uses\``);
    } else if (runsOn && uses) {
      errors.push(`${name}: job \`${jobId}\` cannot set both \`runs-on\` and \`uses\``);
    }
  }

  return errors;
}

export function listWorkflowFiles(root = repoRoot) {
  return readdirSync(path.join(root, WORKFLOW_DIR))
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .map((file) => `${WORKFLOW_DIR}/${file}`);
}

export function checkWorkflows(root = repoRoot) {
  const files = listWorkflowFiles(root);
  const errors = files.flatMap((file) => checkWorkflowSource(readFileSync(path.join(root, file), 'utf8'), file));
  return { files, errors };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { files, errors } = checkWorkflows();
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`workflow shape ok: ${files.length} files`);
}
