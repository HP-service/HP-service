import type { UserRole } from "@db/enums"

export type Permission =
  | "bookings:read"
  | "bookings:create"
  | "bookings:update"
  | "bookings:delete"
  | "guests:read"
  | "guests:create"
  | "guests:update"
  | "guests:delete"
  | "rooms:read"
  | "rooms:update"
  | "rooms:manage"
  | "finance:read"
  | "finance:manage"
  | "expenses:read"
  | "expenses:create"
  | "expenses:manage"
  | "tasks:read"
  | "tasks:read_own"
  | "tasks:update"
  | "tasks:manage"
  | "settings:read"
  | "settings:manage"
  | "staff:manage"
  | "scraping:read"
  | "scraping:manage"

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Manager: [
    "bookings:read", "bookings:create", "bookings:update", "bookings:delete",
    "guests:read", "guests:create", "guests:update", "guests:delete",
    "rooms:read", "rooms:update", "rooms:manage",
    "finance:read", "finance:manage",
    "expenses:read", "expenses:create", "expenses:manage",
    "tasks:read", "tasks:update", "tasks:manage",
    "settings:read", "settings:manage", "staff:manage",
    "scraping:read", "scraping:manage",
  ],
  Reception: [
    "bookings:read", "bookings:create", "bookings:update",
    "guests:read", "guests:create", "guests:update",
    "rooms:read", "rooms:update",
    "finance:read",
    "expenses:read", "expenses:create",
    "tasks:read", "tasks:update",
    "settings:read",
    "scraping:read",
  ],
  Housekeeping: [
    "rooms:read", "rooms:update",
    "tasks:read_own", "tasks:update",
    "bookings:read",
  ],
  Maintenance: [
    "rooms:read",
    "tasks:read_own", "tasks:update",
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

// Which roles can access which route groups
export const MAIN_APP_ROLES: UserRole[] = ["Manager", "Reception"]
export const PORTAL_ROLES: UserRole[] = ["Housekeeping", "Maintenance"]
