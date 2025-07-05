import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Max | Optimize Your Sleep & Cognition',
  description: 'Meet Max — the AI-driven sleep and cognitive optimizer for better focus, memory, and sleep quality.',
  keywords: ['sleep optimization', 'cognitive enhancement', 'AI coach', 'sleep tracking', 'memory improvement', 'focus training'],
  authors: [{ name: 'Max Team' }],
  creator: 'Max Team',
  publisher: 'Max App',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Max | Optimize Your Sleep & Cognition',
    description: 'Meet Max — the AI sleep coach for high-performance minds.',
    url: 'https://yourdomain.com/max',
    siteName: 'Max App',
    images: [
      {
        url: '/images/og-max.png', // Optional: add this image to your /public/images folder
        width: 1200,
        height: 630,
        alt: 'Max Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Max | Optimize Your Sleep & Cognition',
    description: 'Meet Max — the AI sleep coach for high-performance minds.',
    images: ['/images/og-max.png'], // Optional preview image
    creator: '@maxapp', // Replace with actual Twitter handle
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  verification: {
    // google: 'your-google-verification-code', // Add when you have it
    // yandex: 'your-yandex-verification-code', // Add when you have it
  },
}