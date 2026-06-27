'use client'

import React, { useState, useEffect } from 'react'
import {
  Bus as BusIcon, Printer, AlertCircle, User, Phone, Hash,
  MapPin, Clock, Users, FileText
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface Bus {
  id: string
  plateNumber: string
  driverName: string
}

interface ReportStudent {
  id: string
  name: string
  studentNumber: string
  address: string | null
  phone: string | null
  parentName: string | null
  parentPhone: string | null
  parentPhone2: string | null
  classroom: { name: string; gradeLevel: string } | null
}

interface ReportSubscription {
  id: string
  direction: string
  monthlyFee: number
  status: string
  student: ReportStudent
}

interface ReportRoute {
  id: string
  name: string
  area: string
  morningTime: string | null
  afternoonTime: string | null
  monthlyFee: number
  stops: string
  studentsCount: number
  subscriptions: ReportSubscription[]
}

interface ReportData {
  bus: {
    id: string
    plateNumber: string
    driverName: string
    driverPhone: string | null
    supervisorName: string | null
    supervisorPhone: string | null
    capacity: number
    model: string | null
    color: string | null
  }
  routes: ReportRoute[]
}

export function BusPassengerReport() {
  const { selectedSchoolId } = useAdminStore()
  const [buses, setBuses] = useState<Bus[]>([])
  const [busesLoading, setBusesLoading] = useState(true)
  const [selectedBusId, setSelectedBusId] = useState<string>('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Load buses list
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId) return
      try {
        setBusesLoading(true)
        const res = await fetch(`/api/buses?schoolId=${selectedSchoolId}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setBuses(Array.isArray(data.buses) ? data.buses : [])
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل الباصات')
      } finally {
        if (!cancelled) setBusesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load report when bus is selected
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId || !selectedBusId) {
        if (!cancelled) setReport(null)
        return
      }
      try {
        setReportLoading(true)
        const res = await fetch(
          `/api/buses/${selectedBusId}/report?schoolId=${selectedSchoolId}`
        )
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setReport(data)
        } else if (!cancelled) {
          toast.error('فشل في تحميل التقرير')
          setReport(null)
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل التقرير')
          setReport(null)
        }
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedBusId])

  const handlePrint = () => {
    window.print()
  }

  const totalStudents = report?.routes.reduce((sum, r) => sum + r.studentsCount, 0) || 0

  return (
    <div className="space-y-6">
      {/* Controls (hidden when printing) */}
      <div className="print:hidden space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#610000]" />
            كشف بيانات الباص
          </h2>
          {report && (
            <Button
              onClick={handlePrint}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              <Printer className="w-4 h-4 ml-1" />
              طباعة التقرير
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[280px]">
                <Label>اختر الباص</Label>
                <Select
                  value={selectedBusId}
                  onValueChange={setSelectedBusId}
                >
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue
                      placeholder={busesLoading ? 'جاري التحميل...' : 'اختر الباص...'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {buses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.plateNumber} - {b.driverName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {buses.length === 0 && !busesLoading && (
              <p className="text-sm text-amber-600 mt-2">
                لا توجد باصات مسجلة. أضف باصاً أولاً.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loading state */}
      {reportLoading && (
        <div className="print:hidden space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {/* No selection prompt */}
      {!selectedBusId && !busesLoading && (
        <Card className="print:hidden">
          <CardContent className="py-16 text-center">
            <BusIcon className="w-16 h-16 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 font-medium">اختر باصاً من القائمة لعرض كشف البيانات</p>
            <p className="text-sm text-gray-400 mt-1">
              سيعرض التقرير جميع الخطوط والطلاب المشتركين في الباص
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {report && !reportLoading && (
        <div className="bg-white print:bg-white">
          {/* Print-only header */}
          <div className="hidden print:block mb-4 text-center border-b-2 border-[#610000] pb-3">
            <h1 className="text-2xl font-bold text-[#610000]">كشف بيانات باص الطلاب</h1>
            <p className="text-sm text-gray-600 mt-1">
              تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}
            </p>
          </div>

          {/* Bus header */}
          <Card className="border-2 border-[#610000]/20 print:shadow-none print:border-2 print:border-[#610000]">
            <CardContent className="p-5">
              <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#610000] flex items-center justify-center print:bg-[#610000]">
                    <BusIcon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1a1a2e]">
                      باص رقم: {report.bus.plateNumber}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {report.bus.model || 'غير محدد'}
                      {report.bus.color ? ` - ${report.bus.color}` : ''}
                    </p>
                  </div>
                </div>
                <Badge className="bg-[#610000] text-white hover:bg-[#610000] print:bg-[#610000]">
                  السعة: {report.bus.capacity} راكب
                </Badge>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-[#610000]" />
                    <span className="text-gray-500">السائق:</span>
                    <span className="font-medium text-[#1a1a2e]">{report.bus.driverName}</span>
                  </div>
                  {report.bus.driverPhone && (
                    <div className="flex items-center gap-2 text-sm" dir="ltr">
                      <Phone className="w-4 h-4 text-[#610000]" />
                      <span className="font-medium">{report.bus.driverPhone}</span>
                      <span className="text-gray-500 text-xs">(هاتف السائق)</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {report.bus.supervisorName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-[#610000]" />
                      <span className="text-gray-500">المشرف:</span>
                      <span className="font-medium text-[#1a1a2e]">
                        {report.bus.supervisorName}
                      </span>
                    </div>
                  )}
                  {report.bus.supervisorPhone && (
                    <div className="flex items-center gap-2 text-sm" dir="ltr">
                      <Phone className="w-4 h-4 text-[#610000]" />
                      <span className="font-medium">{report.bus.supervisorPhone}</span>
                      <span className="text-gray-500 text-xs">(هاتف المشرف)</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-[#610000]/5 print:bg-[#610000]/5 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">عدد الخطوط</p>
              <p className="text-2xl font-bold text-[#610000]">{report.routes.length}</p>
            </div>
            <div className="bg-[#610000]/5 print:bg-[#610000]/5 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">إجمالي الطلاب</p>
              <p className="text-2xl font-bold text-[#610000]">{totalStudents}</p>
            </div>
            <div className="bg-[#610000]/5 print:bg-[#610000]/5 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">السعة الإجمالية</p>
              <p className="text-2xl font-bold text-[#610000]">{report.bus.capacity}</p>
            </div>
          </div>

          {/* Routes section */}
          {report.routes.length === 0 ? (
            <Card className="mt-4">
              <CardContent className="py-10 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">لا توجد خطوط مسجلة لهذا الباص</p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 space-y-5">
              {report.routes.map((route, routeIdx) => (
                <div
                  key={route.id}
                  className="border border-gray-200 rounded-lg overflow-hidden print:break-inside-avoid print:page-break-inside-avoid"
                >
                  {/* Route header */}
                  <div className="bg-[#610000] text-white p-3 print:bg-[#610000]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                          {routeIdx + 1}
                        </span>
                        <h4 className="font-bold text-base">{route.name}</h4>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {route.studentsCount} طالب
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash className="w-4 h-4" />
                          {Number(route.monthlyFee).toLocaleString()} ج.م
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-white/90">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {route.area}
                      </span>
                      {route.morningTime && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Clock className="w-3.5 h-3.5" />
                          صباحاً: {route.morningTime}
                        </span>
                      )}
                      {route.afternoonTime && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Clock className="w-3.5 h-3.5" />
                          ظهراً: {route.afternoonTime}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Students table */}
                  <div className="bg-white">
                    {route.subscriptions.length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-sm">
                        لا يوجد طلاب مشتركون في هذا الخط
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 print:bg-gray-100">
                            <TableHead className="text-center w-12">#</TableHead>
                            <TableHead className="text-right">اسم الطالب</TableHead>
                            <TableHead className="text-right">رقم الطالب</TableHead>
                            <TableHead className="text-right">الصف</TableHead>
                            <TableHead className="text-right">العنوان</TableHead>
                            <TableHead className="text-right">هاتف ولي الأمر 1</TableHead>
                            <TableHead className="text-right">هاتف ولي الأمر 2</TableHead>
                            <TableHead className="text-right">الاتجاه</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {route.subscriptions.map((sub, idx) => (
                            <TableRow
                              key={sub.id}
                              className="print:break-inside-avoid"
                            >
                              <TableCell className="text-center text-sm text-gray-500">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="font-medium text-[#1a1a2e]">
                                {sub.student.name}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600" dir="ltr">
                                {sub.student.studentNumber}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {sub.student.classroom?.name || '—'}
                                {sub.student.classroom?.gradeLevel ? (
                                  <span className="block text-xs text-gray-400">
                                    {sub.student.classroom.gradeLevel}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {sub.student.address || '—'}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600" dir="ltr">
                                {sub.student.parentPhone || sub.student.phone || '—'}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600" dir="ltr">
                                {sub.student.parentPhone2 || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="text-[#610000] border-[#610000]/30 text-xs"
                                >
                                  {sub.direction}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Print footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
            <p>تم إنشاء هذا التقرير بواسطة نظام إدارة المدرسة</p>
            <p className="mt-1">{new Date().toLocaleString('ar-EG')}</p>
          </div>
        </div>
      )}

      {/* Print-specific CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\:hidden {
            display: none !important;
          }
          /* Show only the report */
          .print\:hidden + *,
          .print\:hidden ~ * {
            visibility: visible;
          }
          @page {
            size: A4 landscape;
            margin: 1.5cm;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  )
}
