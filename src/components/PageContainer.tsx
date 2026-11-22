import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10', className)}>{children}</div>
}
