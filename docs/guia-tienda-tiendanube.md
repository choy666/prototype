# Guía - Tienda Pública Tiendanube

## 🎯 **Overview**

Esta guía explica cómo usar tu proyecto local para gestionar y personalizar una tienda pública en Tiendanube. Mantienes todo el control del backend y el diseño local, mientras Tiendanube se encarga del hosting, SEO y procesamiento de pagos.

## 📋 **Arquitectura**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Backend Local │◄──►│   Tiendanube     │◄──►│   Clientes      │
│   (Control)     │    │   (Storefront)   │    │   (Compra)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
  • Productos           • Estilos Custom       • Experiencia
  • Dashboard           • Componentes JS       • Pagos MP
  • Sincronización      • Checkout Nativo     • Seguimiento
```

## 🚀 **Configuración Inicial**

### 1. **Variables de Entorno**

Asegúrate de tener configuradas las variables en `.env.local`:

```bash
# Configuración Tiendanube
TIENDANUBE_APP_ID=tu_app_id
TIENDANUBE_CLIENT_SECRET=tu_client_secret
TIENDANUBE_USER_AGENT=TuApp/1.0

# URLs y seguridad
INTEGRATION_WEBHOOKS_BASE_URL=https://tudominio.com
INTEGRATION_TOKEN_ENCRYPTION_KEY=tu_32_char_key
```

### 2. **Conectar la Tienda**

1. Ve a `/admin/tiendanube`
2. Click en "Conectar Tiendanube"
3. Autoriza la aplicación
4. Copia el Store ID que aparece

## 🎨 **Personalización de la Tienda**

### **Método 1: Usar el Theme Manager (Recomendado)**

1. Ve a `/admin/tiendanube` y haz click en "Theme Manager"
2. Ingresa el Store ID de tu tienda
3. Usa las pestañas para personalizar:

#### **CSS Personalizado**

```css
/* Ejemplo: Cambiar colores principales */
:root {
  --tn-primary: #3b82f6;
  --tn-secondary: #64748b;
}

/* Ejemplo: Personalizar botones */
.btn-primary {
  background: var(--tn-primary);
  border-radius: 8px;
  transition: all 0.3s;
}
```

#### **JavaScript Personalizado**

```javascript
// Ejemplo: Agregar animación al hover
document.querySelectorAll('.product-card').forEach((card) => {
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
  });
});
```

### **Método 2: Build Automático**

1. Edita los archivos en `tiendanube-assets/`:
   - `css/base.css` - Estilos base
   - `js/components.js` - Componentes interactivos
   - `images/` - Imágenes personalizadas

2. Ejecuta el build:

```bash
npm run build:tiendanube
```

3. Los assets optimizados se guardan en `public/tiendanube/`

## 📦 **Flujo de Trabajo**

### **Desarrollo Local**

```bash
# 1. Editar estilos/componentes
cd tiendanube-assets

# 2. Build de assets
npm run build:tiendanube

# 3. Deploy a Tiendanube (desde el admin)
# Ve a /admin/tiendanube → Theme Manager → Deploy
```

### **Sincronización de Productos**

Los productos se sincronizan automáticamente:

- **Local → Tiendanube**: Stock, precios, nuevos productos
- **Tiendanube → Local**: Órdenes, clientes, envíos

Para sincronizar manualmente:

1. Ve a `/admin/tiendanube`
2. Click en "Forzar Sync"
3. Monitorea el progreso en el dashboard

## 🛠️ **Componentes Disponibles**

### **Galería de Imágenes Mejorada**

- Zoom al hacer click
- Navegación con teclado
- Thumbnails interactivos
- Lazy loading

### **Quick Add to Cart**

- Modal de agregar al carrito
- Selector de cantidad
- Validaciones en tiempo real
- Feedback visual

### **Cross-selling**

- Productos relacionados
- Diseño responsivo
- Integración con carrito

## 📊 **Métricas y Monitoreo**

### **Dashboard de Tiendanube**

Accede desde `/admin/tiendanube/dashboard`:

- **Productos sincronizados**: Total y estado
- **Órdenes importadas**: Últimas 24h
- **Webhooks**: Procesados y fallidos
- **Errores**: Log detallado

### **Logs Importantes**

Busca en los logs estos prefijos:

- `[Tiendanube] Sync:` - Sincronización
- `[Tiendanube] Webhook:` - Eventos recibidos
- `[Tiendanube] Script:` - Deploy de estilos

## 🔧 **Comandos Útiles**

```bash
# Build de assets para Tiendanube
npm run build:tiendanube

# Sincronizar productos manualmente
curl -X POST /api/admin/tiendanube/sync/products \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"storeId": "1234567"}'

# Ver estado de la tienda
curl /api/admin/tiendanube/status?storeId=1234567

# Limpiar scripts personalizados
curl -X DELETE /api/admin/tiendanube/scripts/clean \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"storeId": "1234567"}'
```

## 🎯 **Best Practices**

### **Estilos CSS**

- Usa variables CSS para consistencia
- Mantén clases con prefijo `tn-` para evitar conflictos
- Optimiza para mobile-first
- Minifica antes de deploy

### **JavaScript**

- Envuelve todo en IIFE para evitar conflictos
- Usa delegación de eventos para mejor performance
- Maneja errores con try/catch
- Agrega logs para debugging

### **Performance**

- Lazy loading de imágenes
- Code splitting de JS
- CSS crítico inline
- CDN para assets estáticos

## 🚨 **Troubleshooting**

### **Problemas Comunes**

#### **Los cambios no se reflejan**

1. Limpia cache del navegador
2. Verifica que el script esté activo en las páginas correctas
3. Revisa los logs de deploy

#### **Error al deployar**

1. Verifica el Store ID
2. Confirma que la tienda esté conectada
3. Revisa los permisos de la app

#### **Sincronización fallida**

1. Verifica tokens de acceso
2. Revisa rate limits de API
3. Consulta logs de errores

### **Soporte**

- Logs: Siempre incluye el Store ID y timestamp
- Issues: Usa el template de GitHub con capturas
- Escalation: Contacta a soporte Tiendanube si es problema de API

## 📈 **Próximos Pasos**

1. **Optimización**: Implementar service workers
2. **Analytics**: Integrar Google Analytics personalizado
3. **Testing**: Suite de tests E2E para Tiendanube
4. **Multi-store**: Soporte para múltiples tiendas

---

## ✅ **Checklist de Implementación**

- [ ] Conectar tienda Tiendanube
- [ ] Configurar variables de entorno
- [ ] Personalizar estilos CSS
- [ ] Agregar componentes JavaScript
- [ ] Probar en todas las páginas
- [ ] Verificar sincronización de productos
- [ ] Configurar webhooks
- [ ] Monitorear performance
- [ ] Documentar cambios

¡Listo! Tu tienda Tiendanube está personalizada y funcionando con tu backend local.
