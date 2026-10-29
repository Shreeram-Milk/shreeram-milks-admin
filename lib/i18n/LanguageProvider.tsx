'use client'

import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { fill, rememberLanguage, type Language, type MessageVars, type Messages } from './core'

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void }
const LanguageContext = createContext<LanguageContextValue>({ language: 'en', setLanguage: () => undefined })

/**
 * Holds the admin's language. `initial` comes from the cookie on the server, so the first page is already in the right
 * language. Changing it draws the whole admin again (the key below), so every word, including ones made by plain helpers,
 * comes out in the new language. Unsaved form input is lost by that, which is why the switch sits in the top bar, away from forms.
 */
export function LanguageProvider({ initial, children }: { initial: Language; children: ReactNode }) {
  const [language, setState] = useState<Language>(initial)
  const setLanguage = useCallback((next: Language) => {
    rememberLanguage(next)
    document.documentElement.lang = next
    setState(next)
  }, [])
  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])
  return <LanguageContext.Provider value={value}><Fragment key={language}>{children}</Fragment></LanguageContext.Provider>
}

export const useLanguage = () => useContext(LanguageContext)

/** `t` for a word list, for parts drawn on the server as well as in the browser (sign-in, the sign-in check). */
export function useT<K extends string>(messages: Messages<K>) {
  const { language } = useLanguage()
  return useCallback((key: K, vars?: MessageVars) => fill(messages[language][key], vars), [language, messages])
}
