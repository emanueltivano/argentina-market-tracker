import type { ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<'h1'>

export default function PageTitle({
  className = '',
  children,
  ...props
}: Props) {
  return (
    <h1
      className={`mb-4 text-2xl font-bold tracking-tight md:text-3xl ${className}`}
      {...props}
    >
      {children}
    </h1>
  )
}