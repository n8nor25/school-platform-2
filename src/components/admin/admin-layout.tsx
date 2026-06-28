'use client'

import React, { useState } from 'react'
import {
  LayoutDashboard, FileBarChart, GraduationCap, Newspaper,
  Image, Settings, Users, Calendar, LogOut, Menu, X, School,
  SlidersHorizontal, LayoutGrid, UserCog, Building2, UserPlus,
  ClipboardCheck, ChevronDown, BusFront, Bus, MapPin, CreditCard,
  FileText, Coins, Receipt, BarChart3, UsersRound, Briefcase,
  DollarSign, Palmtree, Printer, Wallet, Repeat, PiggyBank,
  Store, Tags, TrendingUp, LineChart,
  Megaphone, Mail, MessageSquare,
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
import { StudentsManagement } from './students-management'
import { AttendanceManagement } from './attendance-management'
import { EmployeeAttendanceManagement } from './employee-attendance-management'
import { BusFleetManagement } from './bus-fleet-management'
import { BusRoutesManagement } from './bus-routes-management'
import { TransportSubscriptionsManagement } from './transport-subscriptions-management'
import { BusPassengerReport } from './bus-passenger-report'
import { FeesStructure } from './fees-structure'
import { FeeAssignments } from './fee-assignments'
import { FeePaymentsManagement } from './fee-payments-management'
import { FeeStatements } from './fee-statements'
import { FinancialReports } from './financial-reports'
import { ExpenseCategoriesManagement } from './expense-categories-management'
import { ExpenseVendorsManagement } from './expense-vendors-management'
import { ExpensesManagement } from './expenses-management'
import { ExpenseBudgetsManagement } from './expense-budgets-management'
import { RecurringExpensesManagement } from './recurring-expenses-management'
import { PettyCashManagement } from './petty-cash-management'
import { ExpenseReports } from './expense-reports'
import { MessagesManagement } from './messages-management'
import { AnnouncementsManagement } from './announcements-management'

// ===== Nav Item Types =====
interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  superAdminOnly?: boolean
}

interface NavGroup {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: NavItem[]
  superAdminOnly?: boolean
}

type NavEntry = NavItem | NavGroup

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

// ===== Navigation Configuration =====
const navEntries: NavEntry[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { key: 'students', label: 'إدارة الطلاب', icon: UserPlus },
  { key: 'attendance', label: 'حضور الطلاب', icon: ClipboardCheck },
  {
    key: 'hr',
    label: 'شئون العاملين',
    icon: UsersRound,
    children: [
      { key: 'emp-attendance', label: 'الحضور والانصراف', icon: ClipboardCheck },
      { key: 'hr-leaves', label: 'الإجازات', icon: Palmtree },
    ],
  },
  {
    key: 'transport',
    label: 'النقل المدرسي',
    icon: BusFront,
    children: [
      { key: 'transport-fleet', label: 'الباصات والسائقين', icon: Bus },
      { key: 'transport-routes', label: 'خطوط السير', icon: MapPin },
      { key: 'transport-subscriptions', label: 'الاشتراكات والمدفوعات', icon: CreditCard },
      { key: 'transport-reports', label: 'كشوف الباصات', icon: Printer },
    ],
  },
  {
    key: 'fees',
    label: 'الأقساط والرسوم',
    icon: Coins,
    children: [
      { key: 'fees-structure', label: 'هيكل الرسوم', icon: Coins },
      { key: 'fee-assignments', label: 'تخصيص الرسوم', icon: Users },
      { key: 'fee-payments', label: 'تسجيل المدفوعات', icon: Receipt },
      { key: 'fee-statements', label: 'كشوف الحسابات', icon: FileText },
      { key: 'financial-reports', label: 'التقارير المالية', icon: BarChart3 },
    ],
  },
  {
    key: 'expenses',
    label: 'المصروفات والنفقات',
    icon: Wallet,
    children: [
      { key: 'expenses-list', label: 'تسجيل المصروفات', icon: DollarSign },
      { key: 'expense-categories', label: 'تصنيفات المصروفات', icon: Tags },
      { key: 'expense-vendors', label: 'الموردون والمستفيدون', icon: Store },
      { key: 'expense-budgets', label: 'الميزانيات', icon: PiggyBank },
      { key: 'recurring-expenses', label: 'المصروفات المتكررة', icon: Repeat },
      { key: 'petty-cash', label: 'العهد والصناديق', icon: Briefcase },
      { key: 'expense-reports', label: 'التقارير والإحصائيات', icon: LineChart },
    ],
  },
  {
    key: 'communication',
    label: 'التواصل والإشعارات',
    icon: Megaphone,
    children: [
      { key: 'messages', label: 'الرسائل الداخلية', icon: Mail },
      { key: 'announcements', label: 'الإعلانات', icon: Megaphone },
    ],
  },
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

// ===== View Title Helper =====
function getViewLabel(view: string): string {
  for (const entry of navEntries) {
    if (isNavGroup(entry)) {
      for (const child of entry.children) {
        if (child.key === view) return `${entry.label} - ${child.label}`
      }
    } else if (entry.key === view) {
      return entry.label
    }
  }
  return 'لوحة التحكم'
}

function renderView(view: string) {
  switch (view) {
    case 'dashboard': return <Dashboard />
    case 'students': return <StudentsManagement />
    case 'attendance': return <AttendanceManagement />
    case 'emp-attendance': return <EmployeeAttendanceManagement />
    case 'hr-leaves': return <EmployeeAttendanceManagement />
    case 'transport-fleet': return <BusFleetManagement />
    case 'transport-routes': return <BusRoutesManagement />
    case 'transport-subscriptions': return <TransportSubscriptionsManagement />
    case 'transport-reports': return <BusPassengerReport />
    case 'fees-structure': return <FeesStructure />
    case 'fee-assignments': return <FeeAssignments />
    case 'fee-payments': return <FeePaymentsManagement />
    case 'fee-statements': return <FeeStatements />
    case 'financial-reports': return <FinancialReports />
    case 'expenses-list': return <ExpensesManagement />
    case 'expense-categories': return <ExpenseCategoriesManagement />
    case 'expense-vendors': return <ExpenseVendorsManagement />
    case 'expense-budgets': return <ExpenseBudgetsManagement />
    case 'recurring-expenses': return <RecurringExpensesManagement />
    case 'petty-cash': return <PettyCashManagement />
    case 'expense-reports': return <ExpenseReports />
    case 'messages': return <MessagesManagement />
    case 'announcements': return <AnnouncementsManagement />
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const isSuperAdmin = adminUser?.role === 'super_admin'

  // Filter schools: school_admin can only see their own school
  const visibleSchools = isSuperAdmin
    ? schools
    : schools.filter(s => s.id === adminUser?.schoolId)

  // Check if any group child is active
  const isGroupChildActive = (groupPrefix: string) => adminView.startsWith(groupPrefix + '-')

  // Auto-expand group when its child is active
  const getGroupExpanded = (groupKey: string) => {
    if (isGroupChildActive(groupKey)) return true
    return expandedGroups[groupKey] || false
  }

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }))
  }

  const handleNavClick = (key: string) => {
    setAdminView(key)
  }

  const handleGroupClick = (groupKey: string, firstChildKey: string) => {
    const isExpanded = getGroupExpanded(groupKey)
    if (!isExpanded) {
      // Expand and select first child
      setExpandedGroups(prev => ({ ...prev, [groupKey]: true }))
      setAdminView(firstChildKey)
    } else {
      // Toggle collapse
      toggleGroup(groupKey)
    }
  }

  // Filter entries for visibility
  const visibleEntries = navEntries.filter(
    (entry) => !entry.superAdminOnly || isSuperAdmin
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
            {visibleEntries.map((entry) => {
              if (isNavGroup(entry)) {
                const isExpanded = getGroupExpanded(entry.key)
                const isGroupActive = entry.children.some(c => c.key === adminView)

                return (
                  <div key={entry.key} className="space-y-1">
                    {/* Group Header */}
                    <button
                      onClick={() => handleGroupClick(entry.key, entry.children[0].key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
                        isGroupActive
                          ? 'bg-[#610000]/80 text-white shadow-md'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <entry.icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1 text-right">{entry.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    </button>

                    {/* Sub-items with collapse animation */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="space-y-0.5 pr-4 border-r-2 border-white/10 mr-3">
                        {entry.children.map((child) => (
                          <button
                            key={child.key}
                            onClick={() => handleNavClick(child.key)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 min-h-[40px] ${
                              adminView === child.key
                                ? 'bg-[#610000] text-white shadow-sm'
                                : 'text-white/60 hover:bg-white/8 hover:text-white'
                            }`}
                          >
                            <child.icon className="w-4 h-4 shrink-0" />
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }

              // Regular nav item
              return (
                <button
                  key={entry.key}
                  onClick={() => handleNavClick(entry.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    adminView === entry.key
                      ? 'bg-[#610000] text-white shadow-md'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <entry.icon className="w-5 h-5 shrink-0" />
                  <span>{entry.label}</span>
                </button>
              )
            })}
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
                {getViewLabel(adminView)}
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
