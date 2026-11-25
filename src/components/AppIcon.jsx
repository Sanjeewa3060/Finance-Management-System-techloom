import React from 'react'

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-[18px] w-[18px]',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
}

/** Consistent Lucide icon wrapper for the app. */
export default function AppIcon({ icon: Icon, size = 'md', className = '', strokeWidth = 2, ...props }) {
  if (!Icon) return null
  return (
    <Icon
      className={`shrink-0 ${SIZES[size] ?? SIZES.md} ${className}`}
      strokeWidth={strokeWidth}
      aria-hidden
      {...props}
    />
  )
}
