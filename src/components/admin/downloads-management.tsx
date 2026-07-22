'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Download, Upload, RefreshCw, Trash2, Pencil, AlertCircle,
  FileText, Sheet, Presentation, Image as ImageIcon, Archive, File,
  Loader2, Search, X, FileUp, Eye, EyeOff, Files,
  CheckCircle2, XCircle,
  ArrowUp, ArrowDown, FolderOpen, FolderPlus, Lock, Folder,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import {
  DOWNLOAD_CATEGORIES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatFileSize,
  getFileTypeIcon,
  getCategoryInfo,
  DOWNLOAD_VISIBILITY_LEVELS,
  DOWNLOAD_VISIBILITY_VALUES,
  getVisibilityInfo,
  getVisibilityLabel,
} from '@/lib/downloads'

interface DownloadableFile {
  id: string
  schoolId: string
  category: string
  title: string
  description: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  uploadedById: string | null
  uploadedByName: string
  isActive: boolean
  downloadsCount: number
  createdAt: string
  updatedAt: string
  // حقول جديدة (مجلد + صلاحية + ترتيب)
  folderId: string | null
  visibility: string
  sortOrder: number
}

interface DownloadFolder {
  id: string
  schoolId: string
  category: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  filesCount: number
  createdAt: string
}

type FileTypeIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>

/** خريطة نوع الملف → أيقونة + لون */
function getFileTypeDisplay(fileName: string): { Icon: FileTypeIcon; color: string } {
  switch (getFileTypeIcon(fileName)) {
    case 'pdf':
      return { Icon: FileText, color: '#dc2626' } // أحمر
    case 'word':
      return { Icon: FileText, color: '#2563eb' } // أزرق (لون Word)
    case 'excel':
      return { Icon: Sheet, color: '#16a34a' } // أخضر
    case 'powerpoint':
      return { Icon: Presentation, color: '#ea580c' } // برتقالي
    case 'image':
      return { Icon: ImageIcon, color: '#9333ea' } // بنفسجي
    case 'archive':
      return { Icon: Archive, color: '#475569' } // رمادي
    case 'text':
      return { Icon: FileText, color: '#475569' } // رمادي
    default:
      return { Icon: File, color: '#475569' } // رمادي
  }
}

/** تحويل hex إلى rgba مع شفافية */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** تنسيق التاريخ بالعربية */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

/** بادج ملوّن لمستوى الصلاحية */
function VisibilityBadge({ value }: { value: string }) {
  const info = getVisibilityInfo(value)
  if (!info) {
    return <span className="text-xs text-gray-400">{value}</span>
  }
  const showLock = !info.isPublic
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{
        backgroundColor: withAlpha(info.color, 0.12),
        color: info.color,
      }}
    >
      <span aria-hidden>{info.icon}</span>
      {info.label}
      {showLock && <Lock className="w-3 h-3" />}
    </span>
  )
}

export function DownloadsManagement() {
  const { selectedSchoolId, adminUser } = useAdminStore()

  // قائمة الملفات + حالة التحميل
  const [files, setFiles] = useState<DownloadableFile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // الفلاتر
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterVisibility, setFilterVisibility] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)

  // ===== المجلدات =====
  const [folders, setFolders] = useState<DownloadFolder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersRefreshKey, setFoldersRefreshKey] = useState(0)

  // حوار المجلد (إنشاء/تعديل)
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [folderEditMode, setFolderEditMode] = useState<'create' | 'edit'>('create')
  const [folderEditTarget, setFolderEditTarget] = useState<DownloadFolder | null>(null)
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    category: 'GENERAL',
    sortOrder: 0,
    isActive: true,
  })
  const [folderSaving, setFolderSaving] = useState(false)
  const [folderTogglingId, setFolderTogglingId] = useState<string | null>(null)
  const [folderReorderingId, setFolderReorderingId] = useState<string | null>(null)

  // حوار حذف مجلد
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<DownloadFolder | null>(null)
  const [folderDeleteOpen, setFolderDeleteOpen] = useState(false)
  const [folderDeleting, setFolderDeleting] = useState(false)

  // ===== نموذج الرفع =====
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadCategory, setUploadCategory] = useState<string>('GENERAL')
  const [uploadVisibility, setUploadVisibility] = useState<string>('PUBLIC')
  const [uploadFolderId, setUploadFolderId] = useState<string>('') // '' = جذر التصنيف
  const [uploadSortOrder, setUploadSortOrder] = useState<number>(0)
  const [uploadFolders, setUploadFolders] = useState<DownloadFolder[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ===== حوار التعديل =====
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DownloadableFile | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('GENERAL')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editVisibility, setEditVisibility] = useState<string>('PUBLIC')
  const [editFolderId, setEditFolderId] = useState<string>('') // '' = جذر التصنيف
  const [editSortOrder, setEditSortOrder] = useState<number>(0)
  const [editFolders, setEditFolders] = useState<DownloadFolder[]>([])
  const [editSaving, setEditSaving] = useState(false)

  // تبديل الحالة (سبينر لكل صف)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  // إعادة الترتيب اليدوي للملفات
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  // حوار حذف ملف
  const [deleteTarget, setDeleteTarget] = useState<DownloadableFile | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // debounce البحث
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchFiles = useCallback(
    async (showSpinner = false, signal?: AbortSignal) => {
      if (!selectedSchoolId) {
        setLoading(false)
        return
      }
      if (showSpinner) setRefreshing(true)
      try {
        const params = new URLSearchParams({
          schoolId: selectedSchoolId,
          includeInactive: includeInactive ? '1' : '0',
        })
        if (filterCategory && filterCategory !== 'all') {
          params.set('category', filterCategory)
        }
        if (filterVisibility && filterVisibility !== 'all') {
          params.set('visibility', filterVisibility)
        }
        if (search.trim()) {
          params.set('search', search.trim())
        }
        const res = await fetch(`/api/downloads?${params.toString()}`, { signal })
        if (!res.ok) throw new Error('bad response')
        const data = await res.json()
        setFiles(Array.isArray(data.files) ? data.files : [])
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        toast.error('فشل في تحميل الملفات')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selectedSchoolId, includeInactive, filterCategory, filterVisibility, search]
  )

  useEffect(() => {
    const ac = new AbortController()
    fetchFiles(false, ac.signal)
    return () => ac.abort()
  }, [fetchFiles])

  // جلب المجلدات حسب المدرسة + التصنيف المختار (أو الكل)
  const fetchFolders = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedSchoolId) {
        setFolders([])
        return
      }
      setFoldersLoading(true)
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (filterCategory && filterCategory !== 'all') {
          params.set('category', filterCategory)
        }
        const res = await fetch(`/api/download-folders?${params.toString()}`, { signal })
        if (!res.ok) throw new Error('bad response')
        const data = await res.json()
        setFolders(Array.isArray(data.folders) ? data.folders : [])
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        toast.error('فشل في تحميل المجلدات')
      } finally {
        setFoldersLoading(false)
      }
    },
    [selectedSchoolId, filterCategory]
  )

  useEffect(() => {
    const ac = new AbortController()
    fetchFolders(ac.signal)
    return () => ac.abort()
  }, [fetchFolders, foldersRefreshKey])

  // جلب مجلدات التصنيف المختار في نموذج الرفع (all setState داخل الـ async callbacks)
  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const run = async () => {
      if (!selectedSchoolId || !uploadCategory) {
        setUploadFolders([])
        setUploadFolderId('')
        return
      }
      try {
        const r = await fetch(
          `/api/download-folders?schoolId=${selectedSchoolId}&category=${uploadCategory}`,
          { signal: ac.signal }
        )
        if (!r.ok) throw new Error('bad response')
        const data = await r.json()
        if (cancelled) return
        const list: DownloadFolder[] = Array.isArray(data.folders) ? data.folders : []
        setUploadFolders(list)
        // إن كان uploadFolderId الحالي غير موجود ضمن القائمة (تغيّر التصنيف) → أعد الضبط
        setUploadFolderId((prev) =>
          prev && list.some((f) => f.id === prev) ? prev : ''
        )
      } catch {
        if (!cancelled) setUploadFolders([])
      }
    }
    run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [selectedSchoolId, uploadCategory])

  // جلب مجلدات التصنيف المختار في حوار التعديل (all setState داخل الـ async callbacks)
  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const run = async () => {
      if (!selectedSchoolId || !editCategory) {
        setEditFolders([])
        return
      }
      try {
        const r = await fetch(
          `/api/download-folders?schoolId=${selectedSchoolId}&category=${editCategory}`,
          { signal: ac.signal }
        )
        if (!r.ok) throw new Error('bad response')
        const data = await r.json()
        if (cancelled) return
        const list: DownloadFolder[] = Array.isArray(data.folders) ? data.folders : []
        setEditFolders(list)
        // إن كان المجلد الحالي غير موجود ضمن القائمة الجديدة → أعد الضبط إلى الجذر
        setEditFolderId((prev) =>
          prev && list.some((f) => f.id === prev) ? prev : ''
        )
      } catch {
        if (!cancelled) setEditFolders([])
      }
    }
    run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [selectedSchoolId, editCategory])

  // الإحصائيات
  const totalFiles = files.length
  const totalDownloads = files.reduce((sum, f) => sum + (f.downloadsCount || 0), 0)
  const activeCount = files.filter((f) => f.isActive).length
  const inactiveCount = totalFiles - activeCount

  // خريطة folderId → الاسم (لعرض اسم المجلد في جدول الملفات)
  const folderNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of [...folders, ...uploadFolders, ...editFolders]) {
      if (f && f.id && !map[f.id]) map[f.id] = f.name
    }
    return map
  }, [folders, uploadFolders, editFolders])

  // التحقق من الملف المختار
  const handleFileSelected = (file: File | null) => {
    if (!file) {
      setUploadFile(null)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`حجم الملف يتجاوز الحد المسموح (${formatFileSize(MAX_FILE_SIZE)})`)
      return
    }
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('نوع الملف غير مدعوم. الأنواع المدعومة: ' + ALLOWED_EXTENSIONS.join('، '))
      return
    }
    setUploadFile(file)
    // تعبئة العنوان تلقائياً من اسم الملف (بدون الامتداد)
    if (!uploadTitle.trim()) {
      const baseName = file.name.replace(/\.[^.]+$/, '')
      setUploadTitle(baseName)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelected(file)
  }

  const clearUploadForm = () => {
    setUploadFile(null)
    setUploadTitle('')
    setUploadDescription('')
    setUploadCategory('GENERAL')
    setUploadVisibility('PUBLIC')
    setUploadFolderId('')
    setUploadSortOrder(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('يرجى اختيار ملف للرفع')
      return
    }
    if (!uploadTitle.trim()) {
      toast.error('عنوان الملف مطلوب')
      return
    }
    if (!selectedSchoolId) {
      toast.error('لم يتم تحديد المدرسة')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('schoolId', selectedSchoolId)
      form.append('category', uploadCategory)
      form.append('title', uploadTitle.trim())
      form.append('description', uploadDescription.trim())
      form.append('visibility', uploadVisibility)
      form.append('sortOrder', String(uploadSortOrder || 0))
      if (uploadFolderId) form.append('folderId', uploadFolderId)
      if (adminUser?.id) form.append('uploadedById', adminUser.id)
      if (adminUser?.username) form.append('uploadedByName', adminUser.username)

      const res = await fetch('/api/downloads', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'فشل رفع الملف')
      }
      toast.success('تم رفع الملف بنجاح')
      clearUploadForm()
      fetchFiles(true)
      // لتحديث عدّاد الملفات داخل المجلدات
      setFoldersRefreshKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل رفع الملف')
    } finally {
      setUploading(false)
    }
  }

  const handleToggleActive = async (file: DownloadableFile) => {
    setTogglingId(file.id)
    try {
      const res = await fetch(`/api/downloads/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          isActive: !file.isActive,
        }),
      })
      if (!res.ok) throw new Error('bad response')
      toast.success(file.isActive ? 'تم إخفاء الملف' : 'تم إظهار الملف')
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, isActive: !f.isActive } : f))
      )
    } catch {
      toast.error('فشل في تحديث حالة الملف')
    } finally {
      setTogglingId(null)
    }
  }

  const handleFileReorder = async (file: DownloadableFile, direction: 'up' | 'down') => {
    const current = file.sortOrder || 0
    const newOrder =
      direction === 'up' ? Math.max(0, current - 1) : current + 1
    setReorderingId(file.id)
    // تحديث متفائل
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, sortOrder: newOrder } : f))
    )
    try {
      const res = await fetch(`/api/downloads/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: selectedSchoolId, sortOrder: newOrder }),
      })
      if (!res.ok) throw new Error('bad response')
      toast.success('تم تحديث الترتيب')
    } catch {
      toast.error('فشل في تحديث الترتيب')
      // تراجع عن التحديث المتفائل
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, sortOrder: current } : f))
      )
    } finally {
      setReorderingId(null)
    }
  }

  const openEdit = (file: DownloadableFile) => {
    setEditTarget(file)
    setEditTitle(file.title)
    setEditDescription(file.description || '')
    setEditCategory(file.category)
    setEditIsActive(file.isActive)
    setEditVisibility(file.visibility || 'PUBLIC')
    setEditFolderId(file.folderId || '')
    setEditSortOrder(file.sortOrder || 0)
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    if (!editTitle.trim()) {
      toast.error('عنوان الملف مطلوب')
      return
    }
    setEditSaving(true)
    try {
      const body: Record<string, unknown> = {
        schoolId: selectedSchoolId,
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        isActive: editIsActive,
        visibility: editVisibility,
        sortOrder: editSortOrder || 0,
        folderId: editFolderId || null,
      }
      const res = await fetch(`/api/downloads/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('bad response')
      const data = await res.json()
      toast.success('تم تحديث الملف بنجاح')
      if (data.file) {
        setFiles((prev) => prev.map((f) => (f.id === editTarget.id ? data.file : f)))
      } else {
        fetchFiles(true)
      }
      setEditOpen(false)
      setFoldersRefreshKey((k) => k + 1)
    } catch {
      toast.error('فشل في تحديث الملف')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/downloads/${deleteTarget.id}?schoolId=${encodeURIComponent(selectedSchoolId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('bad response')
      toast.success('تم حذف الملف بنجاح')
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id))
      setDeleteOpen(false)
      setDeleteTarget(null)
      setFoldersRefreshKey((k) => k + 1)
    } catch {
      toast.error('فشل في حذف الملف')
    } finally {
      setDeleting(false)
    }
  }

  // ===== معالجات المجلدات =====
  const openCreateFolder = () => {
    setFolderEditMode('create')
    setFolderEditTarget(null)
    setFolderForm({
      name: '',
      description: '',
      category: filterCategory && filterCategory !== 'all' ? filterCategory : 'GENERAL',
      sortOrder: 0,
      isActive: true,
    })
    setShowFolderDialog(true)
  }

  const openEditFolder = (folder: DownloadFolder) => {
    setFolderEditMode('edit')
    setFolderEditTarget(folder)
    setFolderForm({
      name: folder.name,
      description: folder.description || '',
      category: folder.category,
      sortOrder: folder.sortOrder || 0,
      isActive: folder.isActive,
    })
    setShowFolderDialog(true)
  }

  const handleFolderSave = async () => {
    if (!folderForm.name.trim()) {
      toast.error('اسم المجلد مطلوب')
      return
    }
    if (!selectedSchoolId) {
      toast.error('لم يتم تحديد المدرسة')
      return
    }
    setFolderSaving(true)
    try {
      if (folderEditMode === 'create') {
        const res = await fetch('/api/download-folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: selectedSchoolId,
            category: folderForm.category,
            name: folderForm.name.trim(),
            description: folderForm.description.trim(),
            sortOrder: folderForm.sortOrder || 0,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error || 'فشل إنشاء المجلد')
        }
        toast.success('تم إنشاء المجلد بنجاح')
      } else if (folderEditMode === 'edit' && folderEditTarget) {
        const res = await fetch(`/api/download-folders/${folderEditTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: selectedSchoolId,
            name: folderForm.name.trim(),
            description: folderForm.description.trim(),
            category: folderForm.category,
            sortOrder: folderForm.sortOrder || 0,
            isActive: folderForm.isActive,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error || 'فشل تحديث المجلد')
        }
        toast.success('تم تحديث المجلد بنجاح')
      }
      setShowFolderDialog(false)
      setFoldersRefreshKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل حفظ المجلد')
    } finally {
      setFolderSaving(false)
    }
  }

  const handleFolderToggleActive = async (folder: DownloadFolder) => {
    setFolderTogglingId(folder.id)
    try {
      const res = await fetch(`/api/download-folders/${folder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          isActive: !folder.isActive,
        }),
      })
      if (!res.ok) throw new Error('bad response')
      toast.success(folder.isActive ? 'تم إخفاء المجلد' : 'تم إظهار المجلد')
      setFolders((prev) =>
        prev.map((f) => (f.id === folder.id ? { ...f, isActive: !f.isActive } : f))
      )
    } catch {
      toast.error('فشل في تحديث حالة المجلد')
    } finally {
      setFolderTogglingId(null)
    }
  }

  const handleFolderReorder = async (
    folder: DownloadFolder,
    direction: 'up' | 'down'
  ) => {
    const current = folder.sortOrder || 0
    const newOrder = direction === 'up' ? Math.max(0, current - 1) : current + 1
    setFolderReorderingId(folder.id)
    setFolders((prev) =>
      prev.map((f) => (f.id === folder.id ? { ...f, sortOrder: newOrder } : f))
    )
    try {
      const res = await fetch(`/api/download-folders/${folder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: selectedSchoolId, sortOrder: newOrder }),
      })
      if (!res.ok) throw new Error('bad response')
      toast.success('تم تحديث ترتيب المجلد')
    } catch {
      toast.error('فشل في تحديث الترتيب')
      setFolders((prev) =>
        prev.map((f) => (f.id === folder.id ? { ...f, sortOrder: current } : f))
      )
    } finally {
      setFolderReorderingId(null)
    }
  }

  const handleFolderDelete = async () => {
    if (!folderDeleteTarget) return
    setFolderDeleting(true)
    try {
      const res = await fetch(
        `/api/download-folders/${folderDeleteTarget.id}?schoolId=${encodeURIComponent(selectedSchoolId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('bad response')
      toast.success('تم حذف المجلد بنجاح')
      setFolders((prev) => prev.filter((f) => f.id !== folderDeleteTarget.id))
      setFolderDeleteOpen(false)
      setFolderDeleteTarget(null)
      // إعادة جلب الملفات لأن الملفات انتقلت إلى جذر التصنيف
      fetchFiles(true)
    } catch {
      toast.error('فشل في حذف المجلد')
    } finally {
      setFolderDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ===== ترويسة الصفحة ===== */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <Download className="w-6 h-6 text-[#610000]" />
            مركز التحميل
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            إدارة الملفات القابلة للتحميل لشئون الطلاب والعاملين
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchFiles(true)
            setFoldersRefreshKey((k) => k + 1)
          }}
          disabled={refreshing}
          className="min-h-[44px]"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 ml-1 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 ml-1" />
          )}
          تحديث
        </Button>
      </div>

      {/* ===== بطاقات الإحصائيات ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: withAlpha('#610000', 0.1) }}
            >
              <Files className="w-5 h-5" style={{ color: '#610000' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">إجمالي الملفات</p>
              <p className="text-xl font-bold text-[#1a1a2e]">{totalFiles}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: withAlpha('#047857', 0.1) }}
            >
              <Download className="w-5 h-5" style={{ color: '#047857' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">إجمالي التحميلات</p>
              <p className="text-xl font-bold text-[#1a1a2e]">{totalDownloads}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: withAlpha('#16a34a', 0.1) }}
            >
              <CheckCircle2 className="w-5 h-5" style={{ color: '#16a34a' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">الملفات الظاهرة</p>
              <p className="text-xl font-bold text-[#1a1a2e]">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: withAlpha('#dc2626', 0.1) }}
            >
              <XCircle className="w-5 h-5" style={{ color: '#dc2626' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">الملفات المخفية</p>
              <p className="text-xl font-bold text-[#1a1a2e]">{inactiveCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: withAlpha('#7c3aed', 0.1) }}
            >
              <Folder className="w-5 h-5" style={{ color: '#7c3aed' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">المجلدات</p>
              <p className="text-xl font-bold text-[#1a1a2e]">{folders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== شريط الفلاتر ===== */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-1.5 block">التصنيف</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="كل التصنيفات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {DOWNLOAD_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الصلاحية</label>
              <Select value={filterVisibility} onValueChange={setFilterVisibility}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="كل الصلاحيات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الصلاحيات</SelectItem>
                  {DOWNLOAD_VISIBILITY_LEVELS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>{v.icon}</span>
                        {v.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">بحث</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="بحث بالعنوان أو الوصف أو اسم الملف"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-11 pr-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 h-11 px-1">
              <Switch
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
                id="show-inactive"
              />
              <label
                htmlFor="show-inactive"
                className="text-sm font-medium cursor-pointer select-none"
              >
                إظهار المخفية
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== قسم المجلدات ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="w-5 h-5 text-[#610000]" />
              المجلدات ({folders.length})
              {filterCategory !== 'all' && (
                <span className="text-xs text-gray-400 font-normal">
                  — تصنيف: {getCategoryInfo(filterCategory)?.label || filterCategory}
                </span>
              )}
            </CardTitle>
            <Button
              size="sm"
              onClick={openCreateFolder}
              disabled={!selectedSchoolId}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[40px]"
            >
              <FolderPlus className="w-4 h-4 ml-1" />
              إضافة مجلد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {foldersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">لا توجد مجلدات</p>
              <p className="text-xs text-gray-400 mt-1">
                أنشئ مجلداً لتنظيم ملفات التصنيف
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المجلد</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>الملفات</TableHead>
                    <TableHead>الترتيب</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folders.map((folder) => {
                    const catInfo = getCategoryInfo(folder.category)
                    return (
                      <TableRow
                        key={folder.id}
                        className={!folder.isActive ? 'opacity-60' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: withAlpha('#7c3aed', 0.1) }}
                            >
                              <Folder className="w-5 h-5" style={{ color: '#7c3aed' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-[#1a1a2e] truncate max-w-[220px]">
                                {folder.name}
                              </p>
                              {folder.description && (
                                <p className="text-xs text-gray-400 truncate max-w-[220px]">
                                  {folder.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {catInfo ? (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: withAlpha(catInfo.color, 0.12),
                                color: catInfo.color,
                              }}
                            >
                              {catInfo.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{folder.category}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <Files className="w-3.5 h-3.5 text-gray-400" />
                            {folder.filesCount || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleFolderReorder(folder, 'up')}
                              disabled={folderReorderingId === folder.id}
                              title="تحريك لأعلى"
                            >
                              {folderReorderingId === folder.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
                              )}
                            </Button>
                            <span className="text-xs font-medium text-gray-500 w-6 text-center">
                              {folder.sortOrder || 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleFolderReorder(folder, 'down')}
                              disabled={folderReorderingId === folder.id}
                              title="تحريك لأسفل"
                            >
                              <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {folder.isActive ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              ظاهر
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                              مخفي
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditFolder(folder)}
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleFolderToggleActive(folder)}
                              disabled={folderTogglingId === folder.id}
                              title={folder.isActive ? 'إخفاء' : 'إظهار'}
                            >
                              {folderTogglingId === folder.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : folder.isActive ? (
                                <EyeOff className="w-4 h-4 text-gray-600" />
                              ) : (
                                <Eye className="w-4 h-4 text-gray-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-red-50"
                              onClick={() => {
                                setFolderDeleteTarget(folder)
                                setFolderDeleteOpen(true)
                              }}
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== قسم الرفع ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-5 h-5 text-[#610000]" />
            رفع ملف جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* منطقة السحب والإفلات */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-[#610000] bg-[#610000]/5'
                : 'border-gray-300 hover:border-[#610000]/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
            />
            {uploadFile ? (
              <div className="flex items-center justify-center gap-3">
                {(() => {
                  const { Icon, color } = getFileTypeDisplay(uploadFile.name)
                  return <Icon className="w-8 h-8" style={{ color }} />
                })()}
                <div className="text-right">
                  <p className="font-medium text-sm text-[#1a1a2e]">{uploadFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearUploadForm()
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <FileUp className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  اسحب وأفلت الملف هنا أو{' '}
                  <span className="text-[#610000] font-medium">اضغط للاختيار</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  الحد الأقصى للحجم: {formatFileSize(MAX_FILE_SIZE)}
                </p>
                <p className="text-xs text-gray-400">
                  الأنواع المدعومة: {ALLOWED_EXTENSIONS.join('، ')}
                </p>
              </>
            )}
          </div>

          {/* نموذج بيانات الملف — يظهر فقط بعد اختيار ملف */}
          {uploadFile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  العنوان <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="عنوان واضح للملف"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">التصنيف</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNLOAD_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  المجلد (اختياري)
                </label>
                <Select
                  value={uploadFolderId || 'root'}
                  onValueChange={(v) => setUploadFolderId(v === 'root' ? '' : v)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="بدون مجلد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">بدون مجلد</SelectItem>
                    {uploadFolders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uploadFolders.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    لا توجد مجلدات في هذا التصنيف بعد
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">الصلاحية</label>
                <Select value={uploadVisibility} onValueChange={setUploadVisibility}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر الصلاحية" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNLOAD_VISIBILITY_LEVELS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden>{v.icon}</span>
                          {v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  ترتيب العرض{' '}
                  <span className="text-xs text-gray-400">(الأصغر يظهر أولاً)</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  value={uploadSortOrder}
                  onChange={(e) =>
                    setUploadSortOrder(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-11"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">
                  الوصف (اختياري)
                </label>
                <Textarea
                  placeholder="وصف مختصر لمحتوى الملف"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile || !uploadTitle.trim()}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                      جاري الرفع...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 ml-1" />
                      رفع الملف
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== جدول الملفات ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Files className="w-5 h-5 text-[#610000]" />
            الملفات ({files.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">لا توجد ملفات في مركز التحميل</p>
              <p className="text-xs text-gray-400 mt-1">
                ابدأ برفع ملف جديد من القسم أعلاه
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الملف</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>الصلاحية</TableHead>
                    <TableHead>الحجم</TableHead>
                    <TableHead>التحميلات</TableHead>
                    <TableHead>الترتيب</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead className="text-left">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const { Icon, color } = getFileTypeDisplay(file.fileName)
                    const catInfo = getCategoryInfo(file.category)
                    const folderName = file.folderId
                      ? folderNameById[file.folderId]
                      : null
                    return (
                      <TableRow
                        key={file.id}
                        className={!file.isActive ? 'opacity-60' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: withAlpha(color, 0.1) }}
                            >
                              <Icon className="w-5 h-5" style={{ color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-[#1a1a2e] truncate max-w-[220px]">
                                {file.title}
                              </p>
                              <p className="text-xs text-gray-400 truncate max-w-[220px]">
                                {file.fileName}
                              </p>
                              {folderName && (
                                <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-gray-500">
                                  <Folder className="w-3 h-3" />
                                  {folderName}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {catInfo ? (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: withAlpha(catInfo.color, 0.12),
                                color: catInfo.color,
                              }}
                            >
                              {catInfo.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{file.category}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <VisibilityBadge value={file.visibility || 'PUBLIC'} />
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {formatFileSize(file.fileSize)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <Download className="w-3.5 h-3.5 text-gray-400" />
                            {file.downloadsCount || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleFileReorder(file, 'up')}
                              disabled={
                                reorderingId === file.id || (file.sortOrder || 0) <= 0
                              }
                              title="تحريك لأعلى"
                            >
                              {reorderingId === file.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
                              )}
                            </Button>
                            <span className="text-xs font-medium text-gray-500 w-6 text-center">
                              {file.sortOrder || 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleFileReorder(file, 'down')}
                              disabled={reorderingId === file.id}
                              title="تحريك لأسفل"
                            >
                              <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {file.isActive ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              ظاهر
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                              مخفي
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(file.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(file)}
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleActive(file)}
                              disabled={togglingId === file.id}
                              title={file.isActive ? 'إخفاء' : 'إظهار'}
                            >
                              {togglingId === file.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : file.isActive ? (
                                <EyeOff className="w-4 h-4 text-gray-600" />
                              ) : (
                                <Eye className="w-4 h-4 text-gray-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-red-50"
                              onClick={() => {
                                setDeleteTarget(file)
                                setDeleteOpen(true)
                              }}
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== حوار التعديل ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الملف</DialogTitle>
            <DialogDescription>تعديل بيانات الملف القابل للتحميل</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                العنوان <span className="text-red-500">*</span>
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الوصف</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">التصنيف</label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNLOAD_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">المجلد</label>
                <Select
                  value={editFolderId || 'root'}
                  onValueChange={(v) => setEditFolderId(v === 'root' ? '' : v)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="بدون مجلد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">بدون مجلد</SelectItem>
                    {editFolders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">الصلاحية</label>
                <Select value={editVisibility} onValueChange={setEditVisibility}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر الصلاحية" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNLOAD_VISIBILITY_LEVELS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden>{v.icon}</span>
                          {v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  ترتيب العرض{' '}
                  <span className="text-xs text-gray-400">(الأصغر أولاً)</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editSortOrder}
                  onChange={(e) =>
                    setEditSortOrder(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-11"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Switch
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
                id="edit-is-active"
              />
              <label
                htmlFor="edit-is-active"
                className="text-sm font-medium cursor-pointer select-none"
              >
                {editIsActive ? 'الملف ظاهر للتحميل' : 'الملف مخفي'}
              </label>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="min-h-[44px]"
            >
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving || !editTitle.trim()}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {editSaving ? (
                <>
                  <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                'حفظ التعديلات'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== حوار إنشاء/تعديل مجلد ===== */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {folderEditMode === 'create' ? 'إضافة مجلد جديد' : 'تعديل المجلد'}
            </DialogTitle>
            <DialogDescription>
              {folderEditMode === 'create'
                ? 'أنشئ مجلداً لتنظيم ملفات التصنيف'
                : 'تعديل بيانات المجلد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                الاسم <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="مثال: نماذج التسجيل"
                value={folderForm.name}
                onChange={(e) =>
                  setFolderForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الوصف (اختياري)</label>
              <Textarea
                placeholder="وصف مختصر لمحتوى المجلد"
                value={folderForm.description}
                onChange={(e) =>
                  setFolderForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">التصنيف</label>
                <Select
                  value={folderForm.category}
                  onValueChange={(v) =>
                    setFolderForm((prev) => ({ ...prev, category: v }))
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNLOAD_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  ترتيب العرض{' '}
                  <span className="text-xs text-gray-400">(الأصغر أولاً)</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  value={folderForm.sortOrder}
                  onChange={(e) =>
                    setFolderForm((prev) => ({
                      ...prev,
                      sortOrder: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="h-11"
                />
              </div>
            </div>
            {folderEditMode === 'edit' && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Switch
                  checked={folderForm.isActive}
                  onCheckedChange={(v) =>
                    setFolderForm((prev) => ({ ...prev, isActive: v }))
                  }
                  id="folder-is-active"
                />
                <label
                  htmlFor="folder-is-active"
                  className="text-sm font-medium cursor-pointer select-none"
                >
                  {folderForm.isActive ? 'المجلد ظاهر' : 'المجلد مخفي'}
                </label>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setShowFolderDialog(false)}
              className="min-h-[44px]"
            >
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={handleFolderSave}
              disabled={folderSaving || !folderForm.name.trim()}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {folderSaving ? (
                <>
                  <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                'حفظ'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== حوار تأكيد حذف الملف ===== */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الملف &quot;{deleteTarget?.title}&quot;؟ لا يمكن التراجع
              عن هذا الإجراء وسيتم حذف الملف نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white min-h-[44px]"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                'حذف'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== حوار تأكيد حذف المجلد ===== */}
      <AlertDialog open={folderDeleteOpen} onOpenChange={setFolderDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المجلد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المجلد &quot;{folderDeleteTarget?.name}&quot;؟ سيتم نقل
              الملفات داخله إلى جذر التصنيف (بدون مجلد). لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFolderDelete}
              disabled={folderDeleting}
              className="bg-red-600 hover:bg-red-700 text-white min-h-[44px]"
            >
              {folderDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                'حذف'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
