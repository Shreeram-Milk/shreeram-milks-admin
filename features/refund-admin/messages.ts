import { defineMessages, translator } from '@/lib/i18n/core'

export const refundMessages = defineMessages({
  title: 'Refund to original payment', review: 'Step 1 of 2 · Review refund', verify: 'Step 2 of 2 · Verify and send',
  description: 'Check the customer and amount. The refund goes back to the original payment method.',
  loading: 'Checking refundable payments…', reason: 'Reason', original: 'Original payment', amount: 'Refund amount',
  continue: 'Continue to verification', close: 'Close', back: 'Back to review', password: 'Your admin password',
  passwordHint: 'Enter the password you use to sign in to this admin.', passwordRequired: 'Enter your admin password.',
  acknowledge: 'I checked the customer and amount. I understand this sends real money and cannot be cancelled here.',
  acknowledgeRequired: 'Confirm that you checked the refund details.', send: 'Confirm and refund {amount}', sending: 'Submitting refund…',
  verifyHint: 'No money is sent until you press the confirmation button below. This review expires after five minutes.',
  processing: 'Refund is being checked', processingHint: 'PhonePe has not confirmed every part yet. You can close this window; the server keeps checking. Do not send another refund outside this admin.',
  completed: 'Refund completed', completedHint: 'PhonePe confirmed the refund. The time it appears in the account depends on the bank.',
  failed: 'Refund needs attention', failedHint: 'PhonePe confirmed that one or more parts failed. Review again to retry only the unpaid amount.',
  checking: 'Checking…', check: 'Check status', retry: 'Review remaining refund', reference: 'Refund reference',
  created: 'Waiting to submit', unknown: 'Awaiting confirmation — do not resend', pending: 'Processing', failedPart: 'Failed', completedPart: 'Completed',
  loadFailed: 'Could not load the refund', cancelRequest: 'Cancel refund request',
}, {
  title: 'મૂળ ચુકવણીમાં રિફંડ', review: '૨ માંથી પગલું ૧ · રિફંડ તપાસો', verify: '૨ માંથી પગલું ૨ · ખાતરી કરી મોકલો',
  description: 'ગ્રાહક અને રકમ તપાસો. રિફંડ મૂળ ચુકવણીની રીતમાં જ પાછું જશે.',
  loading: 'રિફંડ માટેની ચુકવણીઓ તપાસી રહ્યા છીએ…', reason: 'કારણ', original: 'મૂળ ચુકવણી', amount: 'રિફંડની રકમ',
  continue: 'ખાતરીના પગલાં પર જાઓ', close: 'બંધ કરો', back: 'ફરી તપાસો', password: 'તમારો એડમિન પાસવર્ડ',
  passwordHint: 'આ એડમિનમાં પ્રવેશવા માટેનો પાસવર્ડ લખો.', passwordRequired: 'તમારો એડમિન પાસવર્ડ લખો.',
  acknowledge: 'મેં ગ્રાહક અને રકમ તપાસ્યાં છે. આથી સાચા પૈસા મોકલાશે અને અહીંથી રદ નહીં કરી શકાય તે હું સમજું છું.',
  acknowledgeRequired: 'રિફંડની વિગતો તપાસી છે તેની ખાતરી કરો.', send: 'ખાતરી કરી {amount} રિફંડ કરો', sending: 'રિફંડ મોકલી રહ્યા છીએ…',
  verifyHint: 'નીચેનું ખાતરી બટન દબાવો ત્યાં સુધી પૈસા મોકલાતા નથી. આ તપાસ પાંચ મિનિટ પછી સમાપ્ત થશે.',
  processing: 'રિફંડ તપાસાઈ રહ્યું છે', processingHint: 'PhonePe એ હજી બધા ભાગોની ખાતરી કરી નથી. તમે બારી બંધ કરી શકો છો; સર્વર તપાસ ચાલુ રાખશે. આ એડમિનની બહાર ફરી રિફંડ મોકલશો નહીં.',
  completed: 'રિફંડ પૂર્ણ થયું', completedHint: 'PhonePe એ રિફંડની ખાતરી કરી છે. ખાતામાં દેખાવાનો સમય બેંક પર આધાર રાખે છે.',
  failed: 'રિફંડ પર ધ્યાન આપવું જરૂરી છે', failedHint: 'PhonePe એ એક અથવા વધુ ભાગ નિષ્ફળ થયાની ખાતરી કરી છે. ફક્ત બાકી રકમ માટે ફરી તપાસો.',
  checking: 'તપાસી રહ્યા છીએ…', check: 'સ્થિતિ તપાસો', retry: 'બાકી રિફંડ તપાસો', reference: 'રિફંડ સંદર્ભ',
  created: 'મોકલવાનું બાકી', unknown: 'ખાતરીની રાહમાં — ફરી મોકલશો નહીં', pending: 'પ્રક્રિયા ચાલુ', failedPart: 'નિષ્ફળ', completedPart: 'પૂર્ણ',
  loadFailed: 'રિફંડ લાવી શકાયું નહીં', cancelRequest: 'રિફંડની વિનંતી રદ કરો',
})
export const t = translator(refundMessages)
