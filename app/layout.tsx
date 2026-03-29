import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sprint Sequence Panic — Can you ship in the right order?',
  description: 'A fast PM sequencing game. Drag tasks into the correct dependency order before time runs out. Built by Javon Technology.',
  openGraph: {
    title: 'Sprint Sequence Panic',
    description: 'Test your PM instincts — sequence tasks correctly under pressure.',
    url: 'https://sprint-sequence-panic.vercel.app',
    siteName: 'Javon Technology',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sprint Sequence Panic',
    description: 'Can you ship in the right order? Test your PM game.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
