'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Barcode, Info, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

export interface GTINValue {
  type: 'EAN13' | 'UPC' | 'ISBN' | 'NO_GTIN'
  value: string
}

interface GTINInputProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function GTINInput({ onChange, disabled = false }: GTINInputProps) {
  const [gtinType, setGtinType] = useState<GTINValue['type']>('NO_GTIN')
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Detectar tipo de GTIN basado en la longitud del código (no usado actualmente)
  // const detectGtinType = useCallback((code: string): GTINValue['type'] => {
  //   const cleanCode = code.replace(/[^0-9]/g, '')
  //   
  //   if (cleanCode === '') return 'NO_GTIN'
  //   if (cleanCode.length === 13) return 'EAN13'
  //   if (cleanCode.length === 12) return 'UPC'
  //   if (cleanCode.length === 10 || cleanCode.length === 13) return 'ISBN'
  //   
  //   return 'NO_GTIN'
  // }, [])

  // Validar dígito verificador para EAN-13
  const validateEAN13 = useCallback((code: string): boolean => {
    const cleanCode = code.replace(/[^0-9]/g, '')
    if (cleanCode.length !== 13) return false
    
    let sum = 0
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(cleanCode[i])
      sum += i % 2 === 0 ? digit : digit * 3
    }
    
    const checkDigit = (10 - (sum % 10)) % 10
    return checkDigit === parseInt(cleanCode[12])
  }, [])

  // Validar dígito verificador para UPC-A
  const validateUPC = useCallback((code: string): boolean => {
    const cleanCode = code.replace(/[^0-9]/g, '')
    if (cleanCode.length !== 12) return false
    
    let sum = 0
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(cleanCode[i])
      sum += i % 2 === 0 ? digit * 3 : digit
    }
    
    const checkDigit = (10 - (sum % 10)) % 10
    return checkDigit === parseInt(cleanCode[11])
  }, [])

  // Validar ISBN (simplificado)
  const validateISBN = useCallback((code: string): boolean => {
    const cleanCode = code.replace(/[^0-9X]/gi, '')
    return cleanCode.length === 10 || cleanCode.length === 13
  }, [])

  // Manejar cambio en el input
  const handleInputChange = useCallback((newValue: string) => {
    setInputValue(newValue)
    setError(null)
    
    if (gtinType === 'NO_GTIN') {
      onChange('NO_GTIN')
      return
    }

    // Validar según el tipo
    let isValid = false
    switch (gtinType) {
      case 'EAN13':
        isValid = validateEAN13(newValue)
        if (!isValid && newValue.length === 13) {
          setError('El código EAN-13 no es válido. Verifica el dígito verificador.')
        }
        break
      case 'UPC':
        isValid = validateUPC(newValue)
        if (!isValid && newValue.length === 12) {
          setError('El código UPC no es válido. Verifica el dígito verificador.')
        }
        break
      case 'ISBN':
        isValid = validateISBN(newValue)
        if (!isValid && (newValue.length === 10 || newValue.length === 13)) {
          setError('El ISBN no tiene un formato válido.')
        }
        break
    }

    if (isValid || newValue.length === 0) {
      onChange(newValue)
    }
  }, [gtinType, onChange, validateEAN13, validateUPC, validateISBN])

  // Manejar cambio de tipo
  const handleTypeChange = useCallback((newType: GTINValue['type']) => {
    setGtinType(newType)
    setInputValue('')
    setError(null)
    
    if (newType === 'NO_GTIN') {
      onChange('NO_GTIN')
    }
  }, [onChange])

  // Formato del placeholder según el tipo
  const getPlaceholder = () => {
    switch (gtinType) {
      case 'EAN13': return 'Ej: 7791234567890 (13 dígitos)'
      case 'UPC': return 'Ej: 012345678905 (12 dígitos)'
      case 'ISBN': return 'Ej: 9789871234567 (10 o 13 dígitos)'
      default: return ''
    }
  }

  // Ejemplos visuales
  const getExamples = () => {
    switch (gtinType) {
      case 'EAN13':
        return {
          format: '13 dígitos numéricos',
          example: '7791234567890',
          description: 'Usado en Argentina y la mayoría de los países'
        }
      case 'UPC':
        return {
          format: '12 dígitos numéricos',
          example: '012345678905',
          description: 'Común en Estados Unidos y Canadá'
        }
      case 'ISBN':
        return {
          format: '10 o 13 dígitos',
          example: '978-987-123456-7',
          description: 'Para libros y publicaciones'
        }
      default:
        return null
    }
  }

  const examples = getExamples()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Barcode className="h-5 w-5 text-blue-500" />
        <Label className="font-medium">Código de Barras (GTIN)</Label>
        <Badge variant="outline" className="text-xs">
          Obligatorio
        </Badge>
      </div>

      {/* Selector de tipo */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tipo de código</Label>
        <Select value={gtinType} onValueChange={handleTypeChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NO_GTIN">Sin código de barras</SelectItem>
            <SelectItem value="EAN13">EAN-13 (Europeo/Internacional)</SelectItem>
            <SelectItem value="UPC">UPC-A (Estados Unidos/Canadá)</SelectItem>
            <SelectItem value="ISBN">ISBN (Libros)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Input del código */}
      {gtinType !== 'NO_GTIN' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Número del código</Label>
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={getPlaceholder()}
            disabled={disabled}
            maxLength={gtinType === 'ISBN' ? 17 : 13}
            className={error ? 'border-red-500' : ''}
          />
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Ejemplos visuales */}
          {examples && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">Formato: {examples.format}</div>
                  <div className="text-sm">
                    <strong>Ejemplo:</strong> <code className="bg-gray-100 px-1 rounded">{examples.example}</code>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {examples.description}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Opción sin código */}
      {gtinType === 'NO_GTIN' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Se guardará como &quot;NO_GTIN&quot; para productos sin código de barras.
          </AlertDescription>
        </Alert>
      )}

      {/* Enlace a documentación */}
      <div className="text-xs text-muted-foreground">
        <a 
          href="https://developers.mercadolibre.com.ar/es_ar/atributos-de-producto#gtin" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
        >
          Ver documentación oficial de Mercado Libre
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
