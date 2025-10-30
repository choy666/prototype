'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Users as UsersIcon,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck
} from 'lucide-react'

interface User {
  id: number
  email: string
  name: string
  role: 'user' | 'admin'
  image?: string
  createdAt: string
  updatedAt: string
}

interface ApiResponse {
  data: User[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'user' | 'admin' | ''>('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null)
  const [roleChangeDialog, setRoleChangeDialog] = useState<{
    isOpen: boolean
    userId: number | null
    newRole: 'user' | 'admin' | null
    userName: string
  }>({
    isOpen: false,
    userId: null,
    newRole: null,
    userName: ''
  })
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; userId: number | null; userName: string }>({
    isOpen: false,
    userId: null,
    userName: ''
  })
  const { toast } = useToast()

  const fetchUsers = useCallback(async (searchTerm = '', role = '', pageNum = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(role && { role })
      })
      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) throw new Error('Failed to fetch users')
      const data: ApiResponse = await response.json()
      setUsers(data.data)
      setPagination(data.pagination)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(search, roleFilter, 1)
    setPage(1)
  }

  const handleRoleFilterChange = (role: 'user' | 'admin' | '') => {
    setRoleFilter(role)
    fetchUsers(search, role, 1)
    setPage(1)
  }

  const handleRoleChangeClick = (userId: number, currentRole: 'user' | 'admin', userName: string) => {
    const newRole = currentRole === 'user' ? 'admin' : 'user'
    setRoleChangeDialog({
      isOpen: true,
      userId,
      newRole,
      userName
    })
  }

  const handleRoleChangeConfirm = async () => {
    if (!roleChangeDialog.userId || !roleChangeDialog.newRole) return

    try {
      const response = await fetch(`/api/admin/users/${roleChangeDialog.userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: roleChangeDialog.newRole })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user role')
      }

      toast({
        title: 'Éxito',
        description: `Rol de ${roleChangeDialog.userName} actualizado correctamente`
      })
      fetchUsers(search, roleFilter, page)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo actualizar el rol del usuario'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setRoleChangeDialog({ isOpen: false, userId: null, newRole: null, userName: '' })
    }
  }

  const handleDeleteClick = (userId: number, userName: string) => {
    setDeleteDialog({ isOpen: true, userId, userName })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.userId) return

    try {
      const response = await fetch(`/api/admin/users/${deleteDialog.userId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }

      toast({
        title: 'Éxito',
        description: 'Usuario eliminado correctamente'
      })
      fetchUsers(search, roleFilter, page)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo eliminar el usuario'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setDeleteDialog({ isOpen: false, userId: null, userName: '' })
    }
  }

  const handleRoleChangeCancel = () => {
    setRoleChangeDialog({ isOpen: false, userId: null, newRole: null, userName: '' })
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, userId: null, userName: '' })
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Usuarios' }]} />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona los usuarios y sus roles en el sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar y Filtrar Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={roleFilter === '' ? 'default' : 'outline'}
                  onClick={() => handleRoleFilterChange('')}
                  className="min-h-[44px]"
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant={roleFilter === 'user' ? 'default' : 'outline'}
                  onClick={() => handleRoleFilterChange('user')}
                  className="min-h-[44px]"
                >
                  Usuarios
                </Button>
                <Button
                  type="button"
                  variant={roleFilter === 'admin' ? 'default' : 'outline'}
                  onClick={() => handleRoleFilterChange('admin')}
                  className="min-h-[44px]"
                >
                  Admins
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full sm:w-auto min-h-[44px]">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay usuarios</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No se encontraron usuarios con los criterios de búsqueda.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg space-y-4 sm:space-y-0 gap-4">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={`Avatar de ${user.name}`}
                        width={48}
                        height={48}
                        sizes="(max-width: 640px) 48px, 48px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <UsersIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate text-sm sm:text-base">{user.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Creado: {new Date(user.createdAt).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 flex-shrink-0">
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="w-fit">
                      {user.role === 'admin' ? (
                        <>
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Admin
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3 mr-1" />
                          Usuario
                        </>
                      )}
                    </Badge>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleRoleChangeClick(user.id, user.role, user.name)}
                        className="h-9 w-9"
                        aria-label={`Cambiar rol de ${user.name}`}
                      >
                        {user.role === 'admin' ? <UserX className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(user.id, user.name)}
                        className="h-9 w-9"
                        aria-label={`Eliminar ${user.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-center items-center mt-6 gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1)
                  fetchUsers(search, roleFilter, page - 1)
                }}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Anterior
              </Button>
              <span className="px-4 py-2 text-sm sm:text-base">
                Página {page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === pagination.totalPages}
                onClick={() => {
                  setPage(page + 1)
                  fetchUsers(search, roleFilter, page + 1)
                }}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={roleChangeDialog.isOpen}
        title="Cambiar Rol de Usuario"
        description={`¿Estás seguro de que quieres cambiar el rol de ${roleChangeDialog.userName} a ${roleChangeDialog.newRole === 'admin' ? 'Administrador' : 'Usuario'}?`}
        confirmText="Cambiar Rol"
        cancelText="Cancelar"
        onConfirm={handleRoleChangeConfirm}
        onCancel={handleRoleChangeCancel}
      />

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Eliminar Usuario"
        description={`¿Estás seguro de que quieres eliminar al usuario ${deleteDialog.userName}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  )
}
