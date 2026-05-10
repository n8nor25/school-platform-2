'use client'

import React, { useState } from 'react'
import { LogIn, School, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAdminStore } from '@/lib/admin-store'
import { toast } from 'sonner'

export function AdminLogin({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAdminStore()

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error('يرجى إدخال اسم المستخدم وكلمة المرور')
      return
    }
    setLoading(true)
    const success = await login(username, password)
    setLoading(false)
    if (success) {
      toast.success('تم تسجيل الدخول بنجاح')
      onOpenChange(false)
      setUsername('')
      setPassword('')
    } else {
      toast.error('اسم المستخدم أو كلمة المرور غير صحيحة')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center">
              <School className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-right">لوحة الإدارة</DialogTitle>
              <DialogDescription className="text-right">سجل دخولك للوصول إلى لوحة التحكم</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>اسم المستخدم</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="h-11 mt-1.5"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <Label>كلمة المرور</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 mt-1.5"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleLogin}
              disabled={loading}
              className="flex-1 bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري الدخول...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  تسجيل الدخول
                </span>
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
