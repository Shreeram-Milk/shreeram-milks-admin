import { cookies } from 'next/headers'
import { isLanguage, LANGUAGE_COOKIE, type Language } from './core'

/** The language this browser chose, read on the server from its cookie (English when none was chosen). */
export async function requestLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value
  return isLanguage(value) ? value : 'en'
}
