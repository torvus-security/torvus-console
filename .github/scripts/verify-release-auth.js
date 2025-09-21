#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CANONICAL_FIELDS = [
  'request_id',
  'title',
  'status',
  'approved_by',
  'issued_at',
  'expires_at'
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function canonicalisePayload(payload) {
  return JSON.stringify(payload, CANONICAL_FIELDS);
}

function readAuthorization(filePath) {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    return fs.readFileSync(absolutePath, 'utf8');
  } catch (error) {
    fail(`Failed to read authorization file: ${error.message}`);
  }
}

function parseAuthorization(rawContent) {
  try {
    return JSON.parse(rawContent);
  } catch (error) {
    fail('Authorization file is not valid JSON.');
  }
}

function timingSafeCompare(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function validateTimestamps(issuedAt, expiresAt) {
  const issuedDate = new Date(issuedAt);
  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(issuedDate.getTime())) {
    fail('Authorization manifest has an invalid issued_at timestamp.');
  }
  if (Number.isNaN(expiresDate.getTime())) {
    fail('Authorization manifest has an invalid expires_at timestamp.');
  }
  const now = new Date();
  if (expiresDate <= now) {
    fail('Release authorization has expired.');
  }
  const maxWindowMs = 15 * 60 * 1000;
  if (expiresDate.getTime() - issuedDate.getTime() > maxWindowMs + 5000) {
    fail('Release authorization has an invalid expiry window.');
  }
}

function main() {
  const signingKey = process.env.RELEASE_EXECUTOR_SIGNING_KEY;
  if (!signingKey) {
    fail('RELEASE_EXECUTOR_SIGNING_KEY environment variable is required for verification.');
  }

  const [, , filePath] = process.argv;
  if (!filePath) {
    fail('Usage: node verify-release-auth.js <authorization.json>');
  }

  const rawContent = readAuthorization(filePath);
  const authorization = parseAuthorization(rawContent);

  for (const field of [...CANONICAL_FIELDS, 'signature']) {
    if (!(field in authorization)) {
      fail(`Authorization manifest is missing the ${field} field.`);
    }
  }

  if (authorization.status !== 'approved') {
    fail('Release authorization status must be approved.');
  }

  if (!Array.isArray(authorization.approved_by)) {
    fail('Authorization manifest approved_by field must be an array.');
  }

  const payload = {
    request_id: String(authorization.request_id),
    title: String(authorization.title),
    status: 'approved',
    approved_by: authorization.approved_by.map((value) => String(value)),
    issued_at: String(authorization.issued_at),
    expires_at: String(authorization.expires_at)
  };

  validateTimestamps(payload.issued_at, payload.expires_at);

  const canonicalPayload = canonicalisePayload(payload);
  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(canonicalPayload)
    .digest('base64url');

  if (!timingSafeCompare(expectedSignature, String(authorization.signature))) {
    fail('Release authorization signature is invalid.');
  }
}

main();
