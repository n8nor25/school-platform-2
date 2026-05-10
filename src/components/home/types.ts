export interface SchoolInfo {
  id: string
  name: string
  subdomain: string
  description: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  address: string
  phone: string
  email: string
  facebookUrl: string | null
  isActive: boolean
}

export interface SchoolSettings {
  heroTitle: string
  heroSubtitle: string
  bannerTitle: string | null
  bannerImageUrl: string | null
  vision: string | null
  aboutImage: string | null
  aboutVideoUrl: string | null
  showNewsTicker: boolean
  showHeroBanner: boolean
  showLiveStream: boolean
  liveStreamUrl: string | null
  facebookUrl: string | null
  youtubeUrl: string | null
  showSlider: boolean
  showAbout: boolean
  showNews: boolean
  showServices: boolean
  showGallery: boolean
  showTeachers: boolean
  showStats: boolean
  showContact: boolean
}

export interface SchoolStats {
  students: number
  teachers: number
  classes: number
  years: number
}

export interface SchoolData {
  school: SchoolInfo
  settings: SchoolSettings | null
  stats: SchoolStats | null
}

export interface NewsItem {
  id: string
  title: string
  slug: string | null
  excerpt: string | null
  content: string | null
  image: string | null
  category: string
  active: boolean
  createdAt: string
}

export interface GalleryItem {
  id: string
  title: string | null
  imageUrl: string
  createdAt: string
}

export interface Teacher {
  id: string
  name: string
  subject: string
  email: string | null
  imageUrl: string | null
  sortOrder: number
  active: boolean
}

export interface SliderItem {
  id: string
  imageUrl: string
  title: string | null
  subtitle: string | null
  link: string | null
  sortOrder: number
  active: boolean
}

export interface CustomSectionItem {
  id: string
  title: string
  content: string
  imageUrl: string | null
  layout: string
  active: boolean
  sortOrder: number
}
