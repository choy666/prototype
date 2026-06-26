#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} = require('@modelcontextprotocol/sdk/types.js');

// Importar funciones existentes de autenticación
require('dotenv').config();
const { 
  getTokens, 
  makeAuthenticatedRequest, 
  isConnected, 
  getMercadoLibreScopes,
  validateMercadoLibreScopes,
  REQUIRED_SCOPES
} = require('../lib/auth/mercadolibre.js');

class MercadoLibreMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mercadolibre-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // Listar herramientas disponibles
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_user_info',
            description: 'Obtener información del usuario autenticado de Mercado Libre',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'ID del usuario en la base de datos local'
                }
              },
              required: ['userId']
            }
          },
          {
            name: 'list_products',
            description: 'Listar productos del usuario en Mercado Libre',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'ID del usuario en la base de datos local'
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de productos a retornar (default: 50)',
                  default: 50
                },
                offset: {
                  type: 'number',
                  description: 'Número de productos a saltar (default: 0)',
                  default: 0
                }
              },
              required: ['userId']
            }
          },
          {
            name: 'get_product_details',
            description: 'Obtener detalles de un producto específico',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'ID del usuario en la base de datos local'
                },
                productId: {
                  type: 'string',
                  description: 'ID del producto en Mercado Libre'
                }
              },
              required: ['userId', 'productId']
            }
          },
          {
            name: 'list_orders',
            description: 'Listar órdenes del usuario en Mercado Libre',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'ID del usuario en la base de datos local'
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de órdenes a retornar (default: 50)',
                  default: 50
                },
                offset: {
                  type: 'number',
                  description: 'Número de órdenes a saltar (default: 0)',
                  default: 0
                }
              },
              required: ['userId']
            }
          },
          {
            name: 'get_order_details',
            description: 'Obtener detalles de una orden específica',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'ID del usuario en la base de datos local'
                },
                orderId: {
                  type: 'string',
                  description: 'ID de la orden en Mercado Libre'
                }
              },
              required: ['userId', 'orderId']
            }
          },
          {
            name: 'check_permissions',
            description: 'Verificar permisos y scopes del usuario en Mercado Libre',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'ID del usuario en la base de datos local'
                }
              },
              required: ['userId']
            }
          },
          {
            name: 'get_categories',
            description: 'Obtener categorías de Mercado Libre',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'number',
                  description: 'ID del usuario en la base de datos local'
                },
                categoryId: {
                  type: 'string',
                  description: 'ID de categoría específica (opcional, para obtener subcategorías)'
                }
              },
              required: ['userId']
            }
          }
        ]
      };
    });

    // Manejar llamadas a herramientas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_user_info':
            return await this.getUserInfo(args.userId);
          
          case 'list_products':
            return await this.listProducts(args.userId, args.limit, args.offset);
          
          case 'get_product_details':
            return await this.getProductDetails(args.userId, args.productId);
          
          case 'list_orders':
            return await this.listOrders(args.userId, args.limit, args.offset);
          
          case 'get_order_details':
            return await this.getOrderDetails(args.userId, args.orderId);
          
          case 'check_permissions':
            return await this.checkPermissions(args.userId);
          
          case 'get_categories':
            return await this.getCategories(args.userId, args.categoryId);
          
          default:
            throw new Error(`Herramienta desconocida: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error en ${name}: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async getUserInfo(userId) {
    const connected = await isConnected(userId);
    if (!connected) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    const response = await makeAuthenticatedRequest(userId, '/users/me');
    const userData = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(userData, null, 2)
        }
      ]
    };
  }

  async listProducts(userId, limit = 50, offset = 0) {
    const connected = await isConnected(userId);
    if (!connected) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    const response = await makeAuthenticatedRequest(userId, `/users/me/items/search?${params}`);
    const productsData = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(productsData, null, 2)
        }
      ]
    };
  }

  async getProductDetails(userId, productId) {
    const connected = await isConnected(userId);
    if (!connected) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    const response = await makeAuthenticatedRequest(userId, `/items/${productId}`);
    const productData = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(productData, null, 2)
        }
      ]
    };
  }

  async listOrders(userId, limit = 50, offset = 0) {
    const connected = await isConnected(userId);
    if (!connected) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    const response = await makeAuthenticatedRequest(userId, `/orders/search?${params}`);
    const ordersData = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(ordersData, null, 2)
        }
      ]
    };
  }

  async getOrderDetails(userId, orderId) {
    const connected = await isConnected(userId);
    if (!connected) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    const response = await makeAuthenticatedRequest(userId, `/orders/${orderId}`);
    const orderData = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(orderData, null, 2)
        }
      ]
    };
  }

  async checkPermissions(userId) {
    const connected = await isConnected(userId);
    if (!connected) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    const availableScopes = await getMercadoLibreScopes(userId);
    const authValidation = await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.auth);
    const productsValidation = await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.products);
    const inventoryValidation = await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.inventory);
    const ordersValidation = await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.orders);
    const messagesValidation = await validateMercadoLibreScopes(userId, REQUIRED_SCOPES.messages);

    const permissionsData = {
      connected: true,
      availableScopes,
      modules: {
        auth: authValidation,
        products: productsValidation,
        inventory: inventoryValidation,
        orders: ordersValidation,
        messages: messagesValidation
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(permissionsData, null, 2)
        }
      ]
    };
  }

  async getCategories(userId, categoryId = null) {
    const connected = await isConnected(userId);
    if (!connected) {
      throw new Error('Usuario no conectado a Mercado Libre');
    }

    const endpoint = categoryId ? `/sites/MLA/categories/${categoryId}` : '/sites/MLA/categories';
    const response = await makeAuthenticatedRequest(userId, endpoint);
    const categoriesData = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(categoriesData, null, 2)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Mercado Libre MCP Server running on stdio');
  }
}

// Iniciar el servidor
if (require.main === module) {
  const server = new MercadoLibreMCPServer();
  server.run().catch(console.error);
}

module.exports = MercadoLibreMCPServer;
