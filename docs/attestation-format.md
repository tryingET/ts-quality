---
summary: "Signed attestation JSON contract for ts-quality legitimacy flows."
read_when:
  - "When generating or verifying attestation artifacts"
  - "When checking the expected attestation payload format"
type: "reference"
---

# Attestation format

Attestations are signed JSON claims.

```json
{
  "version": "1",
  "kind": "attestation",
  "issuer": "ci.verify",
  "subjectType": "json-artifact",
  "subjectDigest": "sha256:...",
  "claims": ["ci.tests.passed"],
  "issuedAt": "2026-03-17T00:00:00.000Z",
  "payload": {
    "subjectFile": ".ts-quality/runs/<run-id>/verdict.json",
    "runId": "<run-id>",
    "artifactName": "verdict.json"
  },
  "signature": {
    "algorithm": "ed25519",
    "keyId": "ci.verify",
    "value": "base64-signature"
  }
}
```

Use `ts-quality attest sign` to create them and `ts-quality attest verify` to validate them against trusted public keys. Verification output now renders from the same structured verification record used by `check` artifacts, so CLI review and persisted run artifacts stay in sync. Human-readable text remains the default, and `attest verify --json` returns the same versioned verification record in machine-readable form. Signed subject digests bind to the exact file bytes on disk, so binary or malformed-byte subjects cannot change silently through UTF-8 replacement semantics. Text output keeps the signed subject visible by printing `subjectFile`, and when that subject is run-scoped under `.ts-quality/runs/<run-id>/`, it also prints the derived `runId` and artifact name. `payload.runId` and `payload.artifactName` are only valid for run-scoped subjects; signing and verification both fail closed when they do not match the signed `subjectFile` path or when they appear on a non-run-scoped subject. Signing reports missing repo-local subjects as missing input, signing and verification reject subjects that only appear repo-local through symlink escapes, and both commands now reject duplicate, unknown, missing-value, or subcommand-irrelevant CLI options instead of silently swallowing them. Human-readable fallback labels plus CLI error text are escaped before rendering when they contain unsafe characters, and renderable issuer/subject metadata cannot contain control, Unicode next-line, line/paragraph separator, bidi override/isolation, zero-width, BOM, or other invisible Unicode format characters. Single-file CLI verification treats an unreadable attestation path as an operator error with a non-zero exit, while malformed JSON or schema-invalid attestation content still reports through the canonical verification record. Persisted run artifacts redact raw OS read-error detail and report unreadable attestation files through a stable generic reason. Legitimacy flows only trust attestations that bind to realpath-contained repo-local artifacts under the exact evaluated run boundary.
