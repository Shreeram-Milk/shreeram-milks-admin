'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, GraduationCap, Gift, LockKeyhole } from 'lucide-react'
import { formatINR } from '@/lib/money'
import { REFUND_EXAMPLE as refund, SCRATCH_EXAMPLE as scratch, type DemoStage } from './model'
import s from './WorkflowDemo.module.css'

function Row({ label, children }: { label: string; children: ReactNode }) { return <div className={s.row}><span>{label}</span><strong>{children}</strong></div> }
function Card({ title, children, target }: { title?: string; children: ReactNode; target: string }) { return <section className={s.card} data-demo={target}>{title && <h3>{title}</h3>}{children}</section> }
function Field({ label, value, hint, target }: { label: string; value: string; hint?: string; target: string }) {
  return <label className={s.field} data-demo={target}><span>{label}</span><input readOnly value={value} tabIndex={-1} />{hint && <small>{hint}</small>}</label>
}
function Action({ children, target, danger = false, outline = false }: { children: ReactNode; target: string; danger?: boolean; outline?: boolean }) {
  return <button type="button" tabIndex={-1} data-demo={target} className={`${s.button}${danger ? ` ${s.danger}` : ''}${outline ? ` ${s.outline}` : ''}`}>{children}</button>
}
function Toggle({ label, checked, target }: { label: string; checked: boolean; target: string }) {
  return <div className={s.row} data-demo={target}><span>{label}</span><span className={`${s.switch}${checked ? '' : ` ${s.off}`}`} role="switch" aria-checked={checked} aria-label={label} /></div>
}
function Tick({ label, checked, target }: { label: string; checked: boolean; target: string }) {
  return <label className={s.check} data-demo={target}><input type="checkbox" checked={checked} readOnly tabIndex={-1} /><span>{label}</span></label>
}
function Heading({ crumb, children }: { crumb: string; children: ReactNode }) { return <><p className={s.crumb}>{crumb}</p><h2 className={s.title}>{children}</h2></> }

function RefundScene({ stage }: { stage: DemoStage }) {
  if (['refund-order', 'refund-payment', 'refund-cancel', 'refund-cancelled'].includes(stage)) return <>
    <Heading crumb="વેચાણ → ઓર્ડર → SRM-DEMO-1001">ઓર્ડર અને મળેલા પૈસા તપાસો</Heading>
    <Card title="ગ્રાહકનો ઓર્ડર" target="refund-order">
      <Row label="ગ્રાહક">{refund.customer}</Row><Row label="ઓર્ડર નંબર">{refund.order}</Row>
      <Row label="રકમ">{formatINR(refund.paidPaise)}</Row><Row label="સ્થિતિ"><span className={s.badge}>{stage === 'refund-cancelled' ? 'ઓર્ડર રદ થયો' : 'ઓર્ડર મળ્યો'}</span></Row>
      <div data-demo="refund-payment"><Row label="ચુકવણી">PhonePe · પૈસા મળ્યા</Row><Row label="મૂળ પેમેન્ટ">{refund.payment}</Row></div>
      <div className={s.actions}><Action target="refund-cancel" danger>ઓર્ડર રદ કરો</Action></div>
    </Card>
    {stage === 'refund-cancelled' && <Card title="ઓર્ડર રદ કરતાં પહેલાં" target="refund-cancelled"><Field label="કારણ" value={refund.reason} target="refund-reason" /><p>આ ઓર્ડર માટે રિફંડ આપવાનું પૈસા વિભાગમાં નોંધાશે. ઓર્ડર રદ કરવાથી તરત પૈસા મોકલાતા નથી.</p><div className={s.actions}><Action target="refund-cancel-example" danger>હા, ઓર્ડર રદ કરો · ઉદાહરણ</Action></div></Card>}
  </>
  if (stage === 'refund-owed') return <>
    <Heading crumb="પૈસા → ગ્રાહકોને આપવાના">રિફંડ આપવાનું બાકી છે</Heading>
    <Card title="બાકી રિફંડ" target="refund-owed"><Row label="ગ્રાહક">{refund.customer}</Row><Row label="ઓર્ડર">{refund.order} · રદ થયો</Row><Row label="પાછા આપવાના">{formatINR(refund.refundPaise)}</Row><Row label="સ્થિતિ"><span className={`${s.badge} ${s.waiting}`}>કરવાનું બાકી</span></Row><div className={s.actions}><Action target="refund-open-review">રિફંડ તપાસો</Action></div></Card>
  </>
  if (stage === 'refund-ledger') return <>
    <Heading crumb="પૈસા → ઓનલાઇન ચુકવણી">રિફંડની નોંધ અને હિસાબ</Heading>
    <Card title="મૂળ પેમેન્ટનો હિસાબ" target="refund-ledger"><Row label="મળેલા પૈસા">{formatINR(refund.paidPaise)}</Row><Row label="રિફંડ પૂર્ણ">{formatINR(refund.refundPaise)}</Row><Row label="હજી રિફંડ કરવાના">{formatINR(0)}</Row><Row label="PhonePe રિફંડ નંબર">{refund.reference}</Row><Row label="કોણે મંજૂરી આપી">એડમિન · તારીખ અને સમય નોંધાય છે</Row><Row label="કામની સ્થિતિ"><span className={s.badge}>પૂર્ણ</span></Row></Card>
    <p className={s.hint}>આ ઉદાહરણમાં આખી રકમ પાછી આપી છે. થોડા પૈસા પાછા આપ્યા હોય તો પેમેન્ટમાં આંશિક રિફંડ દેખાય.</p>
  </>
  const verify = stage === 'refund-verify' || stage === 'refund-confirm'
  const result = stage === 'refund-pending' || stage === 'refund-completed'
  const completed = stage === 'refund-completed'
  return <>
    <Heading crumb="પૈસા → ગ્રાહકોને આપવાના → રિફંડ">{result ? completed ? 'PhonePe એ રિફંડ પૂર્ણ કર્યાની ખાતરી કરી' : 'રિફંડની પ્રક્રિયા ચાલુ છે' : verify ? 'પગલું ૨ · ખાતરી કરીને મોકલો' : 'પગલું ૧ · રિફંડ તપાસો'}</Heading>
    <Card target="refund-review"><Row label="ગ્રાહક">{refund.customer}</Row><Row label="રિફંડની રકમ"><span className={s.amount}>{formatINR(refund.refundPaise)}</span></Row><Row label="મૂળ પેમેન્ટ">{refund.payment}</Row><p>પૈસા મૂળ ચુકવણીની રીતમાં જ પાછા જશે.</p></Card>
    {verify && <Card title="તમારી ખાતરી જરૂરી છે" target="refund-verification"><Field label="તમારો એડમિન પાસવર્ડ" value="••••••••" hint="આ ફક્ત ઉદાહરણ છે. અહીં સાચો પાસવર્ડ લખાતો નથી." target="refund-password" /><Tick target="refund-acknowledge" label="મેં ગ્રાહક અને રકમ તપાસ્યાં છે. આથી સાચા પૈસા મોકલાશે તે સમજું છું." checked={stage === 'refund-confirm'} /></Card>}
    {!result && <div className={s.actions}>{verify ? <Action danger target="refund-confirm">ખાતરી કરી {formatINR(refund.refundPaise)} રિફંડ કરો</Action> : <Action target="refund-continue">ખાતરીના પગલાં પર જાઓ</Action>}</div>}
    {result && <Card target="refund-result"><div className={completed ? s.success : s.hint}>{completed && <CheckCircle2 size={22} />}<span>{completed ? 'રિફંડ પૂર્ણ થયું. ગ્રાહકને જાણ થાય છે. બેંકમાં દેખાવાનો સમય અલગ હોઈ શકે.' : 'ખાતરીની રાહ છે. ફરી રિફંડ મોકલશો નહીં. સર્વર જાતે ફરી સ્થિતિ તપાસશે.'}</span></div><Row label="સ્થિતિ"><span className={`${s.badge}${completed ? '' : ` ${s.waiting}`}`}>{completed ? 'પૂર્ણ' : 'પ્રક્રિયા ચાલુ'}</span></Row><Row label="રિફંડ નંબર">{completed ? refund.reference : 'ખાતરી મળવાની બાકી'}</Row><div className={s.actions}><Action target="refund-check" outline>સ્થિતિ તપાસો</Action></div></Card>}
  </>
}

function ScratchScene({ stage }: { stage: DemoStage }) {
  if (stage.startsWith('scratch-settings') || ['scratch-enable', 'scratch-threshold', 'scratch-expiry', 'scratch-stats'].includes(stage)) return <>
    <Heading crumb="ફોન ઍપ → ઍપ સેટિંગ્સ → સ્ક્રેચ કાર્ડ">સ્ક્રેચ કાર્ડની શરૂઆત અહીંથી</Heading>
    <div className={s.tabs}><span>સંપર્ક</span><span>ડિલિવરી</span><span>સુવિધાઓ</span><span className={s.selected} data-demo="scratch-tab">સ્ક્રેચ કાર્ડ</span></div>
    <Card title="સ્ક્રેચ કાર્ડ" target="scratch-settings"><Toggle target="scratch-enabled" label="સ્ક્રેચ કાર્ડ આપો" checked={stage !== 'scratch-settings'} /><p>ડિલિવર થયેલા યોગ્ય એક-વારના ઓર્ડર પછી ગ્રાહકને મફત કાર્ડ મળે છે.</p><div className={s.grid}><Field target="scratch-threshold" label="કાર્ડ મેળવવા ઓર્ડરની રકમ (₹)" value="500" hint="₹500 કે વધુનો એક-વારનો ઓર્ડર." /><Field target="scratch-expiry" label="કાર્ડ કેટલા દિવસ પછી સમાપ્ત થાય" value="30" hint="કાર્ડ મળ્યાના દિવસથી ગણાય છે." /></div><div className={s.actions}><Action target="scratch-settings-save">સેટિંગ્સ સાચવો</Action></div></Card>
    {stage === 'scratch-stats' && <div className={s.stats} data-demo="scratch-stats">{[['આપેલા કાર્ડ', 1], ['સ્ક્રેચ કરેલા', 1], ['વપરાયેલા', 1]].map(([label, amount]) => <div key={label}>{label}<strong>{amount}</strong></div>)}</div>}
  </>
  if (stage === 'scratch-offers') return <>
    <Heading crumb="ફોન ઍપ → ઑફર">હવે કાર્ડમાં આપવાની ઑફર બનાવો</Heading>
    <Card title="ઑફર" target="scratch-offers"><p>સેટિંગ્સ ચાલુ કરવાથી કાર્ડમાં કઈ છૂટ આપવી તે નક્કી થતું નથી. એ માટે અહીં ઑફર બનાવવાની છે.</p><div className={s.actions}><Action target="scratch-offer-new">નવી ઑફર</Action></div></Card>
  </>
  if (['scratch-offer-details', 'scratch-code', 'scratch-purchases', 'scratch-pool', 'scratch-owner', 'scratch-offer-save'].includes(stage)) return <>
    <Heading crumb="ફોન ઍપ → ઑફર → નવી ઑફર">સ્ક્રેચ કાર્ડ માટે ₹50 ની છૂટ</Heading>
    <Card title="ઑફરની વિગતો" target="scratch-offer-details"><div className={s.grid}><Field target="scratch-title" label="ઑફરનું નામ" value={scratch.offerTitle} /><Field target="scratch-kind" label="ઑફરનો પ્રકાર" value="ચોક્કસ રકમની છૂટ" /><Field target="scratch-discount" label="કેટલા રૂપિયાની છૂટ" value="50" /><Field target="scratch-offer-min" label="આવતો ઓર્ડર ઓછામાં ઓછો (₹)" value="500" /></div></Card>
    {stage !== 'scratch-offer-details' && <Card target="scratch-code"><div className={s.grid}><Field target="scratch-code-value" label="ઑફર કોડ" value={scratch.code} /><Field target="scratch-active" label="સ્થિતિ" value="ચાલુ" /></div><p>ઑફર ચાલુ હોવી જોઈએ અને તેની તારીખ પૂરી થયેલી ન હોવી જોઈએ.</p></Card>}
    {['scratch-purchases', 'scratch-pool', 'scratch-owner', 'scratch-offer-save'].includes(stage) && <Card title="ક્યાં વાપરી શકાય" target="scratch-purchases"><Tick label="એક-વારનો ઓર્ડર" checked target="scratch-one-time" /><br /><Tick label="ટ્રાયલ" checked={false} target="scratch-no-trial" /><br /><Tick label="સબ્સ્ક્રિપ્શન" checked={false} target="scratch-no-subscription" /></Card>}
    {['scratch-pool', 'scratch-owner', 'scratch-offer-save'].includes(stage) && <Card title="આ ઑફરને કાર્ડ સાથે જોડો" target="scratch-pool"><Toggle target="scratch-in-pool" label="આ ઑફર સ્ક્રેચ કાર્ડમાં આપો" checked /><Toggle target="scratch-owner-only" label="ફક્ત સ્ક્રેચ કરનાર ગ્રાહક માટે" checked={stage !== 'scratch-pool'} /><p>આ રીતે ઑફર કાર્ડ માટેની યાદીમાં ઉમેરાય છે. ગ્રાહકને એ યાદીમાંથી કોઈ એક ઑફર મળે છે.</p></Card>}
    <div className={s.actions}><Action target="scratch-offer-save">ઑફર બનાવો</Action></div>
  </>
  if (stage === 'scratch-delivery') return <>
    <Heading crumb="ડિલિવરી → એક-વારનો ઓર્ડર">ઓર્ડર ડિલિવર થાય ત્યારે કાર્ડ મળે</Heading>
    <Card title="ઉદાહરણનો ઓર્ડર" target="scratch-delivery"><Row label="ગ્રાહક">{refund.customer}</Row><Row label="પ્રકાર">એક-વારનો ઓર્ડર</Row><Row label="ઓર્ડરની રકમ">{formatINR(scratch.qualifyingOrderPaise)}</Row><Row label="કાર્ડ મેળવવાની શરત">{formatINR(scratch.minOrderPaise)} કે વધુ</Row><Row label="સ્થિતિ"><span className={s.badge}>ડિલિવર થયો</span></Row></Card><div className={s.success}><Gift size={22} /><span>આ ઓર્ડર માટે એક મફત કાર્ડ મળે છે. સબ્સ્ક્રિપ્શન કે ટ્રાયલની ડિલિવરી માટે કાર્ડ મળતું નથી.</span></div>
  </>
  const checkout = stage === 'scratch-checkout'
  const revealed = stage === 'scratch-reveal' || checkout
  return <>
    <Heading crumb="ગ્રાહકની ઍપનો નમૂનો → મારા સ્ક્રેચ કાર્ડ">{checkout ? 'આવતા ઓર્ડરમાં કોડ વાપરો' : revealed ? 'સ્ક્રેચ કરતાં છૂટનો કોડ મળે' : 'ગ્રાહકને કાર્ડ મળ્યું'}</Heading>
    <div className={s.phone} data-demo={checkout ? 'scratch-checkout' : 'scratch-customer-card'}><p className={s.hint}>ગ્રાહકની ઍપમાં આ રીતે દેખાય · ઉદાહરણ</p>
      <div className={s.scratch} data-demo="scratch-reveal">{revealed ? <div><Gift size={30} /><strong>₹50 ની છૂટ</strong><span className={s.code}>{scratch.code}</span></div> : <div><Gift size={40} /><h3>તમારું મફત સ્ક્રેચ કાર્ડ</h3><p>સ્ક્રેચ કરીને તમારી ઑફર જુઓ</p></div>}</div>
      {checkout ? <><Field target="scratch-apply-code" label="ઑફર કોડ" value={scratch.code} /><Row label="ઓર્ડર">{formatINR(scratch.nextOrderPaise)}</Row><Row label="કાર્ડની છૂટ">−{formatINR(scratch.discountPaise)}</Row><Row label="ચૂકવવાના">{formatINR(scratch.finalPaise)}</Row><span className={s.badge}>કોડ વપરાયો · કાર્ડ દીઠ એક વાર</span></> : <p className={s.hint}>કાર્ડ {scratch.expiryDays} દિવસમાં વાપરવું. {revealed ? 'આ કોડ રૂપિયા ઉપાડવા માટે નથી. આવતા યોગ્ય ઓર્ડરમાં છૂટ મળે છે.' : 'કોડ સ્ક્રેચ કર્યા પછી જ દેખાય છે.'}</p>}
    </div>
  </>
}

/** An isolated example over the real route. No API imports, live form values, credentials or mutation handlers. */
export default function WorkflowDemo({ stage }: { stage: DemoStage }) {
  if (typeof document === 'undefined') return null
  return createPortal(<div className={s.shield} data-tour-ui="" data-workflow-demo={stage}>
    <section className={s.panel} lang="gu" aria-label="શીખવા માટેનું ઉદાહરણ">
      <div className={s.banner}><GraduationCap size={18} /><span>ફક્ત શીખવા માટે · ઉદાહરણની માહિતી · સેટિંગ્સ, ઓર્ડર કે પૈસામાં કોઈ ફેરફાર થતો નથી</span><LockKeyhole size={16} /></div>
      <div inert>{stage.startsWith('refund-') ? <RefundScene stage={stage} /> : <ScratchScene stage={stage} />}</div>
    </section>
  </div>, document.body)
}
