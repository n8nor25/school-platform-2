'use client'

import React from 'react'
import { Play, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel'
import Autoplay from 'embla-carousel-autoplay'
import type { SchoolInfo, SchoolSettings, NewsItem, SliderItem } from './types'

interface ContentSliderProps {
  school: Pick<SchoolInfo, 'name'>
  settings: SchoolSettings | null
  loading: boolean
  activeSliders: SliderItem[]
  newsWithImage: NewsItem[]
  activeSliderIndex: number
  setActiveSliderIndex: (index: number) => void
  sliderApi: any
  setSliderApi: (api: any) => void
  alertNews: NewsItem[]
}

export function ContentSlider({
  school,
  settings,
  loading,
  activeSliders,
  newsWithImage,
  activeSliderIndex,
  setActiveSliderIndex,
  sliderApi,
  setSliderApi,
  alertNews,
}: ContentSliderProps) {
  return (
    <section className="max-w-[1280px] mx-auto px-4 py-8">
      <div className="grid grid-cols-12 gap-6">
        {/* Center Section: 10 columns */}
        <section className="col-span-12 lg:col-span-10 flex flex-col gap-6">
          {/* Row 1: 3-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-auto md:h-[400px]">
            {/* a) Image Slider */}
            {(settings?.showSlider ?? true) && (
            <div className={`rounded-lg overflow-hidden shadow-lg relative ${settings?.showLiveStream ? 'md:col-span-5' : 'md:col-span-9'}`}>
              {loading ? (
                <Skeleton className="w-full h-[300px] md:h-full" />
              ) : activeSliders.length > 0 ? (
                <Carousel
                  opts={{ direction: 'rtl', loop: true }}
                  plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
                  setApi={setSliderApi}
                  className="w-full h-full"
                >
                  <CarouselContent className="h-[300px] md:h-[400px]">
                    {activeSliders.map((item) => (
                      <CarouselItem key={item.id}>
                        <div className="relative h-[300px] md:h-[400px] overflow-hidden">
                          <img
                            src={item.imageUrl}
                            alt={item.title || 'سلایدر'}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                          <div className="absolute bottom-0 right-0 left-0 p-5">
                            {item.title && (
                              <h2 className="text-lg md:text-xl font-bold text-white mb-1 leading-relaxed line-clamp-2">
                                {item.title}
                              </h2>
                            )}
                            {item.subtitle && (
                              <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="right-3 left-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                  <CarouselNext className="left-3 right-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                </Carousel>
              ) : newsWithImage.length > 0 ? (
                <Carousel
                  opts={{ direction: 'rtl', loop: true }}
                  plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
                  setApi={setSliderApi}
                  className="w-full h-full"
                >
                  <CarouselContent className="h-[300px] md:h-[400px]">
                    {newsWithImage.map((item, index) => (
                      <CarouselItem key={item.id}>
                        <div className="relative h-[300px] md:h-[400px] overflow-hidden">
                          <img
                            src={item.image || `https://picsum.photos/seed/school${index + 10}/800/400`}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                          <div className="absolute bottom-0 right-0 left-0 p-5">
                            <Badge className="mb-2 bg-m3-primary text-m3-on-primary text-xs">
                              {item.category}
                            </Badge>
                            <h2 className="text-lg md:text-xl font-bold text-white mb-1 leading-relaxed line-clamp-2">
                              {item.title}
                            </h2>
                            {item.excerpt && (
                              <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">
                                {item.excerpt}
                              </p>
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="right-3 left-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                  <CarouselNext className="left-3 right-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                </Carousel>
              ) : (
                <div className="h-full bg-gradient-to-br from-m3-primary to-m3-primary-container flex items-center justify-center">
                  <div className="text-center text-white px-4">
                    <span className="material-symbols-outlined text-5xl mb-3 opacity-50">school</span>
                    <h2 className="text-xl md:text-2xl font-bold mb-1">{settings?.heroTitle || school.name}</h2>
                    <p className="text-white/70">{settings?.heroSubtitle || 'نحو تعليم متميز'}</p>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* b) Headlines synced with slider */}
            <div className="md:col-span-3 bg-m3-surface-container-low rounded-lg shadow-md overflow-hidden flex flex-col h-[350px] md:h-full">
              {(() => {
                const headlineItems = activeSliders.length > 0
                  ? activeSliders.map(s => ({ id: s.id, title: s.title || '', subtitle: s.subtitle || '', category: 'سلایدر' }))
                  : newsWithImage.map(n => ({ id: n.id, title: n.title, subtitle: n.excerpt || '', category: n.category }))

                return headlineItems.length > 0 ? (
                  <div className="flex flex-col h-full">
                    {/* Headline header */}
                    <div className="bg-m3-primary text-m3-on-primary px-4 py-2 flex items-center gap-2 shrink-0">
                      <span className="material-symbols-outlined text-lg">article</span>
                      <h3 className="font-bold text-sm">العناوين</h3>
                    </div>
                    {/* Headlines List - full height */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <div className="flex flex-col gap-1 p-2">
                        {headlineItems.map((item, i) => (
                          <div
                            key={item.id}
                            className={`w-full text-right px-3 py-2.5 rounded-md transition-all duration-300 cursor-pointer ${
                              i === activeSliderIndex
                                ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                                : 'bg-m3-primary/10 text-m3-on-surface hover:bg-m3-primary/20'
                            }`}
                            onClick={() => {
                              setActiveSliderIndex(i)
                              sliderApi?.scrollTo(i)
                            }}
                          >
                            <h4 className="text-xs font-bold leading-relaxed line-clamp-2">{item.title}</h4>
                            {item.subtitle && i === activeSliderIndex && (
                              <p className="text-[10px] mt-1 opacity-80 line-clamp-2">{item.subtitle}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-m3-on-surface-variant text-sm p-4">
                      <span className="material-symbols-outlined text-3xl mb-2 opacity-40 block">newspaper</span>
                      لا توجد عناوين
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* c) Live Stream */}
            {settings?.showLiveStream && (
              <div className="md:col-span-4 rounded-lg overflow-hidden shadow-lg relative h-[250px] md:h-full bg-black">
                {settings.liveStreamUrl ? (
                  <>
                    <img
                      src="https://picsum.photos/seed/livestream/600/400"
                      alt="بث مباشر"
                      className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <a
                        href={settings.liveStreamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center mb-3 hover:bg-red-700 transition-colors shadow-lg"
                      >
                        <Play className="w-8 h-8 text-white mr-[-2px]" />
                      </a>
                      <Badge className="bg-red-600 text-white text-xs mb-2">LIVE STREAM</Badge>
                      <p className="text-white font-bold text-sm">بث مباشر من المسرح</p>
                    </div>
                    <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/50 rounded-full px-2.5 py-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-white text-xs font-medium">1.2k</span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-m3-primary/80 to-m3-primary-container/80">
                    <span className="material-symbols-outlined text-5xl text-white/40 mb-4">calendar_live</span>
                    <Badge className="bg-m3-primary text-m3-on-primary text-xs mb-3">LIVE STREAM</Badge>
                    <p className="text-white font-bold text-sm mb-2">بث مباشر</p>
                    <p className="text-white/60 text-xs text-center px-4">سيتم إضافة رابط البث المباشر قريباً</p>
                  </div>
                )}
              </div>
            )}
          </div>

        </section>

        {/* Right Sidebar: 2 columns */}
        <aside className="col-span-12 lg:col-span-2">
          <div className="bg-m3-surface-container-lowest rounded-lg shadow-md overflow-hidden">
            <div className="bg-m3-primary text-m3-on-primary px-4 py-2.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg filled">notification_important</span>
              <h3 className="font-bold text-sm">تنبيهات هامة</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {alertNews.length > 0 ? (
                alertNews.map((item) => (
                  <div key={item.id} className="p-3 border-b border-m3-outline-variant/30 hover:bg-m3-surface-container transition-colors cursor-pointer">
                    <div className="flex items-center gap-1.5 text-xs text-m3-on-surface-variant mb-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <h4 className="text-sm font-bold text-m3-on-surface line-clamp-2 leading-relaxed mb-1 hover:text-m3-primary transition-colors">
                      {item.title}
                    </h4>
                    {item.excerpt && (
                      <p className="text-xs text-m3-on-surface-variant line-clamp-2 leading-relaxed">
                        {item.excerpt}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-m3-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-3xl mb-2 opacity-40 block">notifications_off</span>
                  لا توجد تنبيهات حالياً
                </div>
              )}
            </div>
            {alertNews.length > 0 && (
              <div className="p-3 border-t border-m3-outline-variant/30">
                <Button variant="ghost" className="w-full text-m3-primary hover:text-m3-primary-container text-xs h-8">
                  عرض جميع التنبيهات
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
