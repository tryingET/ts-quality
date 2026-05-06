"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRefreshExpired = isRefreshExpired;
exports.refreshSubject = refreshSubject;
function isRefreshExpired(token, nowMs) {
    return nowMs >= token.expiresAtMs;
}
function refreshSubject(token) {
    return token.subject;
}
//# sourceMappingURL=token.js.map
