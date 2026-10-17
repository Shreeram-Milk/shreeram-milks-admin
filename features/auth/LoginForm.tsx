'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Lock, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { describeApiError, safeNextPath } from '@/lib/api-errors'
import { authApi } from './service'
import { PasswordInput } from './PasswordInput'
import { LoginField } from './components/LoginField'
import { CodeInput } from './components/CodeInput'

const credentialsSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') })
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') })
type Credentials = z.infer<typeof credentialsSchema>
type CodeValues = z.infer<typeof codeSchema>

/** Sign in with a password, then a one-time code. The backend decides what is allowed; this only collects and sends. */
export function LoginForm() {
  const router = useRouter()
  const next = safeNextPath(useSearchParams().get('next'))
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [error, setError] = useState('')

  const passwordForm = useForm<Credentials>({ resolver: zodResolver(credentialsSchema), defaultValues: { email: '', password: '' } })
  const codeForm = useForm<CodeValues>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })
  const code = useWatch({ control: codeForm.control, name: 'code' })

  const sendCode = passwordForm.handleSubmit(async values => {
    setError('')
    try { await authApi.login(values.email, values.password); setCredentials(values) } catch (failure) { setError(describeApiError(failure)) }
  })

  const confirmCode = codeForm.handleSubmit(async values => {
    if (!credentials) return
    setError('')
    try { await authApi.verify(credentials.email, values.code); router.replace(next) } catch (failure) { setError(describeApiError(failure)); codeForm.reset() }
  })

  const startOver = () => { setCredentials(null); setError(''); codeForm.reset(); passwordForm.resetField('password') }

  const errorAlert = error && <div className="login-alert" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span></div>

  if (credentials === null) {
    const { errors, isSubmitting } = passwordForm.formState
    return <form key="credentials" className="login-form" onSubmit={sendCode} noValidate aria-label="Sign in">
      <StepIndicator step={1} />
      <div className="login-heading"><h1>Welcome back</h1><p>Sign in to the ShreeRam Milks admin console.</p></div>
      <LoginField label="Email address" icon={Mail} error={errors.email?.message}><Input type="email" autoComplete="username" placeholder="you@shreerammilks.com" autoFocus {...passwordForm.register('email')} /></LoginField>
      <LoginField label="Password" icon={Lock} error={errors.password?.message}><PasswordInput autoComplete="current-password" placeholder="Enter your password" {...passwordForm.register('password')} /></LoginField>
      {errorAlert}
      <button type="submit" className="login-submit" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="login-spin" size={18} aria-hidden="true" />Checking…</> : <>Continue<ArrowRight size={18} aria-hidden="true" /></>}
      </button>
      <p className="login-note"><ShieldCheck size={16} aria-hidden="true" />Protected by two-step verification. We’ll email you a one-time code next.</p>
    </form>
  }

  const { errors, isSubmitting } = codeForm.formState
  return <form key="code" className="login-form" onSubmit={confirmCode} noValidate aria-label="Enter your code">
    <button type="button" className="login-back" onClick={startOver}><ArrowLeft size={16} aria-hidden="true" />Back</button>
    <StepIndicator step={2} />
    <span className="login-badge" aria-hidden="true"><MailCheck size={22} strokeWidth={1.8} /></span>
    <div className="login-heading"><h1>Check your email</h1><p>We sent a 6-digit code to <strong>{credentials.email}</strong>. It works once and expires in 10 minutes.</p></div>
    {process.env.NODE_ENV === 'development' && <p className="login-dev">Development: if no email arrives, the code is printed in the backend window.</p>}
    <div className="login-field">
      <div className="login-field-label"><label htmlFor="login-code">Verification code</label></div>
      <CodeInput id="login-code" value={code} autoFocus aria-invalid={Boolean(errors.code)} aria-describedby={errors.code ? 'login-code-error' : undefined} {...codeForm.register('code')} />
      {errors.code && <small id="login-code-error" className="login-field-error">{errors.code.message}</small>}
    </div>
    {errorAlert}
    <button type="submit" className="login-submit" disabled={isSubmitting}>
      {isSubmitting ? <><Loader2 className="login-spin" size={18} aria-hidden="true" />Verifying…</> : <>Verify and sign in<ArrowRight size={18} aria-hidden="true" /></>}
    </button>
    <p className="login-note login-note-center">Didn’t get it? <button type="button" className="login-link" onClick={startOver}>Use a different account or get a new code</button></p>
  </form>
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return <div className="login-steps">
    <div className="login-steps-bars" aria-hidden="true"><span data-done="true" /><span data-done={step === 2} /></div>
    <span>Step {step} of 2 · {step === 1 ? 'Credentials' : 'Verification'}</span>
  </div>
}
