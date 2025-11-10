# Mejoras Visuales a Botones "Ajustar Stock"

## Tareas Pendientes
- [ ] Importar componente Tooltip en StockManagement.tsx
- [ ] Mejorar botón en sección "Vista General": variante dinámica, tooltip, texto descriptivo, transición
- [ ] Mejorar botones en sección "Variantes": variante dinámica, tooltip, texto descriptivo, transición para cada variante
- [ ] Verificar cambios visuales y funcionalidad

## Información Recopilada
- Archivo principal: components/admin/StockManagement.tsx
- Botones ubicados en pestañas "overview" y "variants"
- Usar variantes de Button: default (verde para +), destructive (rojo para -), secondary (gris para 0)
- Agregar tooltips explicativos
- Texto dinámico: "Aumentar Stock" o "Reducir Stock"
- Transiciones suaves con CSS

## Archivos Dependientes
- components/admin/StockManagement.tsx (editar)
- components/ui/Tooltip.tsx (ya existe, importar)

## Pasos de Seguimiento
- Probar en navegador para verificar colores y tooltips
- Verificar accesibilidad con tooltips
