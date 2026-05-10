'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Upload, Save, Trash2, FileSpreadsheet, AlertCircle, CheckCircle2, Archive, ArchiveRestore, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface ResultItem {
  id: string
  gradeName: string
  term: string
  studentCount: number
  uploadDate: string
  archived: boolean
  createdAt: string
}

interface ParsedStudent {
  seatNumber?: string | number
  studentName?: string
  [key: string]: unknown
}

export function ResultsManagement() {
  const [results, setResults] = useState<ResultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gradeName, setGradeName] = useState('')
  const [term, setTerm] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewStudents, setPreviewStudents] = useState<ParsedStudent[]>([])
  const [previewGradeName, setPreviewGradeName] = useState('')
  const [previewTerm, setPreviewTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const { selectedSchoolId } = useAdminStore()

  const fetchResults = useCallback(async () => {
    if (!selectedSchoolId) return
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (showArchived) {
        params.set('includeArchived', 'true')
      }
      const res = await fetch(`/api/results?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل النتائج')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/results/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) {
        toast.success('تم أرشفة النتائج بنجاح')
        fetchResults()
      } else {
        toast.error('فشل في أرشفة النتائج')
      }
    } catch {
      toast.error('فشل في أرشفة النتائج')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/results/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) {
        toast.success('تم استعادة النتائج بنجاح')
        fetchResults()
      } else {
        toast.error('فشل في استعادة النتائج')
      }
    } catch {
      toast.error('فشل في استعادة النتائج')
    }
  }

  const handleUpload = async () => {
    if (!selectedSchoolId) {
      toast.error('يرجى اختيار المدرسة أولاً من القائمة العلوية')
      return
    }
    if (!gradeName || !term || !file) {
      toast.error('يرجى اختيار الصف والترم وملف Excel')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('gradeName', gradeName)
      formData.append('term', term)
      formData.append('schoolId', selectedSchoolId)

      const res = await fetch('/api/results/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setPreviewStudents(data.students || [])
        setPreviewGradeName(data.gradeName || gradeName)
        setPreviewTerm(data.term || term)
        toast.success(`تم تحليل الملف - ${data.totalStudents} طالب`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'فشل في تحليل الملف')
      }
    } catch {
      toast.error('فشل في رفع الملف')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (previewStudents.length === 0) return
    if (!selectedSchoolId) {
      toast.error('يرجى اختيار المدرسة أولاً من القائمة العلوية')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeName: previewGradeName,
          term: previewTerm,
          students: previewStudents,
          schoolId: selectedSchoolId,
        }),
      })

      if (res.ok) {
        toast.success('تم حفظ النتائج بنجاح')
        setPreviewStudents([])
        setPreviewGradeName('')
        setPreviewTerm('')
        setGradeName('')
        setTerm('')
        setFile(null)
        fetchResults()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'فشل في حفظ النتائج')
      }
    } catch {
      toast.error('فشل في حفظ النتائج')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/results/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف النتائج بنجاح')
        fetchResults()
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        toast.error('فشل في حذف النتائج')
      }
    } catch {
      toast.error('فشل في حذف النتائج')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => fetch(`/api/results/${id}`, { method: 'DELETE' }))
      )
      toast.success(`تم حذف ${selectedIds.size} نتيجة`)
      setSelectedIds(new Set())
      fetchResults()
    } catch {
      toast.error('فشل في حذف بعض النتائج')
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(results.map((r) => r.id)))
    }
  }

  const subjectHeaders = previewStudents.length > 0
    ? Object.keys(previewStudents[0]).filter((k) => k !== 'seatNumber' && k !== 'studentName')
    : []

  const subjectLabels: Record<string, string> = {
    arabic: 'عربي', english: 'انجليزي', math: 'رياضيات', science: 'علوم',
    socialStudies: 'دراسات', religion: 'دين', art: 'فنية', computer: 'كمبيوتر',
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-5 h-5 text-[#610000]" />
            رفع نتائج جديدة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">الصف</label>
              <Select value={gradeName} onValueChange={setGradeName}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="اختر الصف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="الصف الأول">الصف الأول</SelectItem>
                  <SelectItem value="الصف الثاني">الصف الثاني</SelectItem>
                  <SelectItem value="الصف الثالث">الصف الثالث</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الترم</label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="اختر الترم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="الفصل الأول">الفصل الأول</SelectItem>
                  <SelectItem value="الفصل الثاني">الفصل الثاني</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ملف Excel</label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                className="h-11"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <Button
            onClick={handleUpload}
            disabled={uploading || !gradeName || !term || !file || !selectedSchoolId}
            className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري التحليل...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                تحليل الملف
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previewStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              معاينة النتائج ({previewStudents.length} طالب)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
              <Badge variant="outline">{previewGradeName}</Badge>
              <Badge variant="outline">{previewTerm}</Badge>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">#</th>
                    <th className="px-3 py-2 text-right font-medium">رقم الجلوس</th>
                    <th className="px-3 py-2 text-right font-medium">اسم الطالب</th>
                    {subjectHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 text-right font-medium">
                        {subjectLabels[h] || h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewStudents.slice(0, 20).map((s, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">{s.seatNumber ?? '-'}</td>
                      <td className="px-3 py-2 font-medium">{s.studentName ?? '-'}</td>
                      {subjectHeaders.map((h) => (
                        <td key={h} className="px-3 py-2">{s[h] ?? '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewStudents.length > 20 && (
                <div className="p-2 text-center text-xs text-gray-400 bg-gray-50">
                  عرض أول 20 طالب من أصل {previewStudents.length}
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !selectedSchoolId}
                className="bg-green-600 hover:bg-green-700 text-white min-h-[44px]"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري الحفظ...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    حفظ النتائج
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={() => setPreviewStudents([])} className="min-h-[44px]">
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Saved Results Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-[#610000]" />
              النتائج المحفوظة
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                className="min-h-[44px] gap-1"
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? <Eye className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                {showArchived ? 'إخفاء المؤرشف' : 'المؤرشف'}
                {results.filter(r => r.archived).length > 0 && (
                  <Badge variant="secondary" className="mr-1 px-1.5 py-0 text-xs">
                    {results.filter(r => r.archived).length}
                  </Badge>
                )}
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4 ml-1" />
                  حذف المحدد ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">لا توجد نتائج محفوظة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-right">
                      <Checkbox
                        checked={selectedIds.size === results.length && results.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="px-3 py-2 text-right font-medium">الصف</th>
                    <th className="px-3 py-2 text-right font-medium">الترم</th>
                    <th className="px-3 py-2 text-right font-medium">عدد الطلاب</th>
                    <th className="px-3 py-2 text-right font-medium">تاريخ الرفع</th>
                    <th className="px-3 py-2 text-right font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className={`border-t hover:bg-gray-50 ${r.archived ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{r.gradeName}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{r.term}</Badge>
                      </td>
                      <td className="px-3 py-2 font-medium">{r.studentCount}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {r.archived && (
                            <Badge className="text-xs bg-amber-100 text-amber-700">مؤرشف</Badge>
                          )}
                          {r.archived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px] min-w-[36px] px-1"
                              onClick={() => handleRestore(r.id)}
                              title="استعادة"
                            >
                              <ArchiveRestore className="w-4 h-4 text-green-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px] min-w-[36px] px-1"
                              onClick={() => handleArchive(r.id)}
                              title="أرشفة"
                            >
                              <Archive className="w-4 h-4 text-amber-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[44px]"
                            onClick={() => { setDeleteTarget(r.id); setDeleteDialogOpen(true) }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذه النتائج؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="min-h-[44px]"
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
