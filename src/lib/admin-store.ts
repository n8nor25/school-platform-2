import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SCHOOL_ID } from '@/lib/constants'

interface SchoolOption {
  id: string
  name: string
  subdomain: string
  primaryColor: string
}

interface AdminUser {
  id: string
  username: string
  role: string
  schoolId: string
  permissions: string
}

interface AdminStore {
  _hasHydrated: boolean
  isAdminMode: boolean
  adminView: string
  isAuthenticated: boolean
  adminUser: AdminUser | null
  sidebarOpen: boolean
  selectedSchoolId: string
  schools: SchoolOption[]
  setHasHydrated: (state: boolean) => void
  setAdminMode: (mode: boolean) => void
  setAdminView: (view: string) => void
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  setSidebarOpen: (open: boolean) => void
  setSelectedSchoolId: (id: string) => void
  setSchools: (schools: SchoolOption[]) => void
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      isAdminMode: false,
      adminView: 'dashboard',
      isAuthenticated: false,
      adminUser: null,
      sidebarOpen: false,
      selectedSchoolId: '',
      schools: [],

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setAdminMode: (mode) => set({ isAdminMode: mode, adminView: 'dashboard' }),

      setAdminView: (view) => set({ adminView: view, sidebarOpen: false }),

      login: async (username, password) => {
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })
          if (res.ok) {
            const data = await res.json()
            const user: AdminUser = {
              id: data.id,
              username: data.username,
              role: data.role,
              schoolId: data.schoolId,
              permissions: data.permissions,
            }

            // For school_admin, auto-select their school
            // For super_admin, show school switcher normally (don't override selectedSchoolId)
            if (data.role === 'school_admin') {
              set({
                isAuthenticated: true,
                adminUser: user,
                isAdminMode: true,
                adminView: 'dashboard',
                selectedSchoolId: data.schoolId,
              })
            } else {
              set({
                isAuthenticated: true,
                adminUser: user,
                isAdminMode: true,
                adminView: 'dashboard',
              })
            }
            return true
          }
          return false
        } catch {
          return false
        }
      },

      logout: () =>
        set({
          isAdminMode: false,
          isAuthenticated: false,
          adminUser: null,
          adminView: 'dashboard',
          sidebarOpen: false,
        }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setSelectedSchoolId: (id) => set({ selectedSchoolId: id }),

      setSchools: (schools) => {
        const currentState = get()
        // Keep existing selection if it still exists in the new list, otherwise pick first
        const existingId = currentState.selectedSchoolId
        const stillValid = existingId && schools.some(s => s.id === existingId)
        const newSelectedId = stillValid
          ? existingId
          : (schools.length > 0 ? schools[0].id : SCHOOL_ID)
        set({ schools, selectedSchoolId: newSelectedId })
      },
    }),
    {
      name: 'school-platform-store',
      // Persist selectedSchoolId, schools, and adminUser (role/schoolId across refreshes)
      partialize: (state) => ({
        selectedSchoolId: state.selectedSchoolId,
        schools: state.schools,
        adminUser: state.adminUser,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
