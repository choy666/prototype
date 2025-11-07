# TODO: Implementación de Mejoras en Manejo de Imágenes de Variantes

## Problemas Identificados

### 1. Inconsistencia en el Schema de Base de Datos
- **Problema**: El schema `productVariants` tiene `image: text("image")` (singular), pero el componente `ProductVariants.tsx` espera `images?: string[]` (plural).
- **Impacto**: Las imágenes de variantes no se muestran correctamente, resultando en visualizaciones vacías o cuadros negros.
- **Ubicación**: `lib/schema.ts`, `lib/actions/productVariants.ts`, `app/api/admin/products/[id]/variants/route.ts`, `components/admin/ProductVariants.tsx`

### 2. Falta de Validación de URLs de Imágenes
- **Problema**: No hay validación robusta de URLs de imágenes en el frontend, permitiendo URLs inválidas que causan errores 404 o imágenes rotas.
- **Impacto**: Imágenes que no cargan aparecen como cuadros negros o espacios vacíos.

### 3. Falta de Manejo de Errores en Carga de Imágenes
- **Problema**: No hay `onError` handlers en los componentes `Image` de Next.js, causando que imágenes fallidas aparezcan como espacios vacíos.
- **Impacto**: Experiencia de usuario degradada con elementos visuales rotos.

### 4. Inconsistencia en Tipos TypeScript
- **Problema**: La interfaz `ProductVariant` en `ProductVariants.tsx` no coincide con el tipo inferido del schema de Drizzle.
- **Impacto**: Posibles errores de runtime y problemas de type safety.

## Plan de Implementación

### Fase 1: Corrección del Schema de Base de Datos
- [ ] Actualizar `lib/schema.ts`:
  - Cambiar `image: text("image")` por `images: jsonb("images")` en `productVariants`
  - Actualizar tipos TypeScript generados
- [ ] Crear migración de base de datos para migrar datos existentes de `image` a `images`
- [ ] Actualizar `lib/actions/productVariants.ts`:
  - Cambiar todas las referencias de `image` a `images`
  - Asegurar que `images` sea tratado como `string[]`
- [ ] Actualizar `app/api/admin/products/[id]/variants/route.ts`:
  - Cambiar schema de validación para usar `images: z.array(z.string()).optional()`
  - Actualizar lógica de creación/actualización

### Fase 2: Mejoras en el Componente ProductVariants
- [ ] Actualizar interfaz `ProductVariant` para usar `images?: string[]`
- [ ] Agregar validación de URLs de imágenes en el formulario
- [ ] Implementar `onError` handlers en componentes `Image` para mostrar placeholders
- [ ] Agregar indicadores de carga para imágenes
- [ ] Mejorar la visualización minimalista:
  - Mostrar placeholder cuando no hay imágenes
  - Agregar tooltips con información de la variante
  - Implementar lazy loading para mejor performance

### Fase 3: Mejoras en Componentes de UI de Imágenes
- [ ] Actualizar `components/ui/ImageReorder.tsx`:
  - Agregar validación de URLs antes de agregar imágenes
  - Implementar preview con manejo de errores
  - Agregar indicadores de carga
- [ ] Actualizar `components/ui/ImageSingle.tsx`:
  - Agregar validación de URLs
  - Implementar fallback para imágenes que no cargan

### Fase 4: Testing y Validación
- [ ] Crear tests para validar el manejo de imágenes en variantes
- [ ] Probar casos edge: URLs inválidas, imágenes corruptas, arrays vacíos
- [ ] Verificar compatibilidad con datos existentes en la base de datos
- [ ] Probar la edición de variantes con imágenes

### Fase 5: Mejoras Adicionales (Opcionales)
- [ ] Implementar upload de imágenes a cloud storage (Cloudinary, AWS S3, etc.)
- [ ] Agregar compresión automática de imágenes
- [ ] Implementar drag & drop para reordenamiento de imágenes
- [ ] Agregar soporte para múltiples formatos de imagen
- [ ] Implementar cache de imágenes con service worker

## Criterios de Aceptación

### Funcionalidad
- [ ] Las imágenes de variantes se muestran correctamente en la visualización minimalista
- [ ] No hay cuadros negros o espacios vacíos cuando faltan imágenes
- [ ] Las URLs inválidas son rechazadas en el formulario
- [ ] Las imágenes que fallan al cargar muestran un placeholder apropiado
- [ ] La edición de imágenes de variantes funciona correctamente

### Performance
- [ ] Las imágenes se cargan eficientemente (lazy loading)
- [ ] No hay bloqueo del UI mientras cargan las imágenes
- [ ] El reordenamiento de imágenes es fluido

### UX/UI
- [ ] Feedback visual claro durante carga de imágenes
- [ ] Mensajes de error informativos para URLs inválidas
- [ ] Placeholders apropiados para imágenes faltantes
- [ ] Transiciones suaves en la interfaz

## Riesgos y Consideraciones

### Riesgos
- **Migración de datos**: Posible pérdida de datos de imágenes existentes durante la migración
- **Compatibilidad**: Cambios en el schema pueden afectar otras partes del sistema
- **Performance**: Manejo de arrays de imágenes puede impactar performance si no se optimiza

### Consideraciones
- **Backward compatibility**: Mantener soporte para datos antiguos durante transición
- **Storage**: Considerar límites en el número de imágenes por variante
- **SEO**: Asegurar que las imágenes tengan alt texts apropiados
- **Accesibilidad**: Implementar soporte para screen readers en componentes de imagen

## Timeline Estimado

- **Fase 1**: 2-3 días (schema + migración)
- **Fase 2**: 2-3 días (componentes principales)
- **Fase 3**: 1-2 días (componentes UI)
- **Fase 4**: 1-2 días (testing)
- **Fase 5**: 3-5 días (opcional, dependiendo de complejidad)

## Notas Adicionales

- Revisar todas las referencias a `variant.image` vs `variant.images` en el codebase
- Considerar implementar un sistema de versiones para el schema de variantes
- Documentar cambios en el API para consumidores externos
- Actualizar documentación de desarrollo con nuevos tipos y estructuras
