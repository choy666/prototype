# Guía del Administrador - Dashboard

## Tabla de Contenidos
1. [Visión General](#visión-general)
2. [Acceso al Dashboard](#acceso-al-dashboard)
3. [Sección Principal](#sección-principal)
4. [Métricas y Estadísticas](#métricas-y-estadísticas)
5. [Configuración Rápida](#configuración-rápida)
6. [Estado del Sistema](#estado-del-sistema)
7. [Notificaciones](#notificaciones)
8. [Secciones Disponibles](#secciones-disponibles)
9. [Troubleshooting](#troubleshooting)

## Visión General

El dashboard del administrador es el centro de control principal de tu tienda. Aquí podrás monitorear el rendimiento, gestionar productos, pedidos y configuraciones importantes del sistema.

### Características Principales:
- 📊 **Estadísticas en tiempo real** de usuarios, productos, pedidos e ingresos
- 🔧 **Acceso rápido** a las configuraciones más importantes
- 📢 **Sistema de notificaciones** para eventos críticos
- 🖥️ **Monitoreo del estado** de los servicios integrados

## Acceso al Dashboard

Para acceder al dashboard del administrador:

1. Inicia sesión en tu cuenta
2. Navega a `/admin` o haz clic en "Administración" en el menú
3. Solo los usuarios con rol `admin` pueden acceder

> **Nota:** Si no puedes acceder, verifica que tu cuenta tenga el rol de administrador configurado correctamente.

## Sección Principal

### Título y Bienvenida
- **Dashboard**: Título principal de la sección
- **Mensaje de bienvenida**: "Bienvenido al panel de administración. Aquí puedes gestionar tu tienda."

## Métricas y Estadísticas

El dashboard muestra 4 tarjetas principales con estadísticas clave:

### 1. Total Usuarios
- **Mostrado**: Número total de usuarios registrados
- **Tendencia**: Porcentaje de crecimiento desde el mes anterior
- **Icono**: 👥 Users
- **Actualización**: En tiempo real

### 2. Total Productos
- **Mostrado**: Número de productos con stock > 0
- **Tendencia**: Crecimiento de productos activos
- **Icono**: 📦 Package
- **Filtro**: Solo muestra productos disponibles

### 3. Total Pedidos
- **Mostrado**: Pedidos con estado: paid, shipped, delivered
- **Excluye**: Pedidos cancelados o rechazados
- **Tendencia**: Variación respecto al mes anterior
- **Icono**: 🛒 ShoppingCart

### 4. Ingresos Totales
- **Mostrado**: Suma de totales de pedidos válidos
- **Formato**: Moneda local (ej: $12,345.67)
- **Tendencia**: Crecimiento de ingresos
- **Icono**: 💵 DollarSign

### Indicadores de Tendencia
- 🟢 **Flecha arriba**: Crecimiento positivo
- 🔴 **Flecha abajo**: Disminución
- **Porcentaje**: Variación desde el mes pasado

## Configuración Rápida

Esta sección proporciona acceso directo a las funciones más utilizadas:

### 1. Configurar Negocio
- **Ruta**: `/admin/business-settings`
- **Función**: Configurar datos básicos del negocio
- **Importante**: Dirección, contacto, horarios

### 2. Gestionar Productos
- **Ruta**: `/admin/products`
- **Función**: CRUD de productos
- **Acciones**: Crear, editar, eliminar, gestionar stock

### 3. Ver Pedidos
- **Ruta**: `/admin/orders`
- **Función**: Listado y gestión de pedidos
- **Estados**: Actualizar estados de envío

### 4. Categorías
- **Ruta**: `/admin/categories`
- **Función**: Gestionar categorías de productos
- **Sincronización**: Con MercadoLibre

## Estado del Sistema

Monitorea la salud de los servicios críticos:

### 1. Base de Datos
- **🟢 Conectada**: Todo funciona correctamente
- **🔴 Error de conexión**: Problemas con la base de datos
- **Acción**: Contactar soporte técnico

### 2. MercadoLibre API
- **🟢 Conectado**: API funcionando, token válido
- **🟡 No conectado**: No hay token configurado
- **🔴 Error de API**: Token inválido o problemas con ML
- **Acción**: Reautenticar en MercadoLibre

### 3. Pagos (MercadoPago)
- **🟢 Activo**: API de pagos funcionando
- **🟡 No configurado**: Falta token de MercadoPago
- **🔴 Error de conexión**: Problemas con la API
- **Acción**: Verificar credenciales de MP

> **Importante**: Los estados se actualizan cada 5 minutos automáticamente para evitar sobrecarga.

## Notificaciones

Sistema de alertas para eventos importantes:

### Tipos de Notificaciones
1. **🔴 Pedidos Cancelados**: Alerta crítica
2. **🔵 Otras**: Notificaciones generales

### Características
- **No leídas**: Muestran contador rojo
- **Recientes**: Últimas 5 notificaciones
- **Enlace directo**: Acceso rápido a detalles del pedido

### Gestión
- Las notificaciones se marcan como leídas automáticamente al visualizarlas
- Puedes ver todas las notificaciones en la sección dedicada

## Secciones Disponibles

### Gestión de Productos
- **Productos**: CRUD completo
- **Atributos**: Configuración de variantes
- **Categorías**: Sincronización con ML
- **Stock**: Control de inventario

### Gestión de Pedidos
- **Listado**: Todos los pedidos con filtros
- **Detalles**: Información completa por pedido
- **Estados**: Actualización de seguimiento

### Configuración
- **Negocio**: Datos de la tienda
- **Métodos de Envío**: Configuración de ME2
- **MercadoLibre**: Integración y sincronización

### Reportes
- **Estadísticas**: Análisis de ventas
- **Tendencias**: Gráficos y métricas

## Troubleshooting

### Problemas Comunes

#### No puedo acceder al dashboard
- **Verifica**: Que tengas rol de admin
- **Solución**: Contacta al desarrollador para asignar rol

#### Estado del Sistema muestra errores
- **Base de Datos**: Espera unos minutos y recarga
- **MercadoLibre API**: Reautentica en `/admin/mercadolibre`
- **Pagos**: Verifica variables de entorno MP_ACCESS_TOKEN

#### Las estadísticas no se actualizan
- **Recarga**: La página (F5 o Cmd+R)
- **Cache**: Las estadísticas tienen cache de 5 minutos
- **Horario**: Las tendencias se calculan por mes calendario

#### Notificaciones no aparecen
- **Filtro**: Verifica que tengamos notificaciones no leídas
- **Permisos**: Asegúrate tener permisos de administrador

### Contacto de Soporte
Para problemas técnicos:
- **Email**: [tu-email@dominio.com]
- **Urgente**: [teléfono de contacto]
- **Horario**: Lun-Vie 9-18hs

---

## Buenas Prácticas

1. **Revisa diariamente**: El estado del sistema
2. **Monitorea**: Las tendencias de ventas
3. **Atiende**: Las notificaciones críticas rápidamente
4. **Mantén**: Actualizados los productos y stock
5. **Sincroniza**: Regularmente con MercadoLibre

## Actualizaciones Recientes

- ✅ Verificación real de MercadoLibre API
- ✅ Monitoreo de estado de pagos
- ✅ Sistema de caché para mejor rendimiento
- ✅ Notificaciones mejoradas
- ✅ Métricas en tiempo real

---

*Última actualización: Diciembre 2025*
