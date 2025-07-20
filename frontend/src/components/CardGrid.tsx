export default function CardGrid({
  children,
  cols = 'grid-cols-1',
  className = '',
}: {
  children: React.ReactNode
  cols?: string
  className?: string
}) {
  return (
    <div className={`grid gap-6 ${cols} ${className}`}>
      {children}
    </div>
  )
}
