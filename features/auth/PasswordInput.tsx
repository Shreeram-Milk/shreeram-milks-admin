'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n/LanguageProvider'
import { authMessages } from './messages'

/** Password field with a show/hide toggle so people can check what they typed. Forwards everything (ref, id, register props) to the input. */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const t = useT(authMessages)
  return <div className="password-input">
    <Input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-toggle" onClick={() => setVisible(current => !current)} aria-label={visible ? t('hidePassword') : t('showPassword')} aria-pressed={visible}>
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </div>
}
