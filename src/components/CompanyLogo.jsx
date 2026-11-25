const LOGO_SRC = '/kaionex-logo.png'

const SIZE_CLASS = {
  sidebar: 'company-logo company-logo--sidebar',
  navbar: 'company-logo company-logo--navbar',
  auth: 'company-logo company-logo--auth',
  nav: 'company-logo company-logo--nav',
  hero: 'company-logo company-logo--hero',
}

export default function CompanyLogo({ size = 'sidebar', className = '' }) {
  const imgClass = SIZE_CLASS[size] ?? SIZE_CLASS.sidebar
  return (
    <img
      src={LOGO_SRC}
      alt="Finance Management System"
      className={className ? `${imgClass} ${className}` : imgClass}
      draggable={false}
    />
  )
}
