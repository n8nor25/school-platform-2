'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface ServicesSectionProps {
  showServices: boolean
  onShowResults: () => void
  onShowSchedules: () => void
  onShowParents: () => void
  onShowLibrary: () => void
}

export function ServicesSection({ showServices, onShowResults, onShowSchedules, onShowParents, onShowLibrary }: ServicesSectionProps) {
  if (!(showServices ?? true)) return null

  const services = [
    {
      icon: 'clipboard_list',
      title: 'الاستعلام عن النتائج',
      description: 'استعلم عن نتائجك الأكاديمية بسهولة',
      color: 'from-emerald-500 to-emerald-600',
      action: onShowResults,
    },
    {
      icon: 'calendar_month',
      title: 'جداول الحصص',
      description: 'عرض جداول الحصص اليومية والأسبوعية',
      color: 'from-amber-500 to-amber-600',
      action: onShowSchedules,
    },
    {
      icon: 'family_restroom',
      title: 'بوابة أولياء الأمور',
      description: 'متابعة أداء ابنكم الأكاديمي',
      color: 'from-sky-500 to-sky-600',
      action: onShowParents,
    },
    {
      icon: 'auto_stories',
      title: 'المكتبة الرقمية',
      description: 'تصفح الكتب والمراجع الرقمية',
      color: 'from-purple-500 to-purple-600',
      action: onShowLibrary,
    },
    {
      icon: 'language',
      title: 'التحول الرقمي',
      description: 'خدمات التحول الرقمي للمدرسة',
      color: 'from-teal-500 to-teal-600',
      action: onShowSchedules,
    },
    {
      icon: 'forum',
      title: 'التواصل مع الإدارة',
      description: 'تواصل مع إدارة المدرسة مباشرة',
      color: 'from-rose-500 to-rose-600',
      action: () => {
        const el = document.getElementById('contact')
        el?.scrollIntoView({ behavior: 'smooth' })
      },
    },
  ]

  return (
    <section id="services" className="py-12 md:py-16 bg-m3-surface-container-lowest">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="text-center mb-10">
          <Badge className="bg-m3-secondary/10 text-m3-secondary hover:bg-m3-secondary/20 mb-3">
            <Globe className="w-3.5 h-3.5 ml-1" />
            خدماتنا
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">الخدمات الإلكترونية</h2>
          <p className="text-m3-on-surface-variant text-sm mt-2 max-w-lg mx-auto">استفد من خدماتنا الإلكترونية المتنوعة بسهولة وسرعة</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="overflow-hidden group hover:shadow-xl transition-all duration-300 h-full cursor-pointer"
                onClick={service.action}
              >
                <div className={`h-2 bg-gradient-to-l ${service.color}`} />
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-bl ${service.color} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <span className="material-symbols-outlined text-white text-2xl">{service.icon}</span>
                  </div>
                  <h3 className="font-bold text-m3-on-surface text-lg mb-2 group-hover:text-m3-primary transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-sm text-m3-on-surface-variant mb-4 leading-relaxed">
                    {service.description}
                  </p>
                  <span className="inline-flex items-center text-m3-primary text-sm font-medium group-hover:gap-2 transition-all gap-1">
                    المزيد
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
