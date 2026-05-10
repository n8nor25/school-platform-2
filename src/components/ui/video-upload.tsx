'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Upload, X, Video as VideoIcon, Loader2, Link } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface VideoUploadProps {
  value: string
  onChange: (url: string) => void
  folder?: string
  label?: string
  placeholder?: string
}

function isYouTubeUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)/.test(url)
}

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`
  }
  return null
}

export function VideoUpload({
  value,
  onChange,
  folder = 'videos',
  label = 'الفيديو',
  placeholder = 'أدخل رابط الفيديو (YouTube أو رابط مباشر) أو ارفع من جهازك',
}: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'upload' | 'url'>('url')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      return
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return
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
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
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

  const clearVideo = () => {
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isYoutube = value ? isYouTubeUrl(value) : false
  const embedUrl = value ? getYouTubeEmbedUrl(value) : null
  const isDirectVideo = value && !isYoutube && !value.startsWith('/uploads/') ? false : true

  // Check if the value is a direct video file URL (uploaded or external .mp4 etc.)
  const isVideoFile = value && (value.includes('.mp4') || value.includes('.webm') || value.includes('.ogg') || value.startsWith('/uploads/'))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
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
              رفع فيديو
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
          {value ? (
            <div className="relative group">
              {isYoutube && embedUrl ? (
                <div className="aspect-video rounded-xl overflow-hidden">
                  <iframe
                    src={embedUrl}
                    title="معاينة الفيديو"
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              ) : isVideoFile ? (
                <div className="aspect-video rounded-xl overflow-hidden bg-black">
                  <video
                    src={value}
                    controls
                    className="w-full h-full object-contain"
                  >
                    <track kind="captions" />
                  </video>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 px-4 gap-3">
                  <VideoIcon className="w-8 h-8 text-[#610000]" />
                  <div>
                    <p className="text-sm font-medium text-[#1a1a2e]">تم تعيين رابط الفيديو</p>
                    <p className="text-xs text-gray-400 truncate max-w-[200px]" dir="ltr">{value}</p>
                  </div>
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
                  تغيير الفيديو
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="min-h-[36px]"
                  onClick={clearVideo}
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
                  <VideoIcon className="w-7 h-7 text-[#610000]" />
                </div>
              )}
              <p className="text-sm font-medium text-[#1a1a2e]">
                {uploading ? 'جاري رفع الفيديو...' : 'اضغط أو اسحب الفيديو هنا'}
              </p>
              {!uploading && (
                <p className="text-xs text-gray-400 mt-1">
                  MP4, WebM, OGG — حد أقصى 50 ميجابايت
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
        <div className="space-y-2">
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
                onClick={clearVideo}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            يدعم روابط YouTube أو روابط مباشرة لملفات الفيديو (mp4, webm)
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
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
