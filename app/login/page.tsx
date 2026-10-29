import { Suspense } from 'react'
import Image from 'next/image'
import { LoginForm } from '@/features/auth/LoginForm'
import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { LoginShowcase } from '@/features/auth/components/LoginShowcase'
import { authMessages } from '@/features/auth/messages'
import { translateFor } from '@/lib/i18n/core'
import { requestLanguage } from '@/lib/i18n/server'

export const metadata = { title: 'Sign in — ShreeRam Milks Admin' }

export default async function LoginPage() {
  const language = await requestLanguage()
  const t = translateFor(authMessages, language)
  return <main className="login-page">
    <LoginShowcase language={language} />
    <section className="login-panel">
      <header className="login-topbar">
        <div className="login-mobile-brand"><Image src="/icon.svg" alt="" width={36} height={36} unoptimized /><div><span>ShreeRam Milks</span><small>{t('adminWorkspace')}</small></div></div>
        <p>{t('adminWorkspace')} <span className="login-access-label">{t('authorisedAccess')}</span></p>
        <LanguageSwitch />
      </header>
      {/* useSearchParams (for the page to return to after sign-in) needs a Suspense boundary. */}
      <div className="login-card"><Suspense><LoginForm /></Suspense></div>
      <footer className="login-footer"><p>{t('needAccess')}</p><span>© {new Date().getFullYear()} ShreeRam Milks</span></footer>
    </section>
  </main>
}
