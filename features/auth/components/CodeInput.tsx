'use client'

import type { ComponentProps } from 'react'

const CODE_LENGTH = 6

/** One real numeric input drawn as six slots, so paste, autofill and screen readers all behave like a normal field. */
export function CodeInput({ value, ...props }: Omit<ComponentProps<'input'>, 'value' | 'type' | 'maxLength'> & { value: string }) {
  const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
  return <div className="code-input">
    <input {...props} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={CODE_LENGTH} className="code-input-native" />
    <div className="code-input-slots" aria-hidden="true">
      {Array.from({ length: CODE_LENGTH }, (_, index) => <span key={index} className="code-input-slot" data-filled={index < digits.length} data-active={index === Math.min(digits.length, CODE_LENGTH - 1)}>{digits[index] ?? ''}</span>)}
    </div>
  </div>
}
