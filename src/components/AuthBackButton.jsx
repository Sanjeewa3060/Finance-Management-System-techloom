import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AppIcon from './AppIcon.jsx'

export default function AuthBackButton({ to = '/', label = 'Back to home' }) {
  return (
    <Link to={to} className="auth-back-btn">
      <AppIcon icon={ArrowLeft} size="sm" />
      {label}
    </Link>
  )
}
