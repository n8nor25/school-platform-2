'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, AlertCircle, Loader2, Wallet, Printer,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, Coins, Building,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import {
  resolveSchool, formatCurrency, formatDate,
  PETTY_CASH_TYPES, PETTY_CASH_TYPE_COLORS,
} from '@/lib/expense-utils'

interface PettyCashFund {
  id: string
  name: string
  custodianName: string | null
  openingBalance: number
  currentBalance: number
  maximumBalance: number | null
  active: boolean
  notes: string | null
  openedAt: string
  _count?: { transactions: number }
}

interface PettyCashTransaction {
  id: string
  type: string
  amount: number
  recipient: string | null
  date: string
  reference: string | null
  notes: string | null
  balanceAfter: number
  expense?: { id: string; title: string; amount: number } | null
}

interface FundWithTransactions extends PettyCashFund {
  transactions?: PettyCashTransaction[]
}

interface FundForm {
  name: string
  custodianName: string
  openingBalance: string
  maximumBalance: string
  notes: string
  active: boolean
}

interface TransactionForm {
  type: string
  amount: string
  recipient: string
  date: string
  reference: string
  notes: string
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const defaultFundForm: FundForm = {
  name: '',
  custodianName: '',
  openingBalance: '0',
  maximumBalance: '',
  notes: '',
  active: true,
}

const defaultTxForm: TransactionForm = {
  type: 'صرف',
  amount: '',
  recipient: '',
  date: todayStr(),
  reference: '',
  notes: '',
}

export function PettyCashManagement() {
  const { selectedSchoolId, adminUser } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [funds, setFunds] = useState<PettyCashFund[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedFundId, setSelectedFundId] = useState<string>('')
  const [fundDetails, setFundDetails] = useState<FundWithTransactions | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const [fundForm, setFundForm] = useState<FundForm>(defaultFundForm)
  const [fundDialogOpen, setFundDialogOpen] = useState(false)
  const [fundEditId, setFundEditId] = useState<string | null>(null)
  const [fundSaving, setFundSaving] = useState(false)

  const [txForm, setTxForm] = useState<TransactionForm>(defaultTxForm)
  const [txDialogOpen, setTxDialogOpen] = useState(false)
  const [txSaving, setTxSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<PettyCashFund | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [activeTab, setActiveTab] = useState('funds')

  // Fetch funds list
  const fetchFunds = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/petty-cash?schoolId=${schoolId}`)
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            const arr = Array.isArray(data.funds) ? data.funds : []
            setFunds(arr)
            // Auto-select first fund if none selected
            if (!selectedFundId && arr.length > 0) {
              setSelectedFundId(arr[0].id)
            }
          } else {
            toast.error('فشل في تحميل صناديق العهد')
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل صناديق العهد')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, selectedFundId])

  useEffect(() => fetchFunds(), [fetchFunds])

  // Fetch fund details (transactions)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedFundId) {
        if (!cancelled) setFundDetails(null)
        return
      }
      try {
        setDetailsLoading(true)
        const res = await fetch(
          `/api/petty-cash/${selectedFundId}?schoolId=${schoolId}`
        )
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setFundDetails(data)
          } else {
            toast.error('فشل في تحميل تفاصيل الصندوق')
            setFundDetails(null)
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل تفاصيل الصندوق')
          setFundDetails(null)
        }
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedFundId, schoolId])

  const openAddFund = () => {
    setFundEditId(null)
    setFundForm(defaultFundForm)
    setFundDialogOpen(true)
  }

  const openEditFund = (f: PettyCashFund) => {
    setFundEditId(f.id)
    setFundForm({
      name: f.name,
      custodianName: f.custodianName || '',
      openingBalance: String(f.openingBalance || 0),
      maximumBalance: f.maximumBalance ? String(f.maximumBalance) : '',
      notes: f.notes || '',
      active: f.active,
    })
    setFundDialogOpen(true)
  }

  const handleFundSave = async () => {
    if (!fundForm.name.trim()) {
      toast.error('اسم الصندوق مطلوب')
      return
    }
    setFundSaving(true)
    try {
      const body = {
        name: fundForm.name.trim(),
        custodianName: fundForm.custodianName || null,
        openingBalance: Number(fundForm.openingBalance) || 0,
        maximumBalance: fundForm.maximumBalance ? Number(fundForm.maximumBalance) : null,
        notes: fundForm.notes || null,
        active: fundForm.active,
      }
      const url = fundEditId
        ? `/api/petty-cash/${fundEditId}?schoolId=${schoolId}`
        : `/api/petty-cash?schoolId=${schoolId}`
      const res = await fetch(url, {
        method: fundEditId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(fundEditId ? 'تم تحديث الصندوق' : 'تم إنشاء الصندوق بنجاح')
        setFundDialogOpen(false)
        fetchFunds()
        if (!fundEditId) {
          setFundForm(defaultFundForm)
          setActiveTab('funds')
        }
      } else if (res.status === 409) {
        toast.error(data.error || 'اسم الصندوق مُستخدم بالفعل')
      } else {
        toast.error(data.error || 'فشل في حفظ البيانات')
      }
    } catch {
      toast.error('فشل في حفظ البيانات')
    } finally {
      setFundSaving(false)
    }
  }

  const handleTxSave = async () => {
    if (!selectedFundId) {
      toast.error('اختر الصندوق أولاً')
      return
    }
    if (!txForm.amount || isNaN(Number(txForm.amount))) {
      toast.error('المبلغ مطلوب')
      return
    }
    if (!txForm.date) {
      toast.error('التاريخ مطلوب')
      return
    }
    setTxSaving(true)
    try {
      const res = await fetch(
        `/api/petty-cash/${selectedFundId}/transactions?schoolId=${schoolId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: txForm.type,
            amount: Math.abs(Number(txForm.amount)),
            recipient: txForm.recipient || null,
            date: txForm.date,
            reference: txForm.reference || null,
            notes: txForm.notes || null,
            createdBy: adminUser?.username || null,
          }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('تم تسجيل الحركة بنجاح')
        setTxDialogOpen(false)
        setTxForm(defaultTxForm)
        // Refresh details + funds list (to update balances)
        const detRes = await fetch(
          `/api/petty-cash/${selectedFundId}?schoolId=${schoolId}`
        )
        if (detRes.ok) {
          const det = await detRes.json()
          setFundDetails(det)
        }
        fetchFunds()
      } else {
        toast.error(data.error || 'فشل في تسجيل الحركة')
      }
    } catch {
      toast.error('فشل في تسجيل الحركة')
    } finally {
      setTxSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/petty-cash/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف الصندوق')
        setDeleteOpen(false)
        setDeleteTarget(null)
        if (selectedFundId === deleteTarget.id) {
          setSelectedFundId('')
        }
        fetchFunds()
      } else if (res.status === 409) {
        toast.error(data.error || 'لا يمكن حذف الصندوق')
      } else {
        toast.error(data.error || 'فشل في الحذف')
      }
    } catch {
      toast.error('فشل في الحذف')
    } finally {
      setDeleting(false)
    }
  }

  const printTransactions = () => {
    window.print()
  }

  // Transactions from fund details
  const transactions = fundDetails?.transactions || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#610000]" />
          عهد السلف (Petty Cash)
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="funds" className="data-[state=active]:bg-white">
            <Wallet className="w-4 h-4 ml-1" /> الصناديق
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-white">
            <RefreshCw className="w-4 h-4 ml-1" /> الحركات
          </TabsTrigger>
          <TabsTrigger value="add-fund" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إنشاء صندوق
          </TabsTrigger>
        </TabsList>

        {/* Funds Tab */}
        <TabsContent value="funds" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={openAddFund}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              <Plus className="w-4 h-4 ml-1" />
              صندوق جديد
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : funds.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد صناديق عهد مسجلة.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {funds.map((f) => (
                <Card
                  key={f.id}
                  className={`hover:shadow-md transition-shadow cursor-pointer ${
                    selectedFundId === f.id ? 'border-2 border-[#610000]' : ''
                  }`}
                  onClick={() => {
                    setSelectedFundId(f.id)
                    setActiveTab('transactions')
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                          <Coins className="w-5 h-5 text-[#610000]" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{f.name}</p>
                          {f.custodianName && (
                            <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {f.custodianName}
                            </p>
                          )}
                        </div>
                      </div>
                      {f.active ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">نشط</Badge>
                      ) : (
                        <Badge variant="outline">متوقف</Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">الرصيد الحالي</span>
                        <span className="font-mono font-bold text-[#610000] text-lg">
                          {formatCurrency(f.currentBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>رصيد افتتاحي</span>
                        <span className="font-mono">{formatCurrency(f.openingBalance)}</span>
                      </div>
                      {f.maximumBalance !== null && (
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>الحد الأقصى</span>
                          <span className="font-mono">{formatCurrency(f.maximumBalance)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs text-gray-500 pt-1 border-t border-gray-100">
                        <span>عدد الحركات</span>
                        <span className="font-mono">{f._count?.transactions || 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditFund(f)}
                        className="text-[#610000] hover:bg-[#610000]/10 min-h-[36px] flex-1"
                      >
                        <Edit className="w-4 h-4 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeleteTarget(f)
                          setDeleteOpen(true)
                        }}
                        className="text-red-600 hover:bg-red-50 min-h-[36px]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[280px]">
                  <Label>اختر الصندوق</Label>
                  <Select
                    value={selectedFundId}
                    onValueChange={setSelectedFundId}
                  >
                    <SelectTrigger className="h-11 mt-1.5">
                      <SelectValue placeholder="اختر الصندوق..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funds.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => setTxDialogOpen(true)}
                  disabled={!selectedFundId}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  حركة جديدة
                </Button>
                {fundDetails && (
                  <Button
                    onClick={printTransactions}
                    variant="outline"
                    className="min-h-[44px]"
                  >
                    <Printer className="w-4 h-4 ml-1" />
                    طباعة
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {!selectedFundId ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">اختر صندوقًا لعرض حركاته.</p>
              </CardContent>
            </Card>
          ) : detailsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : fundDetails ? (
            <div className="space-y-4">
              {/* Balance display */}
              <Card className="border-2 border-[#610000]/20 print:shadow-none print:border-2 print:border-[#610000]">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">الصندوق: {fundDetails.name}</p>
                      <p className="text-sm text-gray-600">
                        {fundDetails.custodianName && (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {fundDetails.custodianName}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-gray-500">الرصيد الحالي</p>
                      <p className="text-3xl font-bold text-[#610000] font-mono">
                        {formatCurrency(fundDetails.currentBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">سجل الحركات</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      لا توجد حركات مسجلة لهذا الصندوق.
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>التاريخ</TableHead>
                            <TableHead>النوع</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>المستلم</TableHead>
                            <TableHead>المرجع</TableHead>
                            <TableHead>الرصيد بعدها</TableHead>
                            <TableHead>ملاحظات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((t) => {
                            const tc = PETTY_CASH_TYPE_COLORS[t.type] || PETTY_CASH_TYPE_COLORS['تسوية']
                            const sign = t.type === 'صرف' ? '-' : t.type === 'تغذية' ? '+' : ''
                            return (
                              <TableRow key={t.id} className="hover:bg-gray-50">
                                <TableCell>
                                  <span className="font-mono text-sm text-gray-700" dir="ltr">
                                    {formatDate(t.date)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${tc.bg} ${tc.text} ${tc.border}`}
                                  >
                                    {t.type === 'صرف' && <ArrowDownCircle className="w-3 h-3" />}
                                    {t.type === 'تغذية' && <ArrowUpCircle className="w-3 h-3" />}
                                    {t.type === 'تسوية' && <RefreshCw className="w-3 h-3" />}
                                    {t.type}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`font-mono font-bold ${
                                      t.type === 'صرف' ? 'text-red-600' : t.type === 'تغذية' ? 'text-green-600' : 'text-sky-600'
                                    }`}
                                  >
                                    {sign}
                                    {formatCurrency(t.amount)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {t.recipient ? (
                                    <span className="text-sm text-gray-700">{t.recipient}</span>
                                  ) : t.expense ? (
                                    <span className="text-sm text-gray-700 inline-flex items-center gap-1">
                                      <Building className="w-3 h-3 text-gray-400" />
                                      {t.expense.title}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {t.reference ? (
                                    <span className="font-mono text-xs text-gray-600" dir="ltr">
                                      {t.reference}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono text-sm font-medium text-gray-700">
                                    {formatCurrency(t.balanceAfter)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {t.notes ? (
                                    <span className="text-xs text-gray-600">{t.notes}</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
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
            </div>
          ) : null}
        </TabsContent>

        {/* Add-Fund Tab */}
        <TabsContent value="add-fund">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#610000]" />
                إنشاء صندوق عهد جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>اسم الصندوق <span className="text-red-500">*</span></Label>
                  <Input
                    value={fundForm.name}
                    onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })}
                    placeholder="مثال: عهدة النثريات - الإدارة"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>اسم أمين العهدة</Label>
                  <Input
                    value={fundForm.custodianName}
                    onChange={(e) => setFundForm({ ...fundForm, custodianName: e.target.value })}
                    placeholder="الاسم"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الرصيد الافتتاحي</Label>
                  <Input
                    type="number"
                    value={fundForm.openingBalance}
                    onChange={(e) => setFundForm({ ...fundForm, openingBalance: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الحد الأقصى (اختياري)</Label>
                  <Input
                    type="number"
                    value={fundForm.maximumBalance}
                    onChange={(e) => setFundForm({ ...fundForm, maximumBalance: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الحالة</Label>
                  <div className="flex items-center gap-3 h-11">
                    <Switch
                      checked={fundForm.active}
                      onCheckedChange={(v) => setFundForm({ ...fundForm, active: v })}
                    />
                    <span className="text-sm text-gray-600">
                      {fundForm.active ? 'نشط' : 'متوقف'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea
                  value={fundForm.notes}
                  onChange={(e) => setFundForm({ ...fundForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFundForm(defaultFundForm)
                    setActiveTab('funds')
                  }}
                  className="min-h-[44px]"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleFundSave}
                  disabled={fundSaving}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {fundSaving ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 ml-1" />
                  )}
                  حفظ الصندوق
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fund Edit/Add Dialog */}
      <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fundEditId ? 'تعديل الصندوق' : 'إنشاء صندوق عهد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم الصندوق <span className="text-red-500">*</span></Label>
              <Input
                value={fundForm.name}
                onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>اسم أمين العهدة</Label>
                <Input
                  value={fundForm.custodianName}
                  onChange={(e) => setFundForm({ ...fundForm, custodianName: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الرصيد الافتتاحي</Label>
                <Input
                  type="number"
                  value={fundForm.openingBalance}
                  onChange={(e) => setFundForm({ ...fundForm, openingBalance: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الحد الأقصى</Label>
                <Input
                  type="number"
                  value={fundForm.maximumBalance}
                  onChange={(e) => setFundForm({ ...fundForm, maximumBalance: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <div className="flex items-center gap-3 h-11">
                  <Switch
                    checked={fundForm.active}
                    onCheckedChange={(v) => setFundForm({ ...fundForm, active: v })}
                  />
                  <span className="text-sm text-gray-600">
                    {fundForm.active ? 'نشط' : 'متوقف'}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea
                value={fundForm.notes}
                onChange={(e) => setFundForm({ ...fundForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              onClick={handleFundSave}
              disabled={fundSaving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {fundSaving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل حركة عهد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {fundDetails && (
              <div className="bg-[#610000]/5 rounded-lg p-3 text-sm">
                <p>الصندوق: <span className="font-bold">{fundDetails.name}</span></p>
                <p>الرصيد الحالي: <span className="font-mono font-bold">{formatCurrency(fundDetails.currentBalance)}</span></p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>نوع الحركة <span className="text-red-500">*</span></Label>
                <Select
                  value={txForm.type}
                  onValueChange={(v) => setTxForm({ ...txForm, type: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PETTY_CASH_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المبلغ <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>التاريخ <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={txForm.date}
                  onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>المستلم</Label>
                <Input
                  value={txForm.recipient}
                  onChange={(e) => setTxForm({ ...txForm, recipient: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>المرجع</Label>
                <Input
                  value={txForm.reference}
                  onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea
                value={txForm.notes}
                onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              onClick={handleTxSave}
              disabled={txSaving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {txSaving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              تسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الصندوق «{deleteTarget?.name}»؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white min-h-[44px]"
            >
              {deleting && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
