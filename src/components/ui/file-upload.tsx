'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, Loader2, Link, Image as ImageIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface FileUploadProps {
  value: string
  onChange: (url: string) => void
  fileName?: string
  onFileNameChange?: (name: string) => void
  folder?: string
  label?: string
  placeholder?: string
  required?: boolean
  accept?: string
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(url)
}

function getFileIcon(url: string) {
  if (isImageUrl(url)) return ImageIcon
  return FileText
}

export function FileUpload({
  value,
  onChange,
  fileName = '',
  onFileNameChange,
  folder = 'general',
  label = 'الملف',
  placeholder = 'أدخل رابط الملف أو ارفع من جهازك',
  required = false,
  accept = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return
    }

    // Show local preview for images
    if (file.type.startsWith('image/')) {
      const localPreview = URL.createObjectURL(file)
      setPreview(localPreview)
    } else {
      setPreview(null)
    }

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
        // Auto-set file name from the original file name
        if (onFileNameChange && file.name) {
          onFileNameChange(file.name)
        }
      }
    } catch (error) {
      console.error('Upload failed:', error)
      setPreview(null)
    } finally {
      setUploading(false)
      // Clean up preview object URL
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [folder, onChange, onFileNameChange, preview])

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

  const clearFile = () => {
    onChange('')
    setPreview(null)
    if (onFileNameChange) {
      onFileNameChange('')
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const displayUrl = preview || value
  const isImage = displayUrl ? isImageUrl(displayUrl) : false
  const FileIcon = displayUrl ? getFileIcon(displayUrl) : FileText

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
              رفع ملف
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
              {isImage ? (
                <img
                  src={displayUrl}
                  alt="معاينة"
                  className="w-full max-h-48 object-contain rounded-xl p-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-6 px-4">
                  <div className="w-16 h-16 rounded-full bg-[#610000]/10 flex items-center justify-center mb-2">
                    <FileIcon className="w-8 h-8 text-[#610000]" />
                  </div>
                  <p className="text-sm font-medium text-[#1a1a2e] truncate max-w-full">
                    {fileName || 'ملف مرفق'}
                  </p>
                </div>
              )}
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
                  تغيير الملف
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="min-h-[36px]"
                  onClick={clearFile}
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
                  <FileText className="w-7 h-7 text-[#610000]" />
                </div>
              )}
              <p className="text-sm font-medium text-[#1a1a2e]">
                {uploading ? 'جاري رفع الملف...' : 'اضغط أو اسحب الملف هنا'}
              </p>
              {!uploading && (
                <p className="text-xs text-gray-400 mt-1">
                  PDF, صور, مستندات — حد أقصى 10 ميجابايت
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
              onClick={clearFile}
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
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* File name display and URL when uploaded */}
      {value && mode === 'upload' && (
        <div className="space-y-1">
          {fileName && (
            <p className="text-xs font-medium text-[#1a1a2e] truncate">
              {fileName}
            </p>
          )}
          <p className="text-xs text-gray-400 truncate" dir="ltr">
            {value}
          </p>
        </div>
      )}
    </div>
  )
}
