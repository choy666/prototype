# Flujo de Cálculo de Envíos - Tiendanube

## API Oficial de Tiendanube

### 1. Obtener Transportistas Configurados

```
GET /v1/{store_id}/shipping_carriers
```

Retorna los transportistas habilitados en la tienda con sus configuraciones.

### 2. Opciones de Envío Disponibles

#### a) Envío Fácil (integrado)

- Si la tienda tiene Envío Fácil activado
- Usa: `GET /v1/{store_id}/shipping_carriers/{carrier_id}/rates`
- Calcula tarifas dinámicamente basado en:
  - Código postal origen y destino
  - Peso y dimensiones del paquete
  - Valor declarado

#### b) Transportistas Propios

- Correo Argentino, OCA, Andreani, etc.
- Cada transportista tiene sus propias reglas
- Se debe consultar la API específica de cada uno

#### c) Retiro en Local/Tienda

- Siempre disponible como opción
- Costo: $0 o configurable

### 3. Flujo Implementado

1. **Verificar si Tiendanube está habilitado** en `shipping_settings`
2. **Obtener transportistas** configurados en la tienda
3. **Para cada transportista**:
   - Verificar cobertura para el CP destino
   - Calcular tarifa según peso/dimensiones
   - Obtener tiempo de entrega estimado
4. **Combinar con opciones locales** (retiro en sucursal)
5. **Ordenar por costo** y presentar al usuario

### 4. Consideraciones Importantes

- **No hay cálculo universal**: Cada transportista tiene su API
- **Cobertura geográfica**: No todos cubren todo el país
- **Peso y dimensiones**: Críticos para el cálculo
- **Valor declarado**: Afecta el costo del seguro
- **Tipos de envío**: Estándar, Express, Prioritario

### 5. Implementación Recomendada

```typescript
// 1. Obtener transportistas
const carriers = await getShippingCarriers(storeId);

// 2. Para cada carrier, calcular tarifas
const options = await Promise.all(carriers.map((carrier) => calculateCarrierRate(carrier, params)));

// 3. Agregar opción local
options.push(localShippingOption);

// 4. Filtrar, ordenar y retornar
return options.filter((opt) => opt.isAvailable).sort((a, b) => a.cost - b.cost);
```

## Errores Comunes

1. **Token inválido**: Requiere autenticación OAuth válida
2. **Store ID incorrecto**: Debe coincidir con la tienda conectada
3. **Permisos insuficientes**: Scope `read_shipping` requerido
4. **Transportista no configurado**: La tienda debe tener al menos uno activo
