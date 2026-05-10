'use client'

import React from 'react'
import {
  LayoutDashboard, FileBarChart, GraduationCap, Newspaper,
  Image, Settings, Users, Calendar, LogOut, Menu, X, School,
  SlidersHorizontal, LayoutGrid, UserCog, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminStore } from '@/lib/admin-store'
import { Dashboard } from './dashboard'
import { ResultsManagement } from './results-management'
import { GradesManagement } from './grades-management'
import { NewsManagement } from './news-management'
import { GalleryManagement } from './gallery-management'
import { SettingsManagement } from './settings-management'
import { TeachersManagement } from './teachers-management'
import { SchedulesManagement } from './schedules-management'
import { SliderManagement } from './slider-management'
import { SectionsManagement } from './sections-management'
import { UsersManagement } from './users-management'
import { SchoolsManagement } from './schools-management'

const navItems = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { key: 'sliders', label: 'إدارة السلايدر', icon: SlidersHorizontal },
  { key: 'sections', label: 'أقسام الصفحة', icon: LayoutGrid },
  { key: 'results', label: 'إدارة النتائج', icon: FileBarChart },
  { key: 'grades', label: 'إدارة الصفوف', icon: GraduationCap },
  { key: 'news', label: 'إدارة الأخبار', icon: Newspaper },
  { key: 'gallery', label: 'معرض الصور', icon: Image },
  { key: 'teachers', label: 'إدارة المعلمين', icon: Users },
  { key: 'schedules', label: 'جداول الحصص', icon: Calendar },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
  { key: 'users', label: 'إدارة المستخدمين', icon: UserCog, superAdminOnly: true },
  { key: 'schools', label: 'إدارة المدارس', icon: Building2, superAdminOnly: true },
]

function renderView(view: string) {
  switch (view) {
    case 'dashboard': return <Dashboard />
    case 'sliders': return <SliderManagement />
    case 'sections': return <SectionsManagement />
    case 'results': return <ResultsManagement />
    case 'grades': return <GradesManagement />
    case 'news': return <NewsManagement />
    case 'gallery': return <GalleryManagement />
    case 'teachers': return <TeachersManagement />
    case 'schedules': return <SchedulesManagement />
    case 'settings': return <SettingsManagement />
    case 'users': return <UsersManagement />
    case 'schools': return <SchoolsManagement />
    default: return <Dashboard />
  }
}

export function AdminLayout() {
  const { adminView, setAdminView, logout, adminUser, sidebarOpen, setSidebarOpen, selectedSchoolId, schools, setSelectedSchoolId } = useAdminStore()

  const isSuperAdmin = adminUser?.role === 'super_admin'

  // Filter schools: school_admin can only see their own school
  const visibleSchools = isSuperAdmin
    ? schools
    : schools.filter(s => s.id === adminUser?.schoolId)

  const visibleNavItems = navItems.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  )

  return (
    <div className="min-h-screen flex bg-gray-100" dir="rtl">
      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed right-0 top-0 h-full w-64 bg-[#1a1a2e] text-white z-50 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center">
                <School className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-sm">لوحة الإدارة</h2>
                <p className="text-white/50 text-xs">{adminUser?.username || 'المشرف'}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mr-auto lg:hidden text-white hover:bg-white/10"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setAdminView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  adminView === item.key
                    ? 'bg-[#610000] text-white shadow-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-white/10 space-y-1">
            <button
              onClick={() => { logout(); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors min-h-[44px]"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
            <button
              onClick={() => { logout(); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors min-h-[44px]"
            >
              <School className="w-5 h-5 shrink-0" />
              <span>العودة للموقع</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden min-h-[44px] min-w-[44px]"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-bold text-[#1a1a2e]">
                {visibleNavItems.find((n) => n.key === adminView)?.label || 'لوحة التحكم'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* School Switcher - only show for super_admin with multiple schools */}
              {isSuperAdmin && visibleSchools.length > 1 && (
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                  <SelectTrigger className="w-[200px] h-9 text-sm">
                    <School className="w-4 h-4 ml-1.5 text-gray-400" />
                    <SelectValue placeholder="اختر مدرسة" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleSchools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Show current school name for school_admin */}
              {!isSuperAdmin && visibleSchools.length === 1 && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md">
                  <School className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{visibleSchools[0].name}</span>
                </div>
              )}
              <span className="text-sm text-gray-500 hidden sm:block">
                مرحباً، {adminUser?.username || 'المشرف'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[44px]"
              >
                <LogOut className="w-4 h-4 ml-1.5" />
                خروج
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {renderView(adminView)}
        </main>
      </div>
    </div>
  )
}
