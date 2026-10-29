'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError, UNAUTHENTICATED_EVENT } from '@/lib/api-client'
import { describeApiError } from '@/lib/api-errors'
import { useT } from '@/lib/i18n/LanguageProvider'
import { authMessages } from './messages'
import { authApi, type SignedInAdmin } from './service'

type AuthContextValue = { admin: SignedInAdmin; signOut: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

/** The signed-in admin. Only available inside `AuthGate`, which never renders its children for anyone else. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthGate.')
  return value
}

type State = { status: 'checking' } | { status: 'signedIn'; admin: SignedInAdmin } | { status: 'unreachable'; message: string }

/**
 * Asks the backend who is signed in before showing any admin page. This is for convenience only: the backend
 * checks the session again on every request, so hiding a page here is never what protects the data.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<State>({ status: 'checking' })
  const [attempt, setAttempt] = useState(0)
  const t = useT(authMessages)

  const goToLogin = useCallback(() => { router.replace(`/login?next=${encodeURIComponent(pathname)}`) }, [router, pathname])

  useEffect(() => {
    let cancelled = false
    authApi.me().then(
      admin => { if (!cancelled) setState({ status: 'signedIn', admin }) },
      error => {
        if (cancelled) return
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') goToLogin()
        else setState({ status: 'unreachable', message: describeApiError(error) })
      },
    )
    return () => { cancelled = true }
  }, [attempt, goToLogin])

  // Any later request that finds the session ended sends the admin back to sign in.
  useEffect(() => {
    window.addEventListener(UNAUTHENTICATED_EVENT, goToLogin)
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, goToLogin)
  }, [goToLogin])

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => undefined)
    router.replace('/login')
  }, [router])

  const value = useMemo(() => (state.status === 'signedIn' ? { admin: state.admin, signOut } : null), [state, signOut])

  if (state.status === 'unreachable') {
    return <main className="auth-state" role="alert"><strong>{t('couldNotCheck')}</strong><p>{state.message}</p><Button className="primary-button" onClick={() => { setState({ status: 'checking' }); setAttempt(count => count + 1) }}>{t('tryAgain')}</Button></main>
  }
  if (!value) return <main className="auth-state" aria-busy="true"><p>{t('checkingSignIn')}</p></main>
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
