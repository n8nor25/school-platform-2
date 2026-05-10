'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { navLinks, serviceDropdownItems } from './constants'

interface NavigationBarProps {
  activeNavIndex: number
  setActiveNavIndex: (index: number) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  onShowStudentLife: () => void
  onShowResults: () => void
  onShowSchedules: () => void
  onShowLibrary: () => void
  onShowParents: () => void
}

export function NavigationBar({
  activeNavIndex,
  setActiveNavIndex,
  mobileMenuOpen,
  setMobileMenuOpen,
  onShowStudentLife,
  onShowResults,
  onShowSchedules,
  onShowLibrary,
  onShowParents,
}: NavigationBarProps) {
  const handleServiceAction = (action: string) => {
    if (action === 'results') onShowResults()
    if (action === 'schedules') onShowSchedules()
    if (action === 'library') onShowLibrary()
    if (action === 'parents') onShowParents()
  }

  return (
    <nav className="bg-m3-on-secondary-fixed text-white shadow-lg border-b-4 border-m3-primary">
      <div className="max-w-[1280px] mx-auto px-4">
        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center h-12">
          {navLinks.map((link, index) => (
            link.isServicesDropdown ? (
              <DropdownMenu key={link.href}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`px-5 h-full flex items-center text-sm font-semibold transition-colors min-h-[44px] gap-1 ${
                      index === activeNavIndex
                        ? 'border-b-2 border-m3-primary-container bg-white/5 text-white'
                        : 'hover:text-m3-primary-container hover:bg-white/5'
                    }`}
                    onClick={() => setActiveNavIndex(index)}
                  >
                    {link.label}
                    <ChevronLeft className="w-3.5 h-3.5 rotate-[-90deg]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white dark:bg-gray-800 border shadow-lg rounded-lg min-w-[200px]">
                  {serviceDropdownItems.map((item) => (
                    <DropdownMenuItem
                      key={item.action}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer hover:bg-m3-primary/10 focus:bg-m3-primary/10 text-gray-800 dark:text-gray-200"
                      onClick={() => handleServiceAction(item.action)}
                    >
                      <span className="material-symbols-outlined text-base text-m3-primary">{item.icon}</span>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <a
                key={link.href}
                href={link.isStudentLife ? undefined : link.href}
                onClick={(e) => {
                  if (link.isStudentLife) {
                    e.preventDefault()
                    onShowStudentLife()
                  }
                  setActiveNavIndex(index)
                }}
                className={`px-5 h-full flex items-center text-sm font-semibold transition-colors min-h-[44px] ${
                  index === activeNavIndex
                    ? 'border-b-2 border-m3-primary-container bg-white/5 text-white'
                    : 'hover:text-m3-primary-container hover:bg-white/5'
                }`}
              >
                {link.label}
              </a>
            )
          ))}
        </div>
        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden"
            >
              {navLinks.map((link, index) => (
                link.isServicesDropdown ? (
                  <div key={link.href} className="border-b border-white/10">
                    <div className="block px-4 py-3 text-sm font-medium text-white min-h-[44px] flex items-center">
                      {link.label}
                    </div>
                    {serviceDropdownItems.map((item) => (
                      <button
                        key={item.action}
                        onClick={() => {
                          handleServiceAction(item.action)
                          setMobileMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-8 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors min-h-[40px]"
                      >
                        <span className="material-symbols-outlined text-base text-white/60">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <a
                    key={link.href}
                    href={link.isStudentLife ? undefined : link.href}
                    onClick={(e) => {
                      if (link.isStudentLife) {
                        e.preventDefault()
                        onShowStudentLife()
                      }
                      setActiveNavIndex(index)
                      setMobileMenuOpen(false)
                    }}
                    className="block px-4 py-3 text-sm font-medium hover:bg-white/10 transition-colors min-h-[44px] flex items-center border-b border-white/10"
                  >
                    {link.label}
                  </a>
                )
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
