import { defineMessages, translator } from '@/lib/i18n/core'

/** The top of every Money page. */
export const moneyMessages = defineMessages({
  money: 'Money',
  tabOwed: 'Owed to customers',
  tabCredit: 'Pay-later customers',
  tabPayments: 'Online payments',
  tabWallet: 'Wallets',
  moneyToDo: 'Money to do',
  refundsToSend: 'Refunds to review',
  refundsHint: 'Review the refund here, then verify your admin password',
  nothingToSend: 'Nothing to send',
  customersOwe: 'Pay-later customers who owe',
  oweHint: 'Ask for payment, or record cash or UPI received',
  nobodyOwes: 'Nobody owes money',
}, {
  money: 'પૈસા',
  tabOwed: 'ગ્રાહકોને આપવાના',
  tabCredit: 'પછી ચૂકવનાર ગ્રાહકો',
  tabPayments: 'ઓનલાઇન ચુકવણી',
  tabWallet: 'વૉલેટ',
  moneyToDo: 'પૈસાનું બાકી કામ',
  refundsToSend: 'તપાસવાના રિફંડ',
  refundsHint: 'અહીં રિફંડ તપાસો, પછી એડમિન પાસવર્ડથી ખાતરી કરો',
  nothingToSend: 'મોકલવાનું કંઈ નથી',
  customersOwe: 'જેમના પૈસા બાકી છે તે ગ્રાહકો',
  oweHint: 'ચુકવણી માંગો, કે મળેલા રોકડા કે UPI નોંધો',
  nobodyOwes: 'કોઈના પૈસા બાકી નથી',
})

export const t = translator(moneyMessages)
