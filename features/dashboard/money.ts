import { formatINR } from '@/lib/money'

/** "₹480" for whole rupees, "₹73.89" otherwise: dashboard figures read better without ".00". */
export const dashboardINR = (paise: number): string => (paise % 100 === 0 ? `${paise < 0 ? '-' : ''}₹${(Math.abs(paise) / 100).toLocaleString('en-IN')}` : formatINR(paise))
