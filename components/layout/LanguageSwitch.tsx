'use client'

import { LANGUAGES, type Language } from '@/lib/i18n/core'
import { useLanguage, useT } from '@/lib/i18n/LanguageProvider'
import { layoutMessages } from './messages'

// Each language is named in its own script, so either reader can find theirs.
const NAMES: Record<Language, string> = { en: 'English', gu: 'ગુજરાતી' }

/** English / ગુજરાતી in the top bar. The choice is remembered in this browser. */
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  const t = useT(layoutMessages)
  return <div className="language-switch" role="radiogroup" aria-label={t('language')}>
    {LANGUAGES.map(option => <button key={option} type="button" role="radio" aria-checked={language === option} lang={option} className={`language-option${language === option ? ' is-active' : ''}`} onClick={() => { if (language !== option) setLanguage(option) }}>{NAMES[option]}</button>)}
  </div>
}
