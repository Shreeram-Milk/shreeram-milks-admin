'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Lock, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { describeApiError, safeNextPath } from '@/lib/api-errors'
import { useT } from '@/lib/i18n/LanguageProvider'
import { authMessages } from './messages'
import { authApi } from './service'
import { PasswordInput } from './PasswordInput'
import { LoginField } from './components/LoginField'
import { CodeInput } from './components/CodeInput'

type Translate = ReturnType<typeof useT<keyof typeof authMessages.en>>
const credentialsSchemaFor = (t: Translate) => z.object({ email: z.string().trim().toLowerCase().email(t('invalidEmail')), password: z.string().min(1, t('passwordRequired')) })
const codeSchemaFor = (t: Translate) => z.object({ code: z.string().trim().regex(/^\d{6}$/, t('codeRequired')) })
type Credentials = z.infer<ReturnType<typeof credentialsSchemaFor>>
type CodeValues = z.infer<ReturnType<typeof codeSchemaFor>>

/** Sign in with a password, then a one-time code. The backend decides what is allowed; this only collects and sends. */
export function LoginForm() {
  const router = useRouter()
  const t = useT(authMessages)
  const credentialsSchema = useMemo(() => credentialsSchemaFor(t), [t])
  const codeSchema = useMemo(() => codeSchemaFor(t), [t])
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
    return <form key="credentials" className="login-form" onSubmit={sendCode} noValidate aria-label={t('signIn')}>
      <StepIndicator step={1} />
      <div className="login-heading"><h1>{t('welcomeBack')}</h1><p>{t('signInIntro')}</p></div>
      <LoginField label={t('emailAddress')} icon={Mail} error={errors.email?.message}><Input type="email" autoComplete="username" placeholder="you@shreerammilks.com" autoFocus {...passwordForm.register('email')} /></LoginField>
      <LoginField label={t('password')} icon={Lock} error={errors.password?.message}><PasswordInput autoComplete="current-password" placeholder={t('enterPassword')} {...passwordForm.register('password')} /></LoginField>
      {errorAlert}
      <button type="submit" className="login-submit" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="login-spin" size={18} aria-hidden="true" />{t('checking')}</> : <>{t('continue')}<ArrowRight size={18} aria-hidden="true" /></>}
      </button>
      <p className="login-note"><ShieldCheck size={16} aria-hidden="true" />{t('twoStepNote')}</p>
    </form>
  }

  const { errors, isSubmitting } = codeForm.formState
  return <form key="code" className="login-form" onSubmit={confirmCode} noValidate aria-label={t('enterYourCode')}>
    <button type="button" className="login-back" onClick={startOver}><ArrowLeft size={16} aria-hidden="true" />{t('back')}</button>
    <StepIndicator step={2} />
    <span className="login-badge" aria-hidden="true"><MailCheck size={22} strokeWidth={1.8} /></span>
    <div className="login-heading"><h1>{t('checkEmail')}</h1><p>{t('codeSentBefore')} <strong>{credentials.email}</strong>{t('codeSentAfter')}</p></div>
    {process.env.NODE_ENV === 'development' && <p className="login-dev">{t('devNote')}</p>}
    <div className="login-field">
      <div className="login-field-label"><label htmlFor="login-code">{t('verificationCode')}</label></div>
      <CodeInput id="login-code" value={code} autoFocus aria-invalid={Boolean(errors.code)} aria-describedby={errors.code ? 'login-code-error' : undefined} {...codeForm.register('code')} />
      {errors.code && <small id="login-code-error" className="login-field-error">{errors.code.message}</small>}
    </div>
    {errorAlert}
    <button type="submit" className="login-submit" disabled={isSubmitting}>
      {isSubmitting ? <><Loader2 className="login-spin" size={18} aria-hidden="true" />{t('verifying')}</> : <>{t('verifySignIn')}<ArrowRight size={18} aria-hidden="true" /></>}
    </button>
    <p className="login-note login-note-center">{t('didntGetIt')} <button type="button" className="login-link" onClick={startOver}>{t('newCode')}</button></p>
  </form>
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  const t = useT(authMessages)
  return <div className="login-steps">
    <div className="login-steps-bars" aria-hidden="true"><span data-done="true" /><span data-done={step === 2} /></div>
    <span>{t('stepOf', { step, name: step === 1 ? t('credentials') : t('verification') })}</span>
  </div>
}
