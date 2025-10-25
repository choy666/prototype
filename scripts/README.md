# Scripts del Proyecto

Este directorio contiene scripts organizados por funcionalidad para facilitar la gestión y mantenimiento del proyecto.

## 📁 Estructura de Scripts

### 🗄️ `database-manager.ts`
Gestión de base de datos y backups.
```bash
# Crear respaldo
tsx scripts/database-manager.ts backup

# Restaurar respaldo
tsx scripts/database-manager.ts restore

# Verificar salud de BD
tsx scripts/database-manager.ts health
```

### 👥 `user-manager.ts`
Gestión de usuarios.
```bash
# Verificar usuarios existentes
tsx scripts/user-manager.ts check

# Crear usuario de prueba
tsx scripts/user-manager.ts create-test
```

### ⚙️ `setup-manager.ts`
Configuración inicial del proyecto.
```bash
# Crear categorías
tsx scripts/setup-manager.ts categories

# Crear métodos de envío
tsx scripts/setup-manager.ts shipping

# Configuración completa
tsx scripts/setup-manager.ts all
```

### 🧪 `testing-manager.ts`
Pruebas del sistema.
```bash
# Pruebas CSRF
tsx scripts/testing-manager.ts csrf

# Pruebas de seguridad
tsx scripts/testing-manager.ts security

# Pruebas funcionales
tsx scripts/testing-manager.ts functional

# Pruebas de creación de orden
tsx scripts/testing-manager.ts order

# Pruebas de estructura webhook
tsx scripts/testing-manager.ts webhook

# Simular webhook
tsx scripts/testing-manager.ts simulate-webhook

# Todas las pruebas
tsx scripts/testing-manager.ts all
```

### 🪝 `webhook-manager.ts`
Gestión de webhooks de Mercado Pago.
```bash
# Validar configuración
tsx scripts/webhook-manager.ts validate

# Simular webhook
tsx scripts/webhook-manager.ts simulate

# Probar estructura
tsx scripts/webhook-manager.ts structure

# Todo
tsx scripts/webhook-manager.ts all
```

### 📋 `deploy-checklist.md`
Checklist completo para deploy en producción.

### ✅ `verify-checkout.js`
Script de verificación del flujo de checkout.

## 🚀 Uso General

Todos los scripts TypeScript se ejecutan con:
```bash
tsx scripts/[script-name].ts [comando]
```

## 📊 Funcionalidades Agrupadas

### Base de Datos
- `database-manager.ts`: Backup, restore, health check

### Usuarios
- `user-manager.ts`: Gestión de usuarios

### Configuración
- `setup-manager.ts`: Datos iniciales

### Testing
- `testing-manager.ts`: Pruebas completas

### Webhooks
- `webhook-manager.ts`: Gestión Mercado Pago

### Deploy
- `deploy-checklist.md`: Guía de producción
- `verify-checkout.js`: Verificación de checkout

## 🎯 Beneficios de la Reorganización

- ✅ **Reducción de archivos**: De 16 a 7 archivos principales
- ✅ **Mejor organización**: Scripts agrupados por funcionalidad
- ✅ **Mantenimiento simplificado**: Código consolidado y reutilizable
- ✅ **Documentación clara**: README integrado
- ✅ **Consistencia**: Interfaces uniformes y comandos estandarizados
