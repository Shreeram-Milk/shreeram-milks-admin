import { Suspense } from 'react'
import Image from 'next/image'
import { LoginForm } from '@/features/auth/LoginForm'
import { LoginShowcase } from '@/features/auth/components/LoginShowcase'

export const metadata = { title: 'Sign in — ShreeRam Milks Admin' }

export default function LoginPage() {
  return <main className="login-page">
    <LoginShowcase />
    <section className="login-panel">
      <header className="login-topbar">
        <div className="login-mobile-brand"><Image src="/icon.svg" alt="" width={32} height={32} unoptimized /><span>ShreeRam Milks</span></div>
        <p>Trouble signing in? <span>Contact your administrator.</span></p>
      </header>
      {/* useSearchParams (for the page to return to after sign-in) needs a Suspense boundary. */}
      <div className="login-card"><Suspense><LoginForm /></Suspense></div>
      <footer className="login-footer">© {new Date().getFullYear()} ShreeRam Milks · Authorised staff only</footer>
    </section>
  </main>
}
