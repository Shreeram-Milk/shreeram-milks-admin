import { defineMessages, translator } from '@/lib/i18n/core'

/** The top of every Money page. */
export const moneyMessages = defineMessages({
  money: 'Money',
  tabOwed: 'Owed to customers',
  tabCredit: 'Pay-later customers',
  tabPayments: 'Online payments',
  moneyToDo: 'Money to do',
  refundsToSend: 'Refunds to send in PhonePe',
  refundsHint: 'Send in PhonePe, then press “Record refund”',
  nothingToSend: 'Nothing to send',
  customersOwe: 'Pay-later customers who owe',
  oweHint: 'Ask for payment, or record cash or UPI received',
  nobodyOwes: 'Nobody owes money',
}, {
  money: 'પૈસા',
  tabOwed: 'ગ્રાહકોને આપવાના',
  tabCredit: 'પછી ચૂકવનાર ગ્રાહકો',
  tabPayments: 'ઓનલાઇન ચુકવણી',
  moneyToDo: 'પૈસાનું બાકી કામ',
  refundsToSend: 'PhonePe માં મોકલવાના રિફંડ',
  refundsHint: 'PhonePe માં મોકલો, પછી “રિફંડ નોંધો” દબાવો',
  nothingToSend: 'મોકલવાનું કંઈ નથી',
  customersOwe: 'જેમના પૈસા બાકી છે તે ગ્રાહકો',
  oweHint: 'ચુકવણી માંગો, કે મળેલા રોકડા કે UPI નોંધો',
  nobodyOwes: 'કોઈના પૈસા બાકી નથી',
})

export const t = translator(moneyMessages)
