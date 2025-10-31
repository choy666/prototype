# Plan para corregir el error en el reporte de ventas

## Información Recopilada
- El error ocurre en `app/api/admin/reports/sales/route.ts` debido al uso de `strftime`, que no existe en PostgreSQL (NeonDB).
- El código usa Drizzle ORM con consultas SQL que incluyen `strftime` para formatear fechas.
- Necesario cambiar `strftime` por `to_char` de PostgreSQL y ajustar los formatos de fecha.

## Plan
- Actualizar los formatos de fecha (`dateFormat`) para que sean compatibles con `to_char` de PostgreSQL.
- Reemplazar `strftime` por `to_char` en las consultas SQL del select, groupBy y orderBy.

## Archivos a editar
- `app/api/admin/reports/sales/route.ts`

## Pasos de Seguimiento
- [x] Cambiar formatos de fecha de strftime a to_char.
- [x] Reemplazar strftime por to_char en la consulta SQL.
- [x] Iniciar el servidor de desarrollo para verificar los cambios.
- [x] Probar el endpoint con diferentes periodos (month, week, year) - consultas compiladas sin errores de strftime.
- Verificar que las consultas funcionen correctamente después de los cambios.
- Probar el endpoint para asegurar que los reportes se generen sin errores.
