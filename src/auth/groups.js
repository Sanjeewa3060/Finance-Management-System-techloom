const GROUP_CLAIM_KEYS = [
  'groups',
  'roles',
  'group',
  'http://wso2.org/claims/groups',
  'http://wso2.org/claims/roles',
  'http://wso2.org/claims/role',
]

function asList(value) {
  if (Array.isArray(value)) return value.flatMap(asList)
  if (value == null || value === '') return []
  if (typeof value === 'string') {
    return value.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean)
  }
  return []
}

export function readGroups(...sources) {
  const found = []
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of GROUP_CLAIM_KEYS) {
      found.push(...asList(source[key]))
    }
  }
  return [...new Set(found)]
}

export function hasGroup(groups, required) {
  const name = String(required).toLowerCase()
  return groups.some((group) => {
    const value = String(group).trim().toLowerCase()
    return value === name || value.endsWith(`/${name}`)
  })
}

export function readEmail(...sources) {
  const keys = ['email', 'preferred_username', 'username', 'upn']
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of keys) {
      const value = String(source[key] ?? '').trim().toLowerCase()
      if (value.includes('@')) return value
    }
  }
  return ''
}
