'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save } from 'lucide-react'

interface CategoryForm {
  name: string
  description: string
}

export default function NewCategoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CategoryForm>({
    name: '',
    description: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const categoryData = {
        name: form.name,
        description: form.description || undefined
      }

      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create category')
      }

      toast({
        title: 'Éxito',
        description: 'Categoría creada correctamente'
      })

      router.push('/admin/categories')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear la categoría',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof CategoryForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/admin/categories">
          <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nueva Categoría</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Crea una nueva categoría para organizar tus productos
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nombre de la categoría"
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Descripción de la categoría"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white min-h-[100px] resize-y"
                rows={4}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <Link href="/admin/categories">
                <Button type="button" variant="outline" className="w-full sm:w-auto min-h-[44px]">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto min-h-[44px]">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Creando...' : 'Crear Categoría'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
