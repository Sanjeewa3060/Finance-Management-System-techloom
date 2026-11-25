export function getDeviceInfo() {
  if (typeof navigator === 'undefined') {
    return { label: 'Unknown device', userAgent: '' }
  }

  const ua = navigator.userAgent || ''
  let browser = 'Browser'
  let os = 'Unknown OS'

  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'

  if (/Windows NT/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  const label = `${browser} on ${os}`
  return { label, userAgent: ua.slice(0, 512) }
}
