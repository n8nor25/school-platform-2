'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { SchoolInfo } from './types'

interface TopBarProps {
  school: Pick<SchoolInfo, 'name' | 'facebookUrl' | 'email' | 'phone'>
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export function TopBar({ school, searchQuery, setSearchQuery }: TopBarProps) {
  return (
    <div className="bg-m3-primary text-m3-on-primary text-xs">
      <div className="max-w-[1280px] mx-auto px-4 py-0.5 flex flex-wrap items-center justify-between gap-1">
        {/* Right side in RTL = visual left: Social icons */}
        <div className="flex items-center gap-2">
          {school.facebookUrl && (
            <a href={school.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-m3-on-primary-container transition-colors min-h-[24px] flex items-center" aria-label="Facebook">
              <span className="material-symbols-outlined text-sm">public</span>
            </a>
          )}
          {school.email && (
            <a href={`mailto:${school.email}`} className="flex items-center gap-1 hover:text-m3-on-primary-container transition-colors min-h-[24px]">
              <span className="material-symbols-outlined text-sm">mail</span>
            </a>
          )}
          {school.phone && (
            <a href={`tel:${school.phone}`} className="flex items-center gap-1 hover:text-m3-on-primary-container transition-colors min-h-[24px]">
              <span className="material-symbols-outlined text-sm">call</span>
            </a>
          )}
          {/* School Name Display */}
          {school.name && (
            <span className="flex items-center gap-1 text-[10px] text-white/90 bg-white/10 px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-xs">school</span>
              {school.name}
            </span>
          )}
        </div>
        {/* Left side in RTL = visual right: Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              type="search"
              placeholder="بحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-28 h-6 text-[10px] bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:w-40 transition-all rounded-md"
            />
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/50" />
          </div>
        </div>
      </div>
    </div>
  )
}
