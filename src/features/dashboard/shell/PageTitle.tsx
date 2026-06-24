import type { ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<'h1'>

export default function PageTitle({
  className = '',
  children,
  ...props
}: Props) {
  return (
    <h1 className={`page-title ${className}`} {...props}>
      {children}
    </h1>
  )
}