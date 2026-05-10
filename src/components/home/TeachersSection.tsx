'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Mail, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay as SwiperAutoplay, EffectCreative } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import 'swiper/css/effect-creative'
import type { Teacher } from './types'
import { getSubjectColor } from './constants'

interface TeachersSectionProps {
  showTeachers: boolean
  teachers: Teacher[]
}

export function TeachersSection({ showTeachers, teachers }: TeachersSectionProps) {
  if (!(showTeachers ?? true) || teachers.length === 0) return null

  return (
    <section id="teachers" className="py-12 md:py-16 bg-m3-surface-container-lowest overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="text-center mb-10">
          <Badge className="bg-m3-secondary/10 text-m3-secondary hover:bg-m3-secondary/20 mb-3">
            <Users className="w-3.5 h-3.5 ml-1" />
            كادرنا التعليمي
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface mb-2">مدرسونا المميزون</h2>
          <p className="text-m3-on-surface-variant text-sm max-w-lg mx-auto">
            اكتشف فريقنا من المعلمين المتميزين والمحترفين في مجال التعليم
          </p>
        </div>
        <Swiper
          modules={[Navigation, Pagination, SwiperAutoplay, EffectCreative]}
          spaceBetween={24}
          slidesPerView={1}
          navigation
          pagination={{ clickable: true }}
          autoplay={{ delay: 2500, disableOnInteraction: false, pauseOnMouseEnter: true }}
          loop={teachers.length > 3}
          dir="rtl"
          effect="creative"
          creativeEffect={{
            prev: {
              shadow: true,
              translate: ['-20%', 0, -1],
              opacity: 0.6,
              scale: 0.9,
            },
            next: {
              translate: ['100%', 0, 0],
              opacity: 1,
              scale: 1,
            },
          }}
          breakpoints={{
            640: { slidesPerView: 2, effect: 'slide' },
            768: { slidesPerView: 3, effect: 'slide' },
            1024: { slidesPerView: 4, effect: 'slide' },
          }}
          className="teachers-swiper pb-12"
        >
          {teachers.map((teacher, index) => (
            <SwiperSlide key={teacher.id}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                className="bg-white rounded-2xl shadow-md overflow-hidden group hover:shadow-xl transition-all duration-400 border border-gray-100"
              >
                {/* Teacher Image */}
                <div className="relative aspect-[3/4] overflow-hidden">
                  {teacher.imageUrl ? (
                    <img
                      src={teacher.imageUrl}
                      alt={teacher.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-m3-primary via-m3-primary/90 to-m3-primary-container flex items-center justify-center">
                      <span className="text-6xl font-bold text-white/70 group-hover:scale-110 transition-transform duration-500">{teacher.name.charAt(0)}</span>
                    </div>
                  )}
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Role Badge */}
                  <div className={`absolute top-3 left-3 ${getSubjectColor(teacher.subject)} text-white text-xs px-3 py-1 rounded-full font-medium shadow-md`}>
                    {teacher.subject}
                  </div>

                  {/* Name overlay on hover */}
                  <div className="absolute bottom-0 right-0 left-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
                    <h3 className="font-bold text-white text-lg drop-shadow-lg">{teacher.name}</h3>
                    <p className="text-white/80 text-sm">{teacher.subject}</p>
                  </div>
                </div>
                {/* Teacher Info */}
                <div className="p-4 text-center group-hover:bg-m3-primary/5 transition-colors duration-300">
                  <h3 className="font-bold text-m3-on-surface text-base mb-0.5">{teacher.name}</h3>
                  <p className="text-sm text-m3-on-surface-variant mb-1.5">{teacher.subject}</p>
                  {teacher.email && (
                    <div className="flex items-center justify-center gap-1 text-xs text-m3-on-surface-variant">
                      <Mail className="w-3 h-3" />
                      <span dir="ltr" className="truncate">{teacher.email}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  )
}
