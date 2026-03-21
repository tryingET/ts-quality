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

Use `ts-quality attest sign` to create them and `ts-quality attest verify` to validate them against trusted public keys. Verification output now renders from the same structured verification record used by `check` artifacts, so CLI review and persisted run artifacts stay in sync. Human-readable text remains the default, and `attest verify --json` returns the same versioned verification record in machine-readable form. Text output keeps the signed subject visible by printing `subjectFile`, and when that subject is run-scoped under `.ts-quality/runs/<run-id>/`, it also prints the derived `runId` and artifact name. `payload.runId` and `payload.artifactName` are only valid for run-scoped subjects; verification fails closed when they do not match the signed `subjectFile` path or when they appear on a non-run-scoped subject. Signing and verification now share the same render-safe metadata policy: blank issuers are rejected, signed issuer/subject metadata cannot contain control, Unicode next-line, line/paragraph separator, or bidi override/isolation characters, and human-readable fallback labels plus CLI error text are escaped before rendering when they contain unsafe characters. Single-file CLI verification treats an unreadable attestation path as an operator error with a non-zero exit, while malformed JSON or schema-invalid attestation content still reports through the canonical verification record. Persisted run artifacts redact raw OS read-error detail and report unreadable attestation files through a stable generic reason. Legitimacy flows only trust attestations that bind to repo-local artifacts under the exact evaluated run boundary.
