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
