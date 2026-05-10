'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Camera } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { GalleryItem } from './types'

interface GallerySectionProps {
  showGallery: boolean
  gallery: GalleryItem[]
}

export function GallerySection({ showGallery, gallery }: GallerySectionProps) {
  if (!(showGallery ?? true) || gallery.length === 0) return null

  return (
    <section id="gallery" className="py-12 md:py-16 bg-m3-surface-container">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="text-center mb-10">
          <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-3">
            <Camera className="w-3.5 h-3.5 ml-1" />
            معرض الصور
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">معرض الصور</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {gallery.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group relative aspect-square rounded-xl overflow-hidden shadow-md cursor-pointer"
            >
              <img
                src={item.imageUrl}
                alt={item.title || 'صورة من المعرض'}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                {item.title && (
                  <p className="text-white text-sm font-medium">{item.title}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
