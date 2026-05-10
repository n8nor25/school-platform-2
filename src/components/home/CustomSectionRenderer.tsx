'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface CustomSection {
  id: string
  title: string
  content: string
  imageUrl: string | null
  layout: string
  active: boolean
  sortOrder: number
}

interface CustomSectionRendererProps {
  sections: CustomSection[]
}

export function CustomSectionRenderer({ sections }: CustomSectionRendererProps) {
  if (!sections || sections.length === 0) return null

  return (
    <>
      {sections.filter(s => s.active).map((section, index) => (
        <motion.div
          key={section.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
        >
          {section.layout === 'full' && (
            <section className="py-12 md:py-16 bg-m3-surface-container">
              <div className="max-w-[1280px] mx-auto px-4">
                <div className="text-center mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">{section.title}</h2>
                </div>
                {section.imageUrl && (
                  <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
                    <img src={section.imageUrl} alt={section.title} className="w-full h-64 md:h-80 object-cover" />
                  </div>
                )}
                {section.content && (
                  <div className="prose prose-lg max-w-none text-m3-on-surface-variant leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content }} />
                )}
              </div>
            </section>
          )}

          {section.layout === 'image-right' && (
            <section className="py-12 md:py-16 bg-m3-surface-container-lowest">
              <div className="max-w-[1280px] mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface mb-4">{section.title}</h2>
                    {section.content && (
                      <div className="prose max-w-none text-m3-on-surface-variant leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content }} />
                    )}
                  </div>
                  {section.imageUrl && (
                    <div className="rounded-2xl overflow-hidden shadow-lg">
                      <img src={section.imageUrl} alt={section.title} className="w-full h-64 md:h-80 object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {section.layout === 'image-left' && (
            <section className="py-12 md:py-16 bg-m3-surface-container">
              <div className="max-w-[1280px] mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  {section.imageUrl && (
                    <div className="rounded-2xl overflow-hidden shadow-lg order-2 md:order-1">
                      <img src={section.imageUrl} alt={section.title} className="w-full h-64 md:h-80 object-cover" />
                    </div>
                  )}
                  <div className={section.imageUrl ? 'order-1 md:order-2' : ''}>
                    <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface mb-4">{section.title}</h2>
                    {section.content && (
                      <div className="prose max-w-none text-m3-on-surface-variant leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content }} />
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {section.layout === 'cards' && (
            <section className="py-12 md:py-16 bg-m3-surface-container-lowest">
              <div className="max-w-[1280px] mx-auto px-4">
                <div className="text-center mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">{section.title}</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {section.imageUrl && (
                    <div className="rounded-2xl overflow-hidden shadow-lg">
                      <img src={section.imageUrl} alt={section.title} className="w-full h-64 object-cover" />
                    </div>
                  )}
                  <div>
                    {section.content && (
                      <div className="prose max-w-none text-m3-on-surface-variant leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content }} />
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      ))}
    </>
  )
}
