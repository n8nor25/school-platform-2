'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Mail, MapPin, Phone, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { SchoolInfo } from './types'

interface ContactSectionProps {
  showContact: boolean
  school: Pick<SchoolInfo, 'address' | 'phone' | 'email'>
}

export function ContactSection({ showContact, school }: ContactSectionProps) {
  if (!(showContact ?? true)) return null

  return (
    <section id="contact" className="py-12 md:py-16 bg-m3-surface-container-lowest">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="text-center mb-10">
          <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-3">
            <Mail className="w-3.5 h-3.5 ml-1" />
            تواصل معنا
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">نحن هنا لمساعدتك</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Info Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <Card className="border-0 shadow-md bg-gradient-to-bl from-m3-primary to-m3-primary-container text-white">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-6">معلومات التواصل</h3>
                <div className="space-y-4">
                  {school.address && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-white/70 text-sm">العنوان</p>
                        <p className="font-medium">{school.address}</p>
                      </div>
                    </div>
                  )}
                  {school.phone && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-white/70 text-sm">الهاتف</p>
                        <a href={`tel:${school.phone}`} className="font-medium hover:text-white/80 transition-colors" dir="ltr">
                          {school.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {school.email && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-white/70 text-sm">البريد الإلكتروني</p>
                        <a href={`mailto:${school.email}`} className="font-medium hover:text-white/80 transition-colors" dir="ltr">
                          {school.email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Google Maps */}
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="bg-m3-primary text-m3-on-primary px-4 py-2.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">location_on</span>
                <h3 className="font-bold text-sm">موقعنا على الخريطة</h3>
              </div>
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(school.address)}&output=embed`}
                width="100%"
                height="250"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="موقع المدرسة على الخريطة"
                className="w-full"
              />
            </Card>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="border-0 shadow-md h-full">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-m3-on-surface mb-6">أرسل رسالة</h3>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                  }}
                >
                  <div>
                    <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">الاسم</label>
                    <Input placeholder="اسمك الكامل" className="h-11" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">البريد الإلكتروني</label>
                    <Input type="email" placeholder="بريدك الإلكتروني" className="h-11" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">الموضوع</label>
                    <Input placeholder="موضوع الرسالة" className="h-11" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">الرسالة</label>
                    <Textarea placeholder="اكتب رسالتك هنا..." className="min-h-[100px]" />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 bg-m3-primary hover:bg-m3-primary-container text-m3-on-primary min-h-[44px]"
                  >
                    <Send className="w-4 h-4 ml-2" />
                    إرسال الرسالة
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
