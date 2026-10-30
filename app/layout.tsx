import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Noto_Sans_Gujarati, Plus_Jakarta_Sans } from 'next/font/google'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { requestLanguage } from '@/lib/i18n/server'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

// Gujarati letters: the two fonts above have none. The browser downloads this one only when a page shows Gujarati.
const notoSansGujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  variable: '--font-noto-sans-gujarati',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ShreeRam Milks — Admin Panel',
  description: 'Manage products, deliveries, subscriptions, and customers for ShreeRam Milks.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The language comes from this browser's cookie, so the first page is drawn in it (no English flash before Gujarati).
  const language = await requestLanguage()
  return (
    <html lang={language} className={`${geist.variable} ${plusJakartaSans.variable} ${notoSansGujarati.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <LanguageProvider initial={language}>{children}</LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
