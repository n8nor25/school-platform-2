'use client'

import React from 'react'
import { Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react'
import type { SchoolInfo, SchoolSettings } from './types'
import { navLinks } from './constants'

interface SchoolFooterProps {
  school: Pick<SchoolInfo, 'name' | 'description' | 'logoUrl' | 'address' | 'phone' | 'email' | 'facebookUrl'>
  settings: Pick<SchoolSettings, 'youtubeUrl'> | null
  onShowStudentLife: () => void
  onShowResults: () => void
  onShowSchedules: () => void
  onShowLibrary: () => void
  onShowParents: () => void
}

export function SchoolFooter({
  school,
  settings,
  onShowStudentLife,
  onShowResults,
  onShowSchedules,
  onShowLibrary,
  onShowParents,
}: SchoolFooterProps) {
  const handleServiceAction = (action: string) => {
    if (action === 'results') onShowResults()
    if (action === 'schedules') onShowSchedules()
    if (action === 'library') onShowLibrary()
    if (action === 'parents') onShowParents()
  }

  return (
    <footer className="bg-[#2A374E] text-white mt-auto">
      {/* Egyptian Flag Strip */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-red-600" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-black" />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* School Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {school.logoUrl ? (
                <img src={school.logoUrl} alt={school.name} className="w-12 h-12 rounded-full object-cover border-2 border-red-500 shadow-lg" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-white text-2xl">account_balance</span>
                </div>
              )}
              <h3 className="font-bold text-lg leading-tight">{school.name}</h3>
            </div>
            {school.description && (
              <p className="text-gray-300 text-sm leading-relaxed mb-4 line-clamp-3">{school.description}</p>
            )}
            <div className="flex gap-2.5">
              {school.facebookUrl && (
                <a href={school.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" aria-label="Facebook">
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {settings?.youtubeUrl && (
                <a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" aria-label="YouTube">
                  <Youtube className="w-4 h-4" />
                </a>
              )}
              {school.email && (
                <a href={`mailto:${school.email}`} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" aria-label="Email">
                  <Mail className="w-4 h-4" />
                </a>
              )}
              <a href="https://wa.me/200931234567" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors" aria-label="WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-red-400">روابط سريعة</h3>
            <ul className="space-y-2">
              {navLinks.filter(link => !link.isServicesDropdown).map((link) => (
                <li key={link.href}>
                  <a
                    href={link.isStudentLife ? undefined : link.href}
                    onClick={(e) => {
                      if (link.isStudentLife) { e.preventDefault(); onShowStudentLife() }
                    }}
                    className="text-gray-300 hover:text-red-400 transition-colors text-sm flex items-center gap-2 min-h-[36px]"
                  >
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* E-Services */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-red-400">الخدمات الإلكترونية</h3>
            <ul className="space-y-2">
              {[
                { label: 'نتائج الطلاب', action: 'results' },
                { label: 'جداول الحصص', action: 'schedules' },
                { label: 'المكتبة الرقمية', action: 'library' },
                { label: 'أولياء الأمور', action: 'parents' },
                { label: 'شكاوى ومقترحات', href: '#contact' },
              ].map((link) => (
                <li key={link.label}>
                  {link.action ? (
                    <button
                      onClick={() => handleServiceAction(link.action!)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-sm flex items-center gap-2 min-h-[36px]"
                    >
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      {link.label}
                    </button>
                  ) : (
                    <a href={link.href} className="text-gray-300 hover:text-red-400 transition-colors text-sm flex items-center gap-2 min-h-[36px]">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info + Designer */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-red-400">تواصل معنا</h3>
            <div className="space-y-3">
              {school.address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-gray-300 text-sm">{school.address}</span>
                </div>
              )}
              {school.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <a href={`tel:${school.phone}`} className="text-gray-300 hover:text-red-400 transition-colors text-sm" dir="ltr">{school.phone}</a>
                </div>
              )}
              {school.email && (
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <a href={`mailto:${school.email}`} className="text-gray-300 hover:text-red-400 transition-colors text-sm" dir="ltr">{school.email}</a>
                </div>
              )}
            </div>

            {/* Designer Section */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-red-500 shadow-lg shrink-0">
                  <img
                    src="https://res.cloudinary.com/dc7ysj5yq/image/upload/v1777145223/school-website/designer/zttkev3i4cace2yzko9n.png"
                    alt="محروس شعبان - المصمم والمطور"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">تصميم وتطوير</p>
                  <p className="text-white text-sm font-bold">محروس شعبان</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-black/20">
        <div className="max-w-[1280px] mx-auto px-4 py-4">
          <p className="text-center text-gray-400 text-sm">
            © {new Date().getFullYear()} {school.name} - المرحلة الإعدادية. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  )
}
