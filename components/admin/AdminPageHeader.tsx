import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

interface AdminPageHeaderProps {
  title: string
  description?: string
  breadcrumbItems?: { label: string; href?: string }[]
  actionButton?: {
    label: string
    href: string
    icon?: React.ComponentType<{ className?: string }>
  }
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbItems,
  actionButton
}: AdminPageHeaderProps) {
  return (
    <div className="space-y-4 pb-6">
      {breadcrumbItems && (
        <Breadcrumb items={breadcrumbItems} />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actionButton && (
          <Link href={actionButton.href}>
            <Button>
              {actionButton.icon && <actionButton.icon className="h-4 w-4 mr-2" />}
              {actionButton.label}
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
