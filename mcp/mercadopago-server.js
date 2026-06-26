#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} = require('@modelcontextprotocol/sdk/types.js');

// Importar Mercado Pago SDK y funciones de autenticación
require('dotenv').config();
const mercadopago = require('mercadopago');
const { 
  getTokens, 
  isConnected 
} = require('../lib/auth/mercadolibre.js');

class MercadoPagoMCPServer {
  constructor() {
    // Configurar Mercado Pago SDK
    mercadopago.configure({
      access_token: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    });

    this.server = new Server(
      {
        name: 'mercadopago-mcp-server',
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
            name: 'get_payment_methods',
            description: 'Obtener métodos de pago disponibles en Mercado Pago',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'create_preference',
            description: 'Crear una preferencia de pago en Mercado Pago',
            inputSchema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  description: 'Array de items para la preferencia',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      quantity: { type: 'number' },
                      unit_price: { type: 'number' },
                      currency_id: { type: 'string', default: 'ARS' }
                    },
                    required: ['title', 'quantity', 'unit_price']
                  }
                },
                payer: {
                  type: 'object',
                  description: 'Información del pagador (opcional)',
                  properties: {
                    email: { type: 'string' },
                    name: { type: 'string' },
                    surname: { type: 'string' }
                  }
                },
                back_urls: {
                  type: 'object',
                  description: 'URLs de redirección',
                  properties: {
                    success: { type: 'string' },
                    failure: { type: 'string' },
                    pending: { type: 'string' }
                  }
                },
                auto_return: {
                  type: 'string',
                  description: 'Auto retorno (approved, all)',
                  default: 'approved'
                }
              },
              required: ['items']
            }
          },
          {
            name: 'get_preference',
            description: 'Obtener detalles de una preferencia de pago',
            inputSchema: {
              type: 'object',
              properties: {
                preferenceId: {
                  type: 'string',
                  description: 'ID de la preferencia de pago'
                }
              },
              required: ['preferenceId']
            }
          },
          {
            name: 'search_payments',
            description: 'Buscar pagos con filtros',
            inputSchema: {
              type: 'object',
              properties: {
                criteria: {
                  type: 'string',
                  description: 'Criterio de búsqueda (id, external_reference, etc.)'
                },
                status: {
                  type: 'string',
                  description: 'Estado del pago (approved, pending, rejected, etc.)'
                },
                limit: {
                  type: 'number',
                  description: 'Límite de resultados (default: 30)',
                  default: 30
                },
                offset: {
                  type: 'number',
                  description: 'Offset para paginación (default: 0)',
                  default: 0
                }
              },
              required: []
            }
          },
          {
            name: 'get_payment_details',
            description: 'Obtener detalles de un pago específico',
            inputSchema: {
              type: 'object',
              properties: {
                paymentId: {
                  type: 'string',
                  description: 'ID del pago en Mercado Pago'
                }
              },
              required: ['paymentId']
            }
          },
          {
            name: 'refund_payment',
            description: 'Reembolsar un pago',
            inputSchema: {
              type: 'object',
              properties: {
                paymentId: {
                  type: 'string',
                  description: 'ID del pago a reembolsar'
                },
                amount: {
                  type: 'number',
                  description: 'Monto a reembolsar (opcional, si no se especifica es total)'
                }
              },
              required: ['paymentId']
            }
          },
          {
            name: 'create_customer',
            description: 'Crear un cliente en Mercado Pago',
            inputSchema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: 'Email del cliente'
                },
                first_name: {
                  type: 'string',
                  description: 'Nombre del cliente'
                },
                last_name: {
                  type: 'string',
                  description: 'Apellido del cliente'
                },
                phone: {
                  type: 'object',
                  description: 'Teléfono del cliente',
                  properties: {
                    area_code: { type: 'string' },
                    number: { type: 'string' }
                  }
                },
                identification: {
                  type: 'object',
                  description: 'Identificación del cliente',
                  properties: {
                    type: { type: 'string' },
                    number: { type: 'string' }
                  }
                },
                address: {
                  type: 'object',
                  description: 'Dirección del cliente',
                  properties: {
                    street_name: { type: 'string' },
                    street_number: { type: 'number' },
                    zip_code: { type: 'string' }
                  }
                }
              },
              required: ['email']
            }
          },
          {
            name: 'get_customer_cards',
            description: 'Obtener tarjetas guardadas de un cliente',
            inputSchema: {
              type: 'object',
              properties: {
                customerId: {
                  type: 'string',
                  description: 'ID del cliente en Mercado Pago'
                }
              },
              required: ['customerId']
            }
          },
          {
            name: 'create_plan',
            description: 'Crear un plan de suscripción',
            inputSchema: {
              type: 'object',
              properties: {
                reason: {
                  type: 'string',
                  description: 'Razón del plan'
                },
                auto_recurring: {
                  type: 'object',
                  description: 'Configuración de recurrencia',
                  properties: {
                    frequency: { type: 'number' },
                    frequency_type: { type: 'string', enum: ['days', 'months'] },
                    transaction_amount: { type: 'number' },
                    currency_id: { type: 'string', default: 'ARS' }
                  },
                  required: ['frequency', 'frequency_type', 'transaction_amount']
                }
              },
              required: ['reason', 'auto_recurring']
            }
          },
          {
            name: 'create_subscription',
            description: 'Crear una suscripción a un plan',
            inputSchema: {
              type: 'object',
              properties: {
                plan_id: {
                  type: 'string',
                  description: 'ID del plan'
                },
                payer_email: {
                  type: 'string',
                  description: 'Email del pagador'
                },
                back_url: {
                  type: 'string',
                  description: 'URL de retorno'
                }
              },
              required: ['plan_id', 'payer_email']
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
          case 'get_payment_methods':
            return await this.getPaymentMethods();
          
          case 'create_preference':
            return await this.createPreference(args);
          
          case 'get_preference':
            return await this.getPreference(args.preferenceId);
          
          case 'search_payments':
            return await this.searchPayments(args);
          
          case 'get_payment_details':
            return await this.getPaymentDetails(args.paymentId);
          
          case 'refund_payment':
            return await this.refundPayment(args.paymentId, args.amount);
          
          case 'create_customer':
            return await this.createCustomer(args);
          
          case 'get_customer_cards':
            return await this.getCustomerCards(args.customerId);
          
          case 'create_plan':
            return await this.createPlan(args);
          
          case 'create_subscription':
            return await this.createSubscription(args);
          
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

  async getPaymentMethods() {
    try {
      const response = await mercadopago.payment_methods.list();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error obteniendo métodos de pago: ${error.message}`);
    }
  }

  async createPreference({ items, payer, back_urls, auto_return = 'approved' }) {
    try {
      const preference = {
        items,
        auto_return,
        ...(payer && { payer }),
        ...(back_urls && { back_urls })
      };

      const response = await mercadopago.preferences.create(preference);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error creando preferencia: ${error.message}`);
    }
  }

  async getPreference(preferenceId) {
    try {
      const response = await mercadopago.preferences.findById(preferenceId);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error obteniendo preferencia: ${error.message}`);
    }
  }

  async searchPayments({ criteria, status, limit = 30, offset = 0 }) {
    try {
      const searchCriteria = {
        limit,
        offset,
        ...(criteria && { criteria }),
        ...(status && { status })
      };

      const response = await mercadopago.payment.search(searchCriteria);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error buscando pagos: ${error.message}`);
    }
  }

  async getPaymentDetails(paymentId) {
    try {
      const response = await mercadopago.payment.findById(paymentId);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error obteniendo detalles del pago: ${error.message}`);
    }
  }

  async refundPayment(paymentId, amount) {
    try {
      let response;
      if (amount) {
        // Reembolso parcial
        response = await mercadopago.payment.refund(paymentId, amount);
      } else {
        // Reembolso total
        response = await mercadopago.payment.refund(paymentId);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error reembolsando pago: ${error.message}`);
    }
  }

  async createCustomer({ email, first_name, last_name, phone, identification, address }) {
    try {
      const customerData = {
        email,
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
        ...(phone && { phone }),
        ...(identification && { identification }),
        ...(address && { address })
      };

      const response = await mercadopago.customers.create(customerData);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error creando cliente: ${error.message}`);
    }
  }

  async getCustomerCards(customerId) {
    try {
      const response = await mercadopago.customers.cards.list(customerId);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error obteniendo tarjetas del cliente: ${error.message}`);
    }
  }

  async createPlan({ reason, auto_recurring }) {
    try {
      const planData = {
        reason,
        auto_recurring
      };

      const response = await mercadopago.plans.create(planData);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error creando plan: ${error.message}`);
    }
  }

  async createSubscription({ plan_id, payer_email, back_url }) {
    try {
      const subscriptionData = {
        plan_id,
        payer: {
          email: payer_email
        },
        back_url
      };

      const response = await mercadopago.subscriptions.create(subscriptionData);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.body, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Error creando suscripción: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Mercado Pago MCP Server running on stdio');
  }
}

// Iniciar el servidor
if (require.main === module) {
  const server = new MercadoPagoMCPServer();
  server.run().catch(console.error);
}

module.exports = MercadoPagoMCPServer;
