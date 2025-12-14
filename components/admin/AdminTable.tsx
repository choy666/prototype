import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'
import { 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal,
  Eye,
  Edit,
  Trash
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Column<T = Record<string, unknown>> {
  key: keyof T
  label: string
  className?: string
  render?: (value: T[keyof T], row: T) => React.ReactNode
  hideOnMobile?: boolean
}

interface AdminTableProps<T = Record<string, unknown>> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  pagination?: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
  }
  actions?: {
    view?: (row: T) => void
    edit?: (row: T) => void
    delete?: (row: T) => void
  }
  emptyMessage?: string
  emptyDescription?: string
}

export function AdminTable<T = Record<string, unknown>>({
  data,
  columns,
  loading = false,
  pagination,
  actions,
  emptyMessage = 'No hay datos',
  emptyDescription = 'No se encontraron registros para mostrar'
}: AdminTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">{emptyMessage}</h3>
            <p className="text-sm text-gray-500 mt-1">{emptyDescription}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Mobile view - Cards
  const MobileView = () => (
    <div className="space-y-3 md:hidden">
      {data.map((row, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Header with title and actions */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {columns.map((col) => {
                    if (col.hideOnMobile) return null
                    if (col.key === columns[0]?.key) {
                      return (
                        <div key={String(col.key)} className="font-medium text-gray-900">
                          {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
                {actions && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {actions.view && (
                        <DropdownMenuItem onClick={() => actions.view!(row)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver
                        </DropdownMenuItem>
                      )}
                      {actions.edit && (
                        <DropdownMenuItem onClick={() => actions.edit!(row)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {actions.delete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => actions.delete!(row)}
                            className="text-red-600"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              
              {/* Other fields */}
              {columns.slice(1).map((col) => {
                if (col.hideOnMobile) return null
                const value = row[col.key]
                return (
                  <div key={String(col.key)} className="flex justify-between text-sm">
                    <span className="text-gray-500">{col.label}:</span>
                    <span className="text-gray-900">
                      {col.render ? col.render(value, row) : String(value)}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // Desktop view - Table
  const DesktopView = () => (
    <div className="hidden md:block">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={String(col.key)} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
              {actions && <TableHead className="w-[70px]">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index}>
                {columns.map((col) => (
                  <TableCell key={String(col.key)} className={col.className}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell key={String(index)}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.view && (
                          <DropdownMenuItem onClick={() => actions.view!(row)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </DropdownMenuItem>
                        )}
                        {actions.edit && (
                          <DropdownMenuItem onClick={() => actions.edit!(row)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {actions.delete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => actions.delete!(row)}
                              className="text-red-600"
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <MobileView />
      <DesktopView />
      
      {pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
