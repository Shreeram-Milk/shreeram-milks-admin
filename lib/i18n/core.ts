/**
 * The admin's two languages. Every fixed word on screen comes from a word list made with `defineMessages`, which sits next to
 * the feature that uses it (for example `features/orders/messages.ts`) and holds the English and Gujarati side by side. A word
 * missing from the Gujarati half, or one that is not in the English half, fails the typecheck, so a screen never shows a blank.
 *
 * Inside the signed-in admin, call `translator(messages)` once at the top of a file and use the `t` it returns anywhere: in
 * components, event handlers and plain helpers. Those pages are drawn only in the browser (after the sign-in check), and the
 * whole admin is drawn again when the language changes, so `t` always reads the current language. Pages drawn on the server
 * (sign-in) use `useT` or `translateFor` instead. Gujarati wording follows `glossary.md`.
 */
export type Language = 'en' | 'gu'
export const LANGUAGES: readonly Language[] = ['en', 'gu']
export const LANGUAGE_COOKIE = 'admin-language'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'gu'

function languageFromCookie(): Language {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(/(?:^|;\s*)admin-language=(en|gu)/)
  return match?.[1] === 'gu' ? 'gu' : 'en'
}

let current: Language = languageFromCookie()

/** The language the admin is drawn in right now. */
export const currentLanguage = (): Language => current

/** Remembers the language in this browser for a year. The provider redraws the admin after calling it. */
export function rememberLanguage(language: Language) {
  current = language
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
}

/** The locale for dates and numbers. Gujarati months and weekdays, with the usual 0–9 digits. */
export const localeOf = (language: Language = current) => (language === 'gu' ? 'gu-IN' : 'en-IN')

export type Messages<K extends string> = { en: Record<K, string>; gu: Record<K, string> }
export type MessageVars = Record<string, string | number>

/** A word list: the English words, and the Gujarati for every one of them. Words can hold `{name}` blanks. */
export function defineMessages<const E extends Record<string, string>>(en: E, gu: { [K in keyof E]: string }): Messages<keyof E & string> {
  return { en, gu }
}

/** Fills `{name}` blanks in a word. A blank with no value is left as it is, so a mistake shows instead of vanishing. */
export function fill(text: string, vars?: MessageVars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (blank, name: string) => (name in vars ? String(vars[name]) : blank))
}

/** `t` for a word list, in the current language. For the signed-in admin; see the note at the top. */
export function translator<K extends string>(messages: Messages<K>) {
  return (key: K, vars?: MessageVars): string => fill(messages[current][key], vars)
}

/** `t` for a word list in a given language, for pages drawn on the server. */
export function translateFor<K extends string>(messages: Messages<K>, language: Language) {
  return (key: K, vars?: MessageVars): string => fill(messages[language][key], vars)
}

/**
 * A fixed list of labels (for example every order status) whose words are looked up each time one is read, so code that keeps
 * `LABELS[status]` keeps working and always gets the current language.
 */
export function liveLabels<V extends string, K extends string>(t: (key: K) => string, keys: Record<V, K>): Readonly<Record<V, string>> {
  const labels = {} as Record<V, string>
  for (const value of Object.keys(keys) as V[]) Object.defineProperty(labels, value, { enumerable: true, get: () => t(keys[value]) })
  return labels
}
