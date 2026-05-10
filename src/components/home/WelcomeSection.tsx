'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Star, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SchoolInfo, SchoolSettings } from './types'

interface WelcomeSectionProps {
  school: Pick<SchoolInfo, 'name' | 'description'>
  settings: Pick<SchoolSettings, 'showAbout' | 'aboutVideoUrl' | 'aboutImage' | 'vision'> | null
}

export function WelcomeSection({ school, settings }: WelcomeSectionProps) {
  if (!(settings?.showAbout ?? true)) return null

  return (
    <section id="welcome" className="py-12 md:py-16 bg-m3-surface-container-lowest">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            {settings?.aboutVideoUrl ? (
              <div className="rounded-2xl overflow-hidden shadow-xl">
                {(() => {
                  const ytMatch = settings.aboutVideoUrl!.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
                  if (ytMatch) {
                    return (
                      <div className="aspect-[4/3]">
                        <iframe
                          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                          title="فيديو عن المدرسة"
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    )
                  }
                  return (
                    <div className="aspect-[4/3] bg-black">
                      <video
                        src={settings.aboutVideoUrl!}
                        controls
                        className="w-full h-full object-contain"
                        preload="metadata"
                      >
                        <track kind="captions" />
                      </video>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                <img
                  src={settings?.aboutImage || 'https://picsum.photos/seed/schoolwelcome/600/450'}
                  alt="عن المدرسة"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="absolute -bottom-4 -left-4 bg-m3-secondary text-white px-6 py-3 rounded-xl shadow-lg hidden md:block">
              <p className="font-bold text-lg">نحو التميز</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-4">
              <Star className="w-3.5 h-3.5 ml-1" />
              رسالة المدرسة
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface mb-4">
              مرحباً بكم في {school.name}
            </h2>
            {school.description && (
              <p className="text-m3-on-surface-variant leading-relaxed mb-4 text-base">
                {school.description}
              </p>
            )}
            {settings?.vision && (
              <div className="bg-gradient-to-l from-m3-secondary/5 to-m3-secondary/10 rounded-xl p-5 border border-m3-secondary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-m3-secondary" />
                  <h3 className="font-bold text-m3-secondary">رؤيتنا</h3>
                </div>
                <p className="text-m3-on-surface-variant leading-relaxed text-sm">
                  {settings.vision}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
