function asOptionalString(value) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requireName(value) {
  const normalized = asOptionalString(value);
  return normalized || 'missing';
}

function labelKind(value) {
  return value === 'known' ? 'yes' : 'no';
}

function hasKindLabel(value) {
  return Boolean(labelKind(value));
}

function statusGate(status) {
  return status === 'active' && status !== 'banned';
}

function statusGateTruthiness(status) {
  return Boolean(statusGate(status));
}

function stableFlag() {
  return true;
}

function stableFlagTruthiness() {
  return Boolean(stableFlag() || 'fallback');
}

module.exports = {
  asOptionalString,
  requireName,
  labelKind,
  hasKindLabel,
  statusGate,
  statusGateTruthiness,
  stableFlag,
  stableFlagTruthiness,
};
