'use client'

import { useState, ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleProps {
  title: string
  children?: ReactNode
  defaultOpen?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  icon?: ReactNode
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
  headerClassName,
  contentClassName,
  icon
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('border rounded-lg', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors',
          headerClassName
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className={cn('px-4 pb-4', contentClassName)}>
          {children}
        </div>
      )}
    </div>
  )
}
