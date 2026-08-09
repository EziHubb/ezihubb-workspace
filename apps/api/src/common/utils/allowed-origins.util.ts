// Shared source of truth for the CORS whitelist (apps/api/src/main.ts) and the
// CSRF origin check (apps/api/src/common/guards/origin-check.guard.ts) — both
// need to agree on which origins are trusted first-party frontends.

export function getConfiguredOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isWildcardOrigin(origins: string[]): boolean {
  return origins.includes('*');
}

export function getAllowedOrigins(): Set<string> {
  return new Set(
    [...getConfiguredOrigins(), process.env.APP_URL, process.env.ADMIN_URL].filter(
      (o): o is string => !!o && o !== '*',
    ),
  );
}
