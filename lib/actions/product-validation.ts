'use server'

import { validateProductForMLSync } from '@/lib/validations/ml-sync-validation'
import type { ProductForm } from '@/lib/validations/product-validations'

export async function validateProductForMercadoLibre(productData: ProductForm) {
  try {
    console.log('[Product-Validation] Iniciando validación para:', productData.name)
    
    // Convertir ProductForm a formato compatible con Product
    const convertedProduct = {
      id: 0, // ID temporal
      name: productData.name,
      description: productData.description,
      price: productData.price,
      image: productData.image,
      images: productData.images,
      stock: parseInt(productData.stock) || 0,
      mlCategoryId: productData.mlCategoryId,
      mlCondition: productData.mlCondition,
      mlBuyingMode: productData.mlBuyingMode,
      mlListingTypeId: productData.mlListingTypeId,
      mlCurrencyId: productData.mlCurrencyId,
      warranty: productData.warranty,
      mlVideoId: productData.videoId,
      videoId: productData.videoId,
      height: productData.height,
      width: productData.width,
      length: productData.length,
      shippingMode: productData.shippingMode || 'me2',
      me2Compatible: productData.me2Compatible || false,
      attributes: productData.attributes || [],
      created_at: new Date(),
      updated_at: new Date(),
      // Agregar propiedades faltantes con valores por defecto
      categoryId: null,
      category: '',
      discount: parseInt(productData.discount) || 0,
      weight: productData.weight,
      destacado: false,
      isActive: true,
      mlItemId: null,
      mlSyncStatus: 'pending',
      mlLastSync: null,
      mlPermalink: null,
      mlThumbnail: null,
      shippingAttributes: null
    }
    
    console.log('[Product-Validation] Producto convertido, llamando a validateProductForMLSync')
    const validation = await validateProductForMLSync(convertedProduct)
    
    console.log('[Product-Validation] Resultado de validación:', {
      isValid: validation.isValid,
      isReadyForSync: validation.isReadyForSync,
      errorsCount: validation.errors?.length || 0,
      warningsCount: validation.warnings?.length || 0,
      errors: validation.errors,
      warnings: validation.warnings
    })
    
    return { success: true, validation }
  } catch (error) {
    console.error('[Product-Validation] Error en validación:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error de validación desconocido' 
    }
  }
}
