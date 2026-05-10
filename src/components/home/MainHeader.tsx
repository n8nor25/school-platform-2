'use client'

import React from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SchoolInfo, SchoolSettings } from './types'

interface MainHeaderProps {
  school: Pick<SchoolInfo, 'name' | 'logoUrl'>
  settings: Pick<SchoolSettings, 'heroSubtitle' | 'showHeroBanner' | 'bannerImageUrl' | 'bannerTitle'> | null
  handleLogoClick: () => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}

export function MainHeader({ school, settings, handleLogoClick, mobileMenuOpen, setMobileMenuOpen }: MainHeaderProps) {
  return (
    <header className="bg-m3-surface-container-lowest shadow-sm border-b border-m3-outline-variant/30">
      <div className="max-w-[1280px] mx-auto px-4 py-1.5 flex items-center gap-3">
        {/* Right side in RTL: School Logo & Name (يمنى) */}
        <div className="flex items-center gap-2 shrink-0">
          <div onClick={handleLogoClick} className="cursor-pointer" title="اضغط 5 مرات للدخول للإدارة">
            {school.logoUrl ? (
              <img src={school.logoUrl} alt={school.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-m3-primary/30 shadow-md hover:shadow-lg transition-shadow" />
            ) : (
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-m3-primary to-m3-primary-container flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                <span className="material-symbols-outlined text-m3-on-primary text-lg md:text-xl">account_balance</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base lg:text-lg font-bold text-m3-primary truncate">{school.name}</h1>
            {settings?.heroSubtitle && (
              <p className="text-[10px] md:text-xs text-m3-on-surface-variant mt-0 truncate max-w-[200px] md:max-w-none">{settings.heroSubtitle}</p>
            )}
          </div>
        </div>

        {/* Left side in RTL: Banner Ad (يسرى - يتمدد) */}
        <div className="flex-1 min-w-0">
          {settings?.showHeroBanner ? (
            <div className="relative h-10 md:h-14 rounded-lg overflow-hidden hidden md:block group">
              <img
                src={settings.bannerImageUrl || 'https://picsum.photos/seed/banner1/800/150'}
                alt={settings.bannerTitle || 'إعلان'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-m3-primary/60 via-m3-primary/30 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-end pr-4">
                <span className="text-white font-bold text-xs md:text-sm drop-shadow-md">
                  {settings.bannerTitle || 'مساحة إعلانية'}
                </span>
              </div>
              {/* Ad badge */}
              <div className="absolute top-1 left-1 bg-black/40 backdrop-blur-sm text-white text-[8px] px-1 py-0.5 rounded font-medium">
                AD
              </div>
            </div>
          ) : (
            <div className="hidden md:block" />
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden min-h-[36px] min-w-[36px] shrink-0"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="القائمة"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>
    </header>
  )
}
