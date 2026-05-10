'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import type { NewsItem } from './types'

interface NewsTickerProps {
  showNewsTicker: boolean
  news: NewsItem[]
}

export function NewsTicker({ showNewsTicker, news }: NewsTickerProps) {
  if (!showNewsTicker || news.length === 0) return null

  return (
    <section className="bg-m3-surface-container-high border-b border-m3-outline-variant overflow-hidden">
      <div className="max-w-[1280px] mx-auto flex items-center">
        <Badge className="bg-red-600 text-white shrink-0 rounded-none px-4 py-1.5 text-sm font-bold min-h-[38px] flex items-center gap-1.5">
          <span className="material-symbols-outlined filled text-lg">campaign</span>
          عاجل
        </Badge>
        <div className="overflow-hidden flex-1 mr-4">
          <div className="animate-news-ticker whitespace-nowrap py-2.5 text-sm font-bold">
            {[...news, ...news].map((item, i) => (
              <span key={`${item.id}-${i}`} className="inline-block mx-8">
                <span className="text-m3-primary ml-2 text-base">◆</span>
                <span className="font-bold">{item.title}</span>
                <span className="text-m3-on-surface-variant/30 mx-4">|</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
