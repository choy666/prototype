# Guía del Panel de Administración

## 🎯 Overview

Dashboard administrativo completo para gestionar todos los aspectos del e-commerce: productos, órdenes, clientes, integraciones y métricas en tiempo real.

## 🔐 Acceso al Dashboard

### Requisitos

- Usuario con rol `admin`
- Sesión activa (NextAuth)

### URL de Acceso

```
https://yourdomain.com/admin
```

### Si no puedes acceder

1. Verifica que tu cuenta tenga rol `admin`
2. Contacta al desarrollador para asignar rol
3. Limpia caché y cookies del navegador

## 📊 Dashboard Principal

### Métricas en Tiempo Real

#### 1. Total Usuarios

- **Mostrado**: Número total de usuarios registrados
- **Tendencia**: Crecimiento desde el mes anterior
- **Actualización**: Tiempo real

#### 2. Total Productos

- **Mostrado**: Productos con stock > 0
- **Filtro**: Solo productos activos
- **Tendencia**: Crecimiento de productos

#### 3. Total Pedidos

- **Incluye**: Estados `paid`, `shipped`, `delivered`
- **Excluye**: Pedidos cancelados o rechazados
- **Tendencia**: Variación mensual

#### 4. Ingresos Totales

- **Mostrado**: Suma de pedidos válidos
- **Formato**: Moneda local ($12,345.67)
- **Tendencia**: Crecimiento de ingresos

### Indicadores Visuales

- 🟢 Flecha arriba: Crecimiento positivo
- 🔴 Flecha abajo: Disminución
- Porcentaje: Variación desde mes pasado

## 🎛️ Configuración Rápida

### Accesos Directos

#### 1. Configurar Negocio

- **Ruta**: `/admin/business-settings`
- **Función**: Datos básicos de la tienda
- **Importante**: Dirección, contacto, horarios

#### 2. Gestionar Productos

- **Ruta**: `/admin/products`
- **Función**: CRUD completo de productos
- **Acciones**: Crear, editar, eliminar, stock

#### 3. Ver Pedidos

- **Ruta**: `/admin/orders`
- **Función**: Listado y gestión de órdenes
- **Estados**: Actualizar seguimiento

#### 4. Categorías

- **Ruta**: `/admin/categories`
- **Función**: Gestionar categorías
- **Sincronización**: Con Mercado Libre

## 📦 Gestión de Productos

### Listado de Productos

- **Filtros**: Por categoría, stock, estado ML
- **Búsqueda**: Por nombre o SKU
- **Acciones**: Editar, eliminar, sincronizar

### Crear/Editar Producto

#### Pestaña: Información Básica

- Nombre y descripción
- Precio y stock
- Categoría interna
- Estado activo/inactivo

#### Pestaña: Mercado Libre

- Categoría ML (selector jerárquico)
- Tipo de publicación (free/gold_special)
- Condición (new/used)
- Modo de compra (buy_it_now)

#### Pestaña: Atributos del Producto

- **Atributos Dinámicos**: Según categoría ML
- **Recomendados**: Chips con atributos ML
- **Obligatorios**: Marcados con (obligatorio)
- **Sugerencias**: Botón "Ver sugerencias ML"

#### Pestaña: Imágenes

- Upload múltiple
- Orden arrastrar/soltar
- Optimización automática

#### Pestaña: Variantes (si aplica)

- Crear variantes por atributos
- Stock individual por variante
- SKU automático

### Sincronización con ML

1. Configurar categoría y atributos
2. Guardar producto
3. Click en "Sincronizar"
4. Monitorear estado en `mlSyncStatus`

## 📋 Gestión de Órdenes

### Listado de Órdenes

- **Filtros**: Por estado, fecha, cliente
- **Búsqueda**: Por ID o email
- **Exportar**: CSV/Excel

### Detalle de Orden

- **Información**: Cliente, dirección, pago
- **Items**: Productos, cantidades, precios
- **Seguimiento**: Estado actual, historial
- **Acciones**: Actualizar estado, reenviar email

### Estados de Orden

- `pending`: Esperando pago
- `paid`: Pagado confirmado
- `shipped`: Enviado
- `delivered`: Entregado
- `cancelled`: Cancelado

## 👥 Gestión de Clientes

### Listado de Clientes

- Buscar por email o nombre
- Ver historial de pedidos
- Editar información

### Direcciones de Cliente

- Múltiples direcciones
- Dirección principal
- Validación de CUIT/DNI

## 🔌 Integraciones

### Mercado Libre

- **Estado**: Conectado/Desconectado
- **Token**: Válido/Expirado
- **Acciones**: Conectar, desconectar, refresh
- **Métricas**: Productos sincronizados, órdenes importadas

### Tiendanube

- **Tiendas**: Lista de tiendas conectadas
- **Estado**: Activa/Inactiva
- **Webhooks**: Registrados y funcionando
- **Sync**: Productos y órdenes

### Mercado Pago

- **API**: Estado de conexión
- **Webhooks**: Configurados y activos
- **Métricas**: Pagos procesados

## 📈 Reportes y Estadísticas

### Ventas

- **Gráfico**: Ventas por día/mes/año
- **Top productos**: Más vendidos
- **Top clientes**: Mayor gasto

### Productos

- **Stock**: Productos con bajo stock
- **Sin stock**: Alerta de reabastecer
- **Más vistos**: Estadísticas de vistas

### Integraciones

- **ML**: Éxito de sincronización
- **Tiendanube**: Webhooks procesados
- **MP**: Pagos por método

## ⚙️ Configuración del Sistema

### Configuración de Negocio

- **Nombre**: Tienda online
- **Logo**: Upload y optimización
- **Contacto**: Email, teléfono, dirección
- **Horarios**: Atención al cliente

### Métodos de Envío

- **Mercado Envíos 2.0**: Activo/Inactivo
- **Envío local**: Costos y zonas
- **Gratis**: Monto mínimo para envío gratis

### Impuestos y Moneda

- **Moneda**: ARS, USD, etc.
- **IVA**: Configuración de impuestos
- **Precios**: Con/impuestos incluidos

## 🔍 Estado del Sistema

### Indicadores de Salud

#### Base de Datos

- 🟢 **Conectada**: Funcionando normal
- 🔴 **Error**: Problemas de conexión
- **Acción**: Contactar soporte técnico

#### APIs Externas

- **Mercado Libre**: Token válido
- **Tiendanube**: Conectada
- **Mercado Pago**: Activo

#### Performance

- **Response time**: < 200ms
- **Uso de memoria**: Normal
- **CPU**: < 70%

### Logs del Sistema

- **Nivel**: Error, Warning, Info
- **Filtro**: Por componente o fecha
- **Exportar**: Descargar logs

## 🔔 Notificaciones

### Centro de Notificaciones

- **No leídas**: Contador rojo
- **Recientes**: Últimas 5
- **Todas**: Listado completo

### Tipos de Notificación

- 🔴 **Críticas**: Pedidos cancelados, errores
- 🔵 **Info**: Nuevos pedidos, sync completada
- 🟡 **Warning**: Stock bajo, sync con errores

### Configuración de Alertas

- **Email**: Para notificaciones críticas
- **Slack**: Integración con canal
- **SMS**: Para emergencias (opcional)

## 🎨 Personalización

### Tema y Apariencia

- **Modo**: Claro/Oscuro
- **Color primario**: Selector de品牌
- **Logo**: Upload y posición

### Dashboard Personalizado

- **Widgets**: Arrastrar/soltar
- **Gráficos**: Configurar tipo y período
- **Atajos**: Agregar accesos frecuentes

## 🛠️ Herramientas Avanzadas

### Importación/Exportación

- **Productos**: CSV/Excel
- **Clientes**: Migración masiva
- **Órdenes**: Backup mensual

### Acciones Masivas

- **Productos**: Actualizar precios, stock
- **Categorías**: Mover en lote
- **Clientes**: Etiquetar, segmentar

### API Interna

- **Endpoints**: Para integraciones
- **Documentación**: Swagger/OpenAPI
- **Rate limiting**: Por usuario

## 🔒 Seguridad

### Gestión de Usuarios

- **Roles**: Admin, User, Custom
- **Permisos**: Por módulo
- **Auditoría**: Logs de acciones

### Seguridad de Datos

- **Backup**: Automático diario
- **Encriptación**: Datos sensibles
- **GDPR**: Cumplimiento europeo

## 📱 Responsive y Mobile

### Versión Móvil

- **Dashboard**: Adaptado a móvil
- **Acciones**: Touch-friendly
- **Offline**: Modo limitado

### App PWA (Opcional)

- **Install**: Instalar como app
- **Notificaciones**: Push notifications
- **Offline**: Cache básico

## 🚀 Optimización y Performance

### Caché

- **Datos**: 5 minutos dashboard
- **Imágenes**: CDN automático
- **API**: Redis para consultas

### Lazy Loading

- **Gráficos**: Al hacer scroll
- **Tablas**: Paginación infinita
- **Imágenes**: Intersection Observer

## 📞 Soporte y Ayuda

### Centro de Ayuda

- **FAQ**: Preguntas frecuentes
- **Tutoriales**: Videos cortos
- **Documentación**: Guías detalladas

### Contacto Soporte

- **Email**: soporte@dominio.com
- **Chat**: En vivo (horario laboral)
- **Tickets**: Sistema de seguimiento

### Atajos de Teclado

- `Ctrl+K`: Búsqueda rápida
- `Ctrl+/`: Comandos disponibles
- `Esc`: Cerrar modales

## 🔄 Actualizaciones Recientes

### Últimos Cambios

- ✅ Verificación real de APIs externas
- ✅ Monitoreo de estado mejorado
- ✅ Sistema de caché optimizado
- ✅ Notificaciones en tiempo real
- ✅ Métricas avanzadas

### Próximamente

- 🔄 Dashboard personalizable
- 🔄 Reportes avanzados
- 🔄 Integración con Analytics
- 🔄 Modo oscuro

---

## ✅ Checklist de Administración

### Diario

- [ ] Revisar nuevas órdenes
- [ ] Verificar stock crítico
- [ ] Procesar devoluciones
- [ ] Responder consultas

### Semanal

- [ ] Actualizar productos
- [ ] Revisar métricas
- [ ] Backup manual
- [ ] Optimizar imágenes

### Mensual

- [ ] Reporte de ventas
- [ ] Auditoría de seguridad
- [ ] Actualizar precios
- [ ] Revisar integraciones

---

_Última actualización: Diciembre 2025_
