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
        <div className="login-mobile-brand"><Image src="/icon.svg" alt="" width={36} height={36} unoptimized /><div><span>ShreeRam Milks</span><small>Admin workspace</small></div></div>
        <p>Admin workspace <span className="login-access-label">Authorised access</span></p>
      </header>
      {/* useSearchParams (for the page to return to after sign-in) needs a Suspense boundary. */}
      <div className="login-card"><Suspense><LoginForm /></Suspense></div>
      <footer className="login-footer"><p>Need access? Contact your administrator.</p><span>© {new Date().getFullYear()} ShreeRam Milks</span></footer>
    </section>
  </main>
}
