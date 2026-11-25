import React, { createContext, useContext, useMemo } from 'react'
import { AsgardeoProvider, useAsgardeo } from '@asgardeo/react'
import { getAsgardeoConfig } from './asgardeoConfig.js'
import { readEmail, readGroups } from './groups.js'

const FmsAsgardeoContext = createContext(null)

const DISABLED = {
  configured: false,
  isLoading: false,
  isSignedIn: false,
  signIn: async () => {},
  signOut: async () => {},
  readIdentity: async () => ({ email: '', groups: [], subject: '' }),
}

function AsgardeoBridge({ children }) {
  const asgardeo = useAsgardeo()
  const value = useMemo(() => ({
    configured: true,
    isLoading: !asgardeo.isInitialized || asgardeo.isLoading,
    isSignedIn: Boolean(asgardeo.isSignedIn),
    signIn: () => asgardeo.signIn(),
    signOut: () => asgardeo.signOut(),
    readIdentity: async () => {
      const token = await asgardeo.getDecodedIdToken()
      const profile = asgardeo.user
      return {
        email: readEmail(token, profile),
        groups: readGroups(token, profile),
        subject: String(token?.sub ?? profile?.sub ?? ''),
      }
    },
  }), [asgardeo])

  return <FmsAsgardeoContext.Provider value={value}>{children}</FmsAsgardeoContext.Provider>
}

export function AsgardeoRoot({ children }) {
  const config = getAsgardeoConfig()
  if (!config) {
    return <FmsAsgardeoContext.Provider value={DISABLED}>{children}</FmsAsgardeoContext.Provider>
  }
  return (
    <AsgardeoProvider {...config}>
      <AsgardeoBridge>{children}</AsgardeoBridge>
    </AsgardeoProvider>
  )
}

export function useFmsAsgardeo() {
  const value = useContext(FmsAsgardeoContext)
  return value ?? DISABLED
}
