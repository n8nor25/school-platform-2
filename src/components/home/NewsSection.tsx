'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Clock, TrendingUp, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { NewsItem } from './types'

interface NewsSectionProps {
  showNews: boolean
  loading: boolean
  news: NewsItem[]
}

export function NewsSection({ showNews, loading, news }: NewsSectionProps) {
  if (!(showNews ?? true)) return null

  return (
    <section id="news" className="py-12 md:py-16 bg-m3-surface-container">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="text-center mb-10">
          <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-3">
            <TrendingUp className="w-3.5 h-3.5 ml-1" />
            آخر الأخبار
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">أحدث الأخبار والفعاليات</h2>
        </div>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="w-full h-48" />
                <CardContent className="pt-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.slice(0, 6).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 h-full">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={item.image || `https://picsum.photos/seed/news${index + 20}/400/250`}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-m3-primary text-m3-on-primary text-xs">
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="pt-4 pb-2">
                    <div className="flex items-center gap-2 text-xs text-m3-on-surface-variant mb-2">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <h3 className="font-bold text-m3-on-surface mb-2 line-clamp-2 group-hover:text-m3-primary transition-colors leading-relaxed">
                      {item.title}
                    </h3>
                    {item.excerpt && (
                      <p className="text-sm text-m3-on-surface-variant line-clamp-2 leading-relaxed">
                        {item.excerpt}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto text-m3-on-surface-variant/30 mb-3" />
            <p className="text-m3-on-surface-variant/50">لا توجد أخبار حالياً</p>
          </div>
        )}
      </div>
    </section>
  )
}
