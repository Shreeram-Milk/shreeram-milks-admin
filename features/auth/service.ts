import { apiRequest } from '@/lib/api-client'

export type SignedInAdmin = { id: string; email: string }

/** The admin's sign-in calls. The backend owns every rule (lockouts, code expiry); this only sends and receives. */
export const authApi = {
  /** Step 1: password. The backend then sends a one-time code. */
  login: (email: string, password: string) => apiRequest<{ status: 'code_sent' }>('/admin/auth/login', { method: 'POST', body: { email, password } }),
  /** Step 2: the code. On success the backend sets the session cookie. */
  verify: (email: string, code: string) => apiRequest<{ admin: SignedInAdmin }>('/admin/auth/verify', { method: 'POST', body: { email, code } }),
  me: () => apiRequest<{ admin: SignedInAdmin }>('/admin/auth/me').then(response => response.admin),
  logout: () => apiRequest('/admin/auth/logout', { method: 'POST' }),
}
