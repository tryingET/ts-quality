function isRefreshExpired(token, nowMs) {
  return nowMs >= token.expiresAtMs;
}

function canRefresh(token, nowMs) {
  return !isRefreshExpired(token, nowMs);
}

module.exports = { isRefreshExpired, canRefresh };
