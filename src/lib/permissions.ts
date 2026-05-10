// Define available permissions per role
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'dashboard',
    'sliders',
    'results',
    'grades',
    'news',
    'gallery',
    'teachers',
    'schedules',
    'settings',
    'users',
    'schools',
    'sections',
  ],
  school_admin: [
    'dashboard',
    'sliders',
    'results',
    'grades',
    'news',
    'gallery',
    'teachers',
    'schedules',
    'settings',
    'sections',
  ],
}

// Check if a user has permission for a specific section
export function hasPermission(
  role: string,
  section: string,
  customPermissions?: string
): boolean {
  // super_admin has all permissions
  if (role === 'super_admin') return true

  // Check custom permissions from user.permissions JSON
  if (customPermissions) {
    try {
      const perms = JSON.parse(customPermissions)
      if (typeof perms[section] === 'boolean') return perms[section]
    } catch {
      // Invalid JSON, fall through to role defaults
    }
  }

  // Fall back to role defaults
  const rolePerms = ROLE_PERMISSIONS[role] || []
  return rolePerms.includes(section)
}

// Get list of allowed nav items for a role
export function getAllowedSections(
  role: string,
  customPermissions?: string
): string[] {
  if (role === 'super_admin') return ROLE_PERMISSIONS.super_admin

  const defaults = ROLE_PERMISSIONS[role] || []
  if (!customPermissions) return defaults

  try {
    const perms = JSON.parse(customPermissions)
    return defaults.filter((section) => perms[section] !== false)
  } catch {
    return defaults
  }
}
