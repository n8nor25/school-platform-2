'use client'

import React from 'react'
import { motion } from 'framer-motion'
import type { SchoolStats } from './types'

interface StatsBarProps {
  showStats: boolean
  stats: SchoolStats | null
}

export function StatsBar({ showStats, stats }: StatsBarProps) {
  if (!(showStats ?? true) || !stats || (stats.students === 0 && stats.teachers === 0)) return null

  const statItems = [
    { icon: 'group', label: 'طلاب', value: stats.students },
    { icon: 'school', label: 'معلمون', value: stats.teachers },
    { icon: 'menu_book', label: 'فصول', value: stats.classes },
    { icon: 'military_tech', label: 'سنوات خبرة', value: stats.years },
  ]

  return (
    <section className="bg-gradient-to-l from-m3-primary to-m3-primary-container">
      <div className="max-w-[1280px] mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center text-white"
          >
            <span className="material-symbols-outlined text-4xl mb-2 text-white/80 block mx-auto">{stat.icon}</span>
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="text-white/70 text-sm mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
