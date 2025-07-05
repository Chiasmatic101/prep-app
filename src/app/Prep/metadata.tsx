// src/app/Prep/metadata.ts
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Prep – Personalized Learning, Backed by Science',
  description: 'Discover your chronotype and optimize your study routine with Prep—used by elite athletes, now for students.',
  openGraph: {
    title: 'Prep – Optimize Learning with Brain Science',
    description: 'Unlock your focus and memory by aligning your routine to your internal rhythm.',
    url: 'https://yourdomain.com/Prep',
    siteName: 'Prep',
    images: [
      {
        url: '/images/og-prep.png',
        width: 1200,
        height: 630,
        alt: 'Prep Hero Image',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prep – Personalized Learning, Backed by Science',
    description: 'Track your brain’s rhythm and boost learning outcomes.',
    images: ['/images/og-prep.png'],
  },
}
