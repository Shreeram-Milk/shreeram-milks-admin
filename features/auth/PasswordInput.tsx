'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

/** Password field with a show/hide toggle so people can check what they typed. Forwards everything (ref, id, register props) to the input. */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return <div className="password-input">
    <Input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-toggle" onClick={() => setVisible(current => !current)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </div>
}
