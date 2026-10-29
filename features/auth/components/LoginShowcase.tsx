import Image from 'next/image'
import { ShoppingBag, Truck, Users } from 'lucide-react'
import { translateFor, type Language } from '@/lib/i18n/core'
import { authMessages } from '../messages'

/** Brand introduction beside the sign-in form; omitted on narrow screens. */
export function LoginShowcase({ language }: { language: Language }) {
  const t = translateFor(authMessages, language)
  const capabilities = [
    { icon: ShoppingBag, title: t('ordersTitle'), text: t('ordersText') },
    { icon: Truck, title: t('deliveriesTitle'), text: t('deliveriesText') },
    { icon: Users, title: t('customersTitle'), text: t('customersText') },
  ]
  return <aside className="login-aside" aria-label={t('workspaceLabel')}>
    <div className="login-aside-brand"><Image src="/icon.svg" alt="" width={44} height={44} unoptimized /><div><span>ShreeRam Milks</span><small>{t('adminWorkspace')}</small></div></div>
    <div className="login-aside-content">
      <div className="login-aside-copy">
        <span className="login-eyebrow">{t('eyebrow')}</span>
        <h2>{t('headline')}<br /><em>{t('headlineEmphasis')}</em></h2>
        <p>{t('intro')}</p>
      </div>
      <ul className="login-capabilities">
        {capabilities.map(({ icon: Icon, title, text }) => <li key={title}>
          <span className="login-capability-icon"><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span>
          <div><strong>{title}</strong><span>{text}</span></div>
        </li>)}
      </ul>
    </div>
    <p className="login-aside-footer"><span />{t('tagline')}</p>
  </aside>
}
