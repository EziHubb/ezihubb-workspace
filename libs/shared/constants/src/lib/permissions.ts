/**
 * Hybrid RBAC + ABAC permission system.
 *
 * Each ADMIN (shop owner) has a `permissions` JSON field on their User record:
 * {
 *   "roles": ["editor"],
 *   "overrides": {
 *     "allow": ["orders:refund"],
 *     "deny":  ["products:delete"]
 *   },
 *   "conditions": {
 *     "orders:view": { "owner_only": true },
 *     "reports:export": { "max_rows": 1000 }
 *   }
 * }
 *
 * Evaluation order (deny wins):
 *   1. overrides.deny  → explicit deny, return false immediately
 *   2. overrides.allow → explicit allow, return true immediately
 *   3. roles           → role-based grant check
 *   4. default         → false
 *
 * SUPER_ADMIN always passes every check — no document needed.
 */

// ── Resources & Actions ────────────────────────────────────────────────────────

export const PERMISSION_RESOURCES = [
  'dashboard',
  'products',
  'orders',
  'reviews',
  'payouts',
  'analytics',
  'settings',
  'shipping',
  'coupons',
  'messages',
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export const PERMISSION_ACTIONS = ['view', 'edit', 'add', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const RESOURCE_ACTIONS: Record<PermissionResource, PermissionAction[]> = {
  dashboard: ['view'],
  products:  ['view', 'edit', 'add', 'delete'],
  orders:    ['view', 'edit'],
  reviews:   ['view', 'edit', 'delete'],
  payouts:   ['view', 'edit'],
  analytics: ['view'],
  settings:  ['view', 'edit'],
  shipping:  ['view', 'edit', 'add', 'delete'],
  coupons:   ['view', 'edit', 'add', 'delete'],
  messages:  ['view', 'edit'],
};

// ── Built-in roles ─────────────────────────────────────────────────────────────

export const BUILTIN_ROLES = {
  /** Full shop management — granted on store approval. */
  shop_owner: [
    'dashboard:view',
    'products:view',  'products:edit',  'products:add',  'products:delete',
    'orders:view',    'orders:edit',
    'reviews:view',   'reviews:edit',   'reviews:delete',
    'payouts:view',   'payouts:edit',
    'analytics:view',
    'settings:view',  'settings:edit',
    'shipping:view',  'shipping:edit',  'shipping:add',  'shipping:delete',
    'coupons:view',   'coupons:edit',   'coupons:add',   'coupons:delete',
    'messages:view',  'messages:edit',
  ],
  /** Can manage content but not financial or destructive actions. */
  editor: [
    'dashboard:view',
    'products:view',  'products:edit',  'products:add',
    'orders:view',    'orders:edit',
    'reviews:view',
    'analytics:view',
    'settings:view',
    'messages:view',  'messages:edit',
  ],
  /** Read-only access. */
  viewer: [
    'dashboard:view',
    'products:view',
    'orders:view',
    'analytics:view',
    'messages:view',
  ],
} as const;

export type BuiltinRole = keyof typeof BUILTIN_ROLES;
export const BUILTIN_ROLE_NAMES = Object.keys(BUILTIN_ROLES) as BuiltinRole[];

// ── Permission Document (stored as JSON in DB) ─────────────────────────────────

export interface PermissionDocument {
  /** One or more built-in role names. All granted permissions are unioned. */
  roles: string[];
  overrides?: {
    /** Permissions added on top of what the roles grant. */
    allow?: string[];
    /** Permissions removed even if a role would grant them. Deny wins over allow. */
    deny?:  string[];
  };
  /** Attribute-based conditions keyed by "resource:action". */
  conditions?: Record<string, Record<string, unknown>>;
}

/** Default document set when a store is approved. */
export const DEFAULT_PERMISSION_DOCUMENT: PermissionDocument = {
  roles: ['shop_owner'],
};

// Aliases kept for backward compatibility with existing imports
export type AdminPermissions    = PermissionDocument;
export const DEFAULT_SHOP_PERMISSIONS = DEFAULT_PERMISSION_DOCUMENT;

// ── Core runtime check ─────────────────────────────────────────────────────────

/**
 * Returns true when the user is allowed to perform `permission` ("resource:action").
 *
 * @param systemRole  - "SUPER_ADMIN" | "ADMIN" | "CUSTOMER"
 * @param permDoc     - The user's PermissionDocument from DB (null → use defaults)
 * @param permission  - e.g. "products:delete"
 */
export function can(
  systemRole: string,
  permDoc:    PermissionDocument | null | undefined,
  permission: string,
): boolean {
  if (systemRole === 'SUPER_ADMIN') return true;
  if (systemRole !== 'ADMIN')       return false;

  const doc = permDoc ?? DEFAULT_PERMISSION_DOCUMENT;

  // 1. Explicit deny wins over everything
  if (doc.overrides?.deny?.includes(permission)) return false;

  // 2. Explicit allow
  if (doc.overrides?.allow?.includes(permission)) return true;

  // 3. Role-based check (union of all assigned roles)
  for (const role of doc.roles) {
    const rolePerms = BUILTIN_ROLES[role as BuiltinRole];
    if (rolePerms && (rolePerms as readonly string[]).includes(permission)) return true;
  }

  return false;
}

/** Convenience overload using (resource, action) pair. */
export function canDo(
  systemRole: string,
  permDoc:    PermissionDocument | null | undefined,
  resource:   PermissionResource,
  action:     PermissionAction,
): boolean {
  return can(systemRole, permDoc, `${resource}:${action}`);
}

/** Returns the conditions object for a given permission, or null. */
export function getConditions(
  permDoc:    PermissionDocument | null | undefined,
  permission: string,
): Record<string, unknown> | null {
  return permDoc?.conditions?.[permission] ?? null;
}

// ── Effective permission map (for frontend UI gating) ─────────────────────────

/**
 * Returns a flat map of every known "resource:action" → boolean for the user.
 * SUPER_ADMIN gets all true. Useful for embedding in JWT / session.
 */
export function resolveEffectivePermissions(
  systemRole: string,
  permDoc:    PermissionDocument | null | undefined,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const resource of PERMISSION_RESOURCES) {
    for (const action of RESOURCE_ACTIONS[resource]) {
      const perm = `${resource}:${action}`;
      result[perm] = can(systemRole, permDoc, perm);
    }
  }
  return result;
}

/**
 * Returns the effective PermissionDocument for display/session storage.
 * @deprecated Use resolveEffectivePermissions for the flat map instead.
 */
export function resolvePermissions(
  systemRole: string,
  permDoc:    PermissionDocument | null | undefined,
): PermissionDocument {
  if (systemRole === 'SUPER_ADMIN') {
    return {
      roles: ['shop_owner'],
      overrides: {
        allow: PERMISSION_RESOURCES.flatMap((r) =>
          RESOURCE_ACTIONS[r].map((a) => `${r}:${a}`),
        ),
      },
    };
  }
  return permDoc ?? DEFAULT_PERMISSION_DOCUMENT;
}
