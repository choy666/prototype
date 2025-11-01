# TODO: Solución al Error en Reporte de Ventas

## Descripción del Error
- Error: "You tried to reference 'period' field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using '.as('alias')' method."
- Ubicación: `app/api/admin/reports/sales/route.ts`
- Causa: En Drizzle ORM, los campos de SQL raw en subqueries requieren un alias explícito usando `.as('alias')`.

## Pasos para Solucionar
1. **Editar el archivo `app/api/admin/reports/sales/route.ts`**:
   - En la subquery, cambiar la línea:
     ```typescript
     period: sql<string>`to_char(${orders.createdAt}, '${dateFormat}')`,
     ```
     Por:
     ```typescript
     period: sql<string>`to_char(${orders.createdAt}, '${dateFormat}')`.as('period'),
     ```

2. **Verificar la funcionalidad**:
   - Ejecutar el endpoint `/api/admin/reports/sales` para confirmar que el error se resuelve.
   - Probar con diferentes parámetros de período (week, month, quarter, year).

3. **Pruebas adicionales**:
   - Asegurarse de que los datos se agrupan y ordenan correctamente.
   - Verificar que el formato de las etiquetas de período sigue funcionando (formatPeriodLabel).

## Notas
- Este cambio es mínimo y no afecta la lógica del reporte.
- El alias asegura que Drizzle pueda referenciar correctamente el campo en las consultas posteriores.
