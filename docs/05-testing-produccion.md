# Guía de Testing y Producción

## 🧪 Testing Suite

### Configuración Inicial

#### 1. Instalar Dependencias

```bash
npm install --save-dev @playwright/test
npm install --save-dev node-mocks-http
npm install --save-dev @types/node-mocks-http
```

#### 2. Instalar Browsers Playwright

```bash
npx playwright install
```

#### 3. Configuración de Tests

- **Jest**: Tests unitarios y de integración
- **Playwright**: Tests E2E
- **Mocks**: Para APIs externas

### Tipos de Tests

#### Unit Tests (`tests/unit/`)

Componentes aislados con mocks:

- `CheckoutSummary.test.tsx` - Resumen de pedido
- `ShippingForm.test.tsx` - Formulario de envío
- `AddressSelector.test.tsx` - Selector de direcciones

#### Integration Tests (`tests/integration/`)

Flujos completos del sistema:

- `checkout.test.ts` - Servicio completo
- `shipments.test.ts` - API de envíos ME2
- `mercadopago-webhook.test.ts` - Webhooks MP

#### E2E Tests (`tests/e2e/`)

Flujo completo del usuario:

- `checkout.spec.ts` - Compra completa

### Ejecutar Tests

```bash
# Unitarios
npm run test:unit

# Integración
npm run test:integration

# E2E (requiere servidor)
npm run test:e2e

# Todos
npm run test

# Cobertura
npm run test:coverage
```

### Casos de Prueba Cubiertos

1. **Flujo Feliz**: Checkout completo
2. **Validaciones**: DNI/CUIT, stock, ME2
3. **Errores**: Sin stock, ME2 no disponible
4. **Webhooks**: Procesamiento MP
5. **Fallback**: Envío local
6. **Permisos**: Bloqueo admin

## 🚀 Deploy en Producción

### Checklist Pre-Deploy

#### Variables de Entorno

```bash
# Verificar configuración
vercel env ls

# Variables críticas:
DATABASE_URL=...
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=...
MERCADOPAGO_ACCESS_TOKEN=...
ML_APP_ID=...
TIENDANUBE_APP_ID=...
```

#### Base de Datos

```bash
# Migraciones
npm run db:push

# Verificar tablas
psql $DATABASE_URL -c "\dt"
```

#### Build y Optimización

```bash
# Build optimizado
npm run build

# Analizar bundle
npm run analyze

# Lint
npm run lint

# Type check
npm run type-check
```

### Deploy en Vercel

#### 1. Configurar Proyecto

```bash
# Instalar CLI
npm i -g vercel

# Login
vercel login

# Link proyecto
vercel link
```

#### 2. Variables de Entorno

```bash
# Agregar variables
vercel env add NEXTAUTH_URL production
vercel env add DATABASE_URL production
vercel env add MERCADOPAGO_ACCESS_TOKEN production
# ... etc

# Verificar todas
vercel env ls
```

#### 3. Deploy

```bash
# Deploy a producción
vercel --prod

# Verificar deploy
vercel ls
```

### Configuración de Vercel

#### vercel.json

```json
{
  "functions": {
    "app/api/mercadopago/webhooks/route.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/sync-ml",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/health-check",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## 📊 Monitoreo en Producción

### Métricas Clave

#### Performance

- **Response time**: < 200ms (p95)
- **Build time**: < 3 minutos
- **Bundle size**: < 500KB gzipped
- **Lighthouse**: > 90 en todas las categorías

#### Negocio

- **Conversion rate**: > 2%
- **Cart abandonment**: < 70%
- **Page load**: < 3s
- **Uptime**: > 99.9%

#### Técnicas

- **Error rate**: < 1%
- **4xx rate**: < 5%
- **5xx rate**: < 0.1%
- **Memory usage**: < 512MB

### Logs y Alertas

#### Prefijos de Logs

- `[Tiendanube]` - Eventos integración
- `[ML]` - Mercado Libre
- `[ME2]` - Envíos
- `[MP]` - Pagos
- `[ERROR]` - Errores críticos

#### Sistema de Alertas

```javascript
// Ejemplo: Alerta por muchos errores
if (errorCount > 10 in 5min) {
  notifySlack("#alerts", "High error rate detected");
  sendEmail("admin@domain.com", "Production Alert");
}
```

### Herramientas de Monitoreo

#### Vercel Analytics

- Page views y visitantes
- Web Vitals
- Conversiones

#### Sentry (Opcional)

- Error tracking
- Performance monitoring
- Release tracking

#### Custom Dashboard

- Métricas de negocio
- Estado de integraciones
- Logs en tiempo real

## 🔒 Seguridad en Producción

### HTTPS y Certificados

- **Certificado**: Automático con Vercel
- **HSTS**: Configurado por defecto
- **CSP**: Headers de seguridad

#### Headers de Seguridad

```javascript
// next.config.ts
const headers = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=()',
};
```

### Variables de Entorno

- **Secretos**: Nunca en código
- **Rotación**: Cada 90 días
- **Acceso**: Solo equipo necesario

### Autenticación

- **NextAuth**: Configuración segura
- **OAuth**: Scopes mínimos necesarios
- **Sesiones**: Duración limitada

## 🔄 Mantenimiento

### Tareas Diarias

- [ ] Revisar logs de errores
- [ ] Verificar métricas de performance
- [ ] Monitorizar stock crítico
- [ ] Procesar devoluciones pendientes

### Tareas Semanales

- [ ] Actualizar dependencias
- [ ] Revisar reportes de ventas
- [ ] Optimizar imágenes nuevas
- [ ] Backup manual de BD

### Tareas Mensuales

- [ ] Auditoría de seguridad
- [ ] Limpieza de logs antiguos
- [ ] Revisión de costos
- [ ] Actualizar documentación

### Tareas Trimestrales

- [ ] Tests de penetración
- [ ] Optimización de BD
- [ ] Review de arquitectura
- [ ] Capacitación del equipo

## 🚨 Manejo de Incidentes

### Procedimiento de Emergencia

#### 1. Detección

- Monitor automático de errores
- Alertas en Slack/Email
- Dashboard en tiempo real

#### 2. Clasificación

- **Crítico**: Sitio caído, pagos fallando
- **Alto**: Funcionalidad principal rota
- **Medio**: Feature específico roto
- **Bajo**: UI issues, mejoras

#### 3. Respuesta

```bash
# 1. Comunicar
notifySlack("#incidents", "Issue detected");

# 2. Investigar
vercel logs --follow;
grep "ERROR" logs/app.log;

# 3. Contener
vercel rollback [deployment];

# 4. Solucionar
git checkout -b hotfix/fix-issue;
# ... fix ...
git push origin hotfix/fix-issue;
vercel --prod;

# 5. Post-mortem
documentIncident();
updateRunbooks();
```

### Comunicación de Incidentes

#### Plantilla de Comunicación

```
🚨 INCIDENTE DETECTADO
Estado: [Investigando/Contenido/Resuelto]
Inicio: [timestamp]
Impacto: [Descripción]
Acciones: [En progreso]
ETA: [Estimado]
```

## 📈 Optimización Continua

### Performance

- **Bundle splitting**: Código por ruta
- **Lazy loading**: Imágenes y componentes
- **Caching**: CDN y edge
- **Compression**: Gzip/Brotli

### SEO

- **Meta tags**: Dinámicos por página
- **Sitemap**: Automático
- **Robots.txt**: Configurado
- **Structured data**: Productos y artículos

### Conversion

- **A/B testing**: Vercel Edge
- **Analytics**: Eventos personalizados
- **Heatmaps**: Comportamiento usuario
- **Form optimization**: Reducción de fricción

## 📋 Checklist de Producción

### Pre-Lanzamiento

- [ ] Todos los tests pasando
- [ ] Build exitoso sin warnings
- [ ] Variables configuradas
- [ ] Dominio apuntando correcto
- [ ] SSL funcionando
- [ ] Webhooks configurados
- [ ] Monitor activo

### Post-Lanzamiento

- [ ] Verificar funcionalidades críticas
- [ ] Probar flujo completo
- [ ] Confirmar pagos funcionando
- [ ] Validar envíos calculando
- [ ] Chequear sincronización ML/TN
- [ ] Monitorear primeras 24h
- [ ] Documentar cualquier issue

## 🛠️ Herramientas Útiles

### Desarrollo

```bash
# Verificar dependencias
npm audit

# Actualizar paquetes
npm update

# Limpiar node_modules
npm run clean

# Analizar bundle
npm run analyze
```

### Producción

```bash
# Logs de Vercel
vercel logs

# Ver deployment
vercel inspect [url]

# Debug local
vercel dev --debug

# Environment check
vercel env pull .env.production
```

### Debug

```bash
# Verificar variables
printenv | grep -E "(NEXTAUTH|DATABASE|ML|MP)"

# Testear API
curl -I https://yourdomain.com/api/health

# Verificar BD
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

## 📞 Contacto y Soporte

### Equipo de Guardia

- **Primary**: +54 9 XXX XXXX
- **Secondary**: +54 9 YYY YYYY
- **Email**: oncall@domain.com

### Escalation

- **Vercel Support**: Enterprise
- **Mercado Libre**: partners@mercadolibre.com
- **Tiendanube**: developers@tiendanube.com

### Documentación

- **Runbooks**: /docs/runbooks/
- **API Docs**: /docs/api/
- **Architecture**: /docs/architecture/

---

## ✅ Métricas de Éxito

### SLAs (Service Level Agreements)

- **Disponibilidad**: 99.9% (43.2min/mes downtime)
- **Performance**: p95 < 200ms
- **Error Rate**: < 1%
- **Soporte**: Respuesta < 1h, resolución < 4h

### KPIs de Negocio

- **Uptime**: 99.95%
- **Conversion**: > 2.5%
- **Cart Recovery**: 15%
- **Customer Satisfaction**: > 4.5/5

---

_Última actualización: Diciembre 2025_
