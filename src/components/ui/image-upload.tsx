'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, Link } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  folder?: string
  label?: string
  placeholder?: string
  required?: boolean
}

export function ImageUpload({
  value,
  onChange,
  folder = 'general',
  label = 'الصورة',
  placeholder = 'أدخل رابط الصورة أو ارفع من جهازك',
  required = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        onChange(data.url)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      setPreview(null)
    } finally {
      setUploading(false)
      // Clean up the object URL
      URL.revokeObjectURL(localPreview)
    }
  }, [folder, onChange])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const clearImage = () => {
    onChange('')
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const displayUrl = preview || value

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setMode(mode === 'upload' ? 'url' : 'upload')}
        >
          {mode === 'upload' ? (
            <>
              <Link className="w-3 h-3" />
              إدخال رابط
            </>
          ) : (
            <>
              <Upload className="w-3 h-3" />
              رفع صورة
            </>
          )}
        </Button>
      </div>

      {mode === 'upload' ? (
        <div
          className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
            dragOver
              ? 'border-[#610000] bg-[#610000]/5 scale-[1.01]'
              : 'border-gray-200 hover:border-[#610000]/40 hover:bg-gray-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {displayUrl ? (
            <div className="relative group">
              <img
                src={displayUrl}
                alt="معاينة"
                className="w-full max-h-48 object-contain rounded-xl p-2"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-[36px]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-3.5 h-3.5 ml-1" />
                  تغيير الصورة
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="min-h-[36px]"
                  onClick={clearImage}
                  disabled={uploading}
                >
                  <X className="w-3.5 h-3.5 ml-1" />
                  إزالة
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-8 px-4 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="w-10 h-10 text-[#610000] animate-spin mb-2" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#610000]/10 flex items-center justify-center mb-3">
                  <ImageIcon className="w-7 h-7 text-[#610000]" />
                </div>
              )}
              <p className="text-sm font-medium text-[#1a1a2e]">
                {uploading ? 'جاري رفع الصورة...' : 'اضغط أو اسحب الصورة هنا'}
              </p>
              {!uploading && (
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG, GIF, WebP, SVG — حد أقصى 5 ميجابايت
                </p>
              )}
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center">
              <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow-lg">
                <Loader2 className="w-5 h-5 text-[#610000] animate-spin" />
                <span className="text-sm font-medium">جاري الرفع...</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-11"
            dir="ltr"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 min-h-[44px] px-2"
              onClick={clearImage}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* URL display when uploaded */}
      {value && mode === 'upload' && (
        <p className="text-xs text-gray-400 truncate" dir="ltr">
          {value}
        </p>
      )}
    </div>
  )
}
