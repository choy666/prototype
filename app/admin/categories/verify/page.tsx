'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'

interface CategoryVerification {
  categoryId: string
  apiData: {
    id: string
    name: string
    path_from_root: string[]
    leaf_category: boolean
    listing_allowed: boolean
  }
  localData: {
    id: number
    name: string
    mlCategoryId: string
    isMlOfficial: boolean
    isLeaf: boolean
  } | null
  isDesynced: boolean
}

export default function VerifyCategoriesPage() {
  const [categoryId, setCategoryId] = useState('')
  const [verification, setVerification] = useState<CategoryVerification | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const { toast } = useToast()

  const verifyCategory = async () => {
    if (!categoryId.trim()) {
      toast({
        title: 'Error',
        description: 'Ingresa un ID de categoría (ej: MLA1051)',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/categories/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: categoryId.trim() })
      })

      if (!response.ok) {
        throw new Error('Error al verificar categoría')
      }

      const data = await response.json()
      setVerification(data)

      if (data.isDesynced) {
        toast({
          title: 'Desincronización Detectada',
          description: `La categoría ${categoryId} está desincronizada entre BD y API de ML`,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Categoría Sincronizada',
          description: 'La categoría está correctamente sincronizada',
        })
      }

    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const syncCategories = async () => {
    setSyncLoading(true)
    try {
      const response = await fetch('/api/admin/categories/sync-ml', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Error al sincronizar categorías')
      }

      const data = await response.json()
      toast({
        title: 'Sincronización Completada',
        description: `Se sincronizaron ${data.results?.updated || 0} categorías`,
      })

      // Re-verificar si hay una categoría cargada
      if (categoryId && verification) {
        verifyCategory()
      }

    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      })
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Verificar Categorías ML</h1>
        <p className="text-muted-foreground">
          Diagnostica problemas de sincronización entre BD local y API de Mercado Libre
        </p>
      </div>

      {/* Herramientas */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Herramientas de Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="ID de categoría (ej: MLA1051)"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={verifyCategory} 
              disabled={loading || !categoryId.trim()}
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </Button>
          </div>
          
          <Button 
            onClick={syncCategories}
            disabled={syncLoading}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {syncLoading ? 'Sincronizando...' : 'Sincronizar Todas las Categorías ML'}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {verification && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {verification.isDesynced ? (
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              Resultados para {verification.categoryId}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Estado */}
            <div className="flex items-center gap-2">
              <span className="font-medium">Estado:</span>
              <Badge variant={verification.isDesynced ? "destructive" : "default"}>
                {verification.isDesynced ? "DESYNC" : "OK"}
              </Badge>
            </div>

            {/* Datos API ML */}
            <div>
              <h3 className="font-medium mb-2">API de Mercado Libre:</h3>
              <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                <div><strong>ID:</strong> {verification.apiData.id}</div>
                <div><strong>Nombre:</strong> {verification.apiData.name}</div>
                <div><strong>Ruta:</strong> {verification.apiData.path_from_root?.join(' > ')}</div>
                <div className="flex items-center gap-2">
                  <strong>Categoría Hoja:</strong>
                  <Badge variant={verification.apiData.leaf_category ? "default" : "secondary"}>
                    {verification.apiData.leaf_category ? "SÍ" : "NO"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <strong>Permite Publicar:</strong>
                  <Badge variant={verification.apiData.listing_allowed ? "default" : "secondary"}>
                    {verification.apiData.listing_allowed ? "SÍ" : "NO"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Datos BD Local */}
            <div>
              <h3 className="font-medium mb-2">Base de Datos Local:</h3>
              {verification.localData ? (
                <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  <div><strong>ID:</strong> {verification.localData.id}</div>
                  <div><strong>Nombre:</strong> {verification.localData.name}</div>
                  <div><strong>ML Category ID:</strong> {verification.localData.mlCategoryId}</div>
                  <div className="flex items-center gap-2">
                    <strong>Oficial ML:</strong>
                    <Badge variant={verification.localData.isMlOfficial ? "default" : "secondary"}>
                      {verification.localData.isMlOfficial ? "SÍ" : "NO"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>Categoría Hoja:</strong>
                    <Badge variant={verification.localData.isLeaf ? "default" : "secondary"}>
                      {verification.localData.isLeaf ? "SÍ" : "NO"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground">
                  No encontrada en base de datos local
                </div>
              )}
            </div>

            {/* Acciones si está desincronizado */}
            {verification.isDesynced && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-md">
                <p className="text-sm text-orange-800 mb-2">
                  <strong>Acción recomendada:</strong> Sincroniza las categorías para actualizar los datos locales.
                </p>
                <Button 
                  onClick={syncCategories}
                  disabled={syncLoading}
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Ahora
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
