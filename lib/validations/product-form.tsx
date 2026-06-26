import React from 'react'
import { CheckCircle, AlertCircle, Info, Camera, Truck, Tag, FileText, AlertTriangle } from 'lucide-react'

export interface DynamicAttribute {
  id: string
  name: string
  values: string[]
}

export interface ValidationItem {
  field: string
  label: string
  isValid: boolean
  isRequired: boolean
  icon?: React.ReactNode
}

export interface ProductForm {
  name: string
  description: string
  price: string
  image: string
  images: string[]
  discount: string
  weight: string
  stock: string
  destacado: boolean
  mlCondition: string
  mlBuyingMode: string
  mlListingTypeId: string
  mlCurrencyId: string
  mlCategoryId: string
  warranty: string
  videoId: string
  height: string
  width: string
  length: string
  mlItemId?: string
  shippingMode?: string
  me2Compatible?: boolean
  attributes?: DynamicAttribute[]
}

export const getValidations = (form: ProductForm): ValidationItem[] => {
  return [
    {
      field: 'name',
      label: 'Nombre del producto',
      isValid: form.name.trim().length >= 3,
      isRequired: true,
      icon: <FileText className="h-4 w-4" />
    },
    {
      field: 'description',
      label: 'Descripción',
      isValid: form.description.trim().length >= 50,
      isRequired: true,
      icon: <FileText className="h-4 w-4" />
    },
    {
      field: 'price',
      label: 'Precio',
      isValid: parseFloat(form.price) > 0,
      isRequired: true,
      icon: <Tag className="h-4 w-4" />
    },
    {
      field: 'image',
      label: 'Imagen principal',
      isValid: form.image.trim().length > 0,
      isRequired: true,
      icon: <Camera className="h-4 w-4" />
    },
    {
      field: 'mlCategoryId',
      label: 'Categoría ML',
      isValid: form.mlCategoryId.trim().length > 0,
      isRequired: true,
      icon: <Tag className="h-4 w-4" />
    },
    {
      field: 'height',
      label: 'Alto',
      isValid: parseFloat(form.height) > 0,
      isRequired: true,
      icon: <Truck className="h-4 w-4" />
    },
    {
      field: 'width',
      label: 'Ancho',
      isValid: parseFloat(form.width) > 0,
      isRequired: true,
      icon: <Truck className="h-4 w-4" />
    },
    {
      field: 'length',
      label: 'Largo',
      isValid: parseFloat(form.length) > 0,
      isRequired: true,
      icon: <Truck className="h-4 w-4" />
    },
    {
      field: 'weight',
      label: 'Peso',
      isValid: parseFloat(form.weight) > 0,
      isRequired: true,
      icon: <Truck className="h-4 w-4" />
    },
    {
      field: 'mlCondition',
      label: 'Condición',
      isValid: form.mlCondition.trim().length > 0,
      isRequired: true,
      icon: <Info className="h-4 w-4" />
    },
    {
      field: 'mlBuyingMode',
      label: 'Modalidad',
      isValid: form.mlBuyingMode.trim().length > 0,
      isRequired: true,
      icon: <Tag className="h-4 w-4" />
    },
    {
      field: 'mlListingTypeId',
      label: 'Tipo de publicación',
      isValid: form.mlListingTypeId.trim().length > 0,
      isRequired: true,
      icon: <Info className="h-4 w-4" />
    },
    {
      field: 'mlCurrencyId',
      label: 'Moneda',
      isValid: form.mlCurrencyId.trim().length > 0,
      isRequired: true,
      icon: <Tag className="h-4 w-4" />
    }
  ]
}

export const calculateReadinessScore = (form: ProductForm): number => {
  const validations = getValidations(form)
  const requiredValidations = validations.filter(v => v.isRequired).length
  const completedRequired = validations.filter(v => v.isRequired && v.isValid).length
  return Math.round((completedRequired / requiredValidations) * 100)
}

export const getReadinessColor = (score: number): string => {
  if (score >= 90) return 'border-emerald-500 bg-emerald-950/30'
  if (score >= 70) return 'border-amber-500 bg-amber-950/30'
  return 'border-red-500 bg-red-950/30'
}

export const getReadinessIcon = (score: number): React.ReactNode => {
  if (score >= 90) return <CheckCircle className="h-4 w-4 text-emerald-400" />
  if (score >= 70) return <AlertTriangle className="h-4 w-4 text-amber-400" />
  return <AlertCircle className="h-4 w-4 text-red-400" />
}

export const isME2Ready = (form: ProductForm): boolean => {
  return (
    parseFloat(form.height) > 0 &&
    parseFloat(form.width) > 0 &&
    parseFloat(form.length) > 0 &&
    parseFloat(form.weight) > 0
  )
}
