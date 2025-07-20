import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  title: string
  subtitle?: ReactNode
  footer?: ReactNode
}

export default function Card({ children, className = '', title, subtitle, footer }: Props) {
  return (
    <div className={`bg-slate-800 rounded-lg p-6 shadow-lg text-white h-full w-full max-w-xl ${className}`}>
      <h2 className="text-xl font-bold mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-gray-400 mb-4">{subtitle}</p>}
      {children}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  )
}
