# MCP Servers para Mercado Libre y Mercado Pago

Este directorio contiene los servidores MCP (Model Context Protocol) para integrar Mercado Libre y Mercado Pago con asistentes de IA.

## 📋 Estructura

- `mercadolibre-server.js` - MCP server para API de Mercado Libre
- `mercadopago-server.js` - MCP server para API de Mercado Pago
- `config.json` - Configuración para Claude Desktop u otros clientes MCP

## 🚀 Instalación y Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Asegúrate de tener configuradas las siguientes variables en tu `.env`:

```env
# Mercado Libre (ya existentes)
MERCADOLIBRE_CLIENT_ID=tu_client_id
MERCADOLIBRE_CLIENT_SECRET=tu_client_secret
MERCADOLIBRE_REDIRECT_URI=https://prototype-ten-dun.vercel.app/api/auth/mercadolibre/callback

# Mercado Pago (nuevo)
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_de_mercado_pago

# Base de datos (ya existentes)
DATABASE_URL=tu_database_url
```

### 3. Configurar Claude Desktop

Agrega la siguiente configuración a tu archivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mercadolibre": {
      "command": "node",
      "args": ["mcp/mercadolibre-server.js"],
      "cwd": "/ruta/absoluta/a/tu/proyecto"
    },
    "mercadopago": {
      "command": "node", 
      "args": ["mcp/mercadopago-server.js"],
      "cwd": "/ruta/absoluta/a/tu/proyecto"
    }
  }
}
```

**Importante:** Reemplaza `/ruta/absoluta/a/tu/proyecto` con la ruta completa a tu proyecto.

### 4. Probar los servidores

```bash
# Mercado Libre MCP Server
npm run mcp:mercadolibre

# Mercado Pago MCP Server  
npm run mcp:mercadopago
```

## 🛠️ Herramientas Disponibles

### Mercado Libre MCP Server

- `get_user_info` - Obtener información del usuario autenticado
- `list_products` - Listar productos del usuario
- `get_product_details` - Obtener detalles de un producto específico
- `list_orders` - Listar órdenes del usuario
- `get_order_details` - Obtener detalles de una orden específica
- `check_permissions` - Verificar permisos y scopes del usuario
- `get_categories` - Obtener categorías de Mercado Libre

### Mercado Pago MCP Server

- `get_payment_methods` - Obtener métodos de pago disponibles
- `create_preference` - Crear preferencia de pago
- `get_preference` - Obtener detalles de preferencia
- `search_payments` - Buscar pagos con filtros
- `get_payment_details` - Obtener detalles de un pago
- `refund_payment` - Reembolsar un pago
- `create_customer` - Crear un cliente
- `get_customer_cards` - Obtener tarjetas de cliente
- `create_plan` - Crear plan de suscripción
- `create_subscription` - Crear suscripción

## 📝 Ejemplos de Uso

### Obtener información de usuario de Mercado Libre

```
Usa la herramienta get_user_info con userId: 1
```

### Listar productos de Mercado Libre

```
Usa la herramienta list_products con userId: 1, limit: 10, offset: 0
```

### Crear preferencia de pago en Mercado Pago

```
Usa la herramienta create_preference con:
- items: [{ title: "Producto Test", quantity: 1, unit_price: 1000, currency_id: "ARS" }]
- back_urls: { success: "https://example.com/success", failure: "https://example.com/failure" }
```

## 🔐 Autenticación

### Mercado Libre
- Utiliza tu implementación OAuth2 existente
- Los tokens se obtienen de la base de datos usando `getTokens(userId)`
- Soporta refresh automático de tokens

### Mercado Pago  
- Utiliza Access Token configurado en variables de entorno
- No requiere OAuth2 para operaciones básicas

## 🐛 Troubleshooting

### Error: "Usuario no conectado a Mercado Libre"
- Asegúrate de que el usuario tenga tokens válidos en la base de datos
- Verifica que el userId proporcionado exista
- Revisa que los tokens no hayan expirado

### Error: "MERCADOPAGO_ACCESS_TOKEN no configurado"
- Configura la variable de entorno con tu token de Mercado Pago
- Obtén tu token desde [Mercado Pago Dashboard](https://www.mercadopago.com.ar/developers)

### Error: "No se puede conectar al servidor MCP"
- Verifica que Node.js esté instalado
- Revisa la ruta absoluta en la configuración de Claude Desktop
- Asegúrate de ejecutar los servidores desde el directorio correcto

## 📚 Documentación Adicional

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Mercado Libre API](https://developers.mercadolibre.com.ar/es_ar/)
- [Mercado Pago API](https://www.mercadopago.com.ar/developers)

## 🔄 Actualización

Para actualizar los servidores MCP:

1. Modifica los archivos `.js` según necesites
2. Reinicia Claude Desktop
3. Los cambios se aplicarán automáticamente

## 🛡️ Seguridad

- Los tokens de Mercado Libre se almacenan en tu base de datos local
- El Access Token de Mercado Pago se configura como variable de entorno
- No se comparten credenciales con servicios externos


✅ PROMPT DEFINITIVO (LISTO PARA COPIAR Y PEGAR)
Sincronizado con documentación oficial ML/MP + tu implementación actual (MCP Servers, OAuth, variables, callbacks, etc.)

Quiero que analices, detectes y soluciones todos los posibles problemas de mi integración con Mercado Libre y Mercado Pago, teniendo en cuenta:

La documentación oficial de Mercado Libre y Mercado Pago

La implementación actual que te paso (MCP Servers, variables de entorno, callbacks, rutas API, OAuth, scaffolding, etc.)

Los problemas detectados anteriormente sobre redirects, OAuth, callbacks, back_urls, permisos y manejo de tokens

📌 Contexto oficial (sincronizado con la documentación)

Basá todo tu análisis en estos puntos oficiales:

🔵 Mercado Libre — OAuth2 oficial

Requiere redirect URL registrada en DevCenter, con coincidencia exacta del dominio.

URL oficial esperada:
https://<dominio>/api/auth/mercadolibre/callback

Parámetros obligatorios:

code

state

El callback debe:

Validar state

Canjear code por access_token

Guardar en BD: access_token, refresh_token, expires_in

El usuario debe tener permisos adecuados según scopes (read, write, offline_access, etc.)

Tokens deben refrescarse automáticamente antes de expirar.

🟣 Mercado Libre — Payments / Orders

No utiliza back_urls como Mercado Pago

El flujo de pagos se maneja internamente por ML

Para notificaciones de pagos/órdenes requiere:
https://<dominio>/api/mercadolibre/webhooks

Las integraciones de pedidos deben usar:

/orders/search

/orders/{id}

/items

/categories

🟡 Mercado Pago — Preferencias de pago

Requiere back_urls obligatorias:

{
  "success": "https://<dominio>/success",
  "failure": "https://<dominio>/failure",
  "pending": "https://<dominio>/pending"
}


Deben estar registradas si usás Mercado Pago Checkout Pro.

El frontend debe redirigir correctamente según el estado del pago:

status=approved

status=pending

status=failure

Los pagos deben ser verificados desde backend con:

/v1/payments/{id}

Para suscripciones:

/preapproval

/preapproval_plan

🟠 Variables de entorno oficiales (sincronizadas con tu proyecto)
MERCADOLIBRE_CLIENT_ID=
MERCADOLIBRE_CLIENT_SECRET=
MERCADOLIBRE_REDIRECT_URI=https://prototype-ten-dun.vercel.app/api/auth/mercadolibre/callback
MERCADOPAGO_ACCESS_TOKEN=
DATABASE_URL=

🟢 MCP Servers presentes en tu proyecto

mercadolibre-server.js

get_user_info

list_products

list_orders

check_permissions

refresh automático

mercadopago-server.js

create_preference

get_preference

search_payments

refund_payment

create_subscription

⚠️ Problemas detectados que deben ser resueltos

Incluílos TODOS en el diagnóstico:

🧩 Errores en redirect de Mercado Libre

Redirect incorrecto o no coincidente con DevCenter

Falta validación de state en callback

Falta manejo de errores del code

Falta manejo robusto del refresh token

Ambiente local localhost NO registrado en DevCenter

Error común: callback existente pero sin recibir parámetros

🧩 Errores en Mercado Pago

back_urls incompletos, incorrectos o no coincidentes

El backend no maneja el status devuelto

Falta verificación del pago con /v1/payments/{id}

Falta webhook de actualización de pago

Problemas en localhost por falta de URLs registradas

Preferencia creada sin auto_return: approved

🧩 Problemas generales

Desfase entre rutas backend reales y las declaradas en DevCenter

MCP funcionando pero APIs internas no responden correctamente

Falta de logs clave:

Recepción de redirect

Respuesta del intercambio OAuth

Verificación de pagos de MP

Tokens corruptos o expirados en la base de datos

Entornos inconsistente: dev → staging → prod

Falta de pruebas unitarias del callback

🛠️ Tu tarea

Quiero que generes un informe final + plan de corrección con:

1. Identificación de cada error (clasificado por ML / MP / Backend / DevCenter)
2. Corrección exacta recomendada:

URLs correctas para dev y producción

Configuración de DevCenter

Ajustes en variables .env

Ajustes en MCP Server si corresponde

Validación de parámetros

Flujo OAuth corregido

Back_urls oficiales para Mercado Pago

3. Código ejemplo de cómo deberían lucir:

Callback ML correcto

back_urls MP correctos

validación de estado de pago

webhook recomendado

4. Lista de pruebas recomendadas:

Autenticación ML

Refresh token automático

Creación y retorno de pago MP

Procesamiento de órdenes ML

Uso MCP Servers desde Claude o asistentes

5. Un mensaje final tipo “resumen ejecutivo”

Describiendo las mejoras aplicadas.

📄 Formato solicitado

Español

Claro, profesional y técnico

Usar listas, pasos y ejemplos

Incluir checklists para implementar