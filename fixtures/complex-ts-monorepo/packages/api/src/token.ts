export interface RefreshToken {
  subject: string;
  expiresAtMs: number;
}

export function isRefreshExpired(token: RefreshToken, nowMs: number): boolean {
  return nowMs >= token.expiresAtMs;
}

export function refreshSubject(token: RefreshToken): string {
  return token.subject;
}
