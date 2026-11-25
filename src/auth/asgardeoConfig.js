const FMS_GROUP = 'kaionex-fms'

function clean(value) {
  return String(value ?? '').replace(/\r/g, '').trim()
}

export function getAsgardeoConfig() {
  const clientId = clean(import.meta.env.VITE_ASGARDEO_CLIENT_ID)
  const baseUrl = clean(import.meta.env.VITE_ASGARDEO_BASE_URL) || 'https://api.asgardeo.io/t/techloomai'
  if (!clientId) return null

  const scopes = clean(import.meta.env.VITE_ASGARDEO_SCOPES) || 'openid profile email groups'
  return {
    baseUrl,
    clientId,
    afterSignInUrl: clean(import.meta.env.VITE_ASGARDEO_SIGN_IN_REDIRECT_URL) || 'http://localhost:5173',
    afterSignOutUrl: clean(import.meta.env.VITE_ASGARDEO_SIGN_OUT_REDIRECT_URL) || 'http://localhost:5173',
    scopes: scopes.split(/[,\s]+/).filter(Boolean),
    storage: 'sessionStorage',
    tokenRequest: { authMethod: 'none' },
    tokenValidation: {
      idToken: { validate: true, validateIssuer: true },
    },
  }
}

export const ASGARDEO_PENDING_KEY = 'kaionex_asgardeo_pending'
export const ASGARDEO_DENIED_KEY = 'kaionex_asgardeo_denied'
export const FMS_ACCESS_GROUP = FMS_GROUP
