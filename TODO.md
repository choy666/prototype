# TODO: Corregir Handler de API Checkout

## Pasos a Completar

- [x] Verificar e instalar Zod si no está presente en package.json (Ya está instalado: zod 4.1.12)
- [x] Crear esquema Zod para validar payload de items del carrito
- [x] Agregar verificación de variables de entorno al inicio del handler
- [x] Modificar el handler para usar validación Zod en lugar de validaciones manuales
- [x] Mejorar manejo de errores: capturar contexto completo, logs detallados sin datos sensibles
- [x] Implementar fallback seguro: rollback de stock y orden si falla Mercado Pago
- [x] Actualizar logs para incluir más información útil (userId, itemCount, etc.)
- [ ] Probar el endpoint después de cambios
- [ ] Verificar que no se pasen funciones a componentes (revisar componentes relacionados si necesario)

## Notas
- Enfocarse en robustez y seguridad del handler.
- Logs deben ser útiles para debugging sin exponer información sensible.
- Fallback: Si Mercado Pago falla, revertir cambios en DB.
