import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { orders, orderItems, products, users } from '@/lib/schema';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { z } from 'zod';
import { CheckoutItem, ShippingAddress, ShippingMethod } from '@/types/checkout';
import { validateProductsForME2Shipping } from '@/lib/validations/me2-products';

// Esquema de validación para el checkout
const checkoutSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().min(1),
    image: z.string().optional(),
    discount: z.number().optional(),
    weight: z.number().optional(),
    variantId: z.string().optional(),
  })),
  shippingAddress: z.object({
    nombre: z.string().min(1),
    direccion: z.string().min(1),
    ciudad: z.string().min(1),
    provincia: z.string().min(1),
    codigoPostal: z.string().min(1),
    telefono: z.string().min(1),
  }),
  shippingMethod: z.object({
    id: z.string(),
    name: z.string(),
    cost: z.number(),
  }),
  userId: z.string(),
});

export interface CheckoutRequest {
  items: CheckoutItem[];
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  userId: string;
}

export interface CheckoutResult {
  paymentUrl: string;
  orderId: string;
  preferenceId: string;
}

export class CheckoutService {
  // Configuración de Mercado Pago
  private static mpClient = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
    options: { timeout: 5000 },
  });

  /**
   * Procesa el checkout completo: validación, stock, creación de orden y preferencia de pago
   */
  static async processCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    // Validar datos de entrada
    const validatedData = checkoutSchema.parse(request);

    // 1. Verificar stock y obtener productos de la base de datos
    const productIds = validatedData.items.map(item => parseInt(item.id));
    const dbProducts = await db
      .select()
      .from(products)
      .where(eq(products.id, productIds[0])); // TODO: Manejar múltiples IDs con in()

    if (dbProducts.length !== validatedData.items.length) {
      throw new Error('Uno o más productos no encontrados');
    }

    // 2. Validar stock
    for (const item of validatedData.items) {
      const product = dbProducts.find(p => p.id === parseInt(item.id));
      if (!product) {
        throw new Error(`Producto ${item.id} no encontrado`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Stock disponible: ${product.stock}`);
      }
    }

    // 3. Validar compatibilidad con ME2 si el método de envío es ME2
    if (validatedData.shippingMethod.id.includes('me2')) {
      const productIds = validatedData.items.map(item => parseInt(item.id));
      const me2Validation = await validateProductsForME2Shipping(productIds);
      if (!me2Validation.allValid) {
        throw new Error('Uno o más productos no son compatibles con Mercado Envíos 2');
      }
    }

    // 4. Obtener datos del usuario
    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(validatedData.userId)));

    if (!userData) {
      throw new Error('Usuario no encontrado');
    }

    // 5. Crear la orden en la base de datos
    const orderTotal = validatedData.items.reduce((total, item) => {
      const price = item.discount && item.discount > 0 
        ? item.price * (1 - item.discount / 100) 
        : item.price;
      return total + (price * item.quantity);
    }, 0) + validatedData.shippingMethod.cost;

    const [newOrder] = await db
      .insert(orders)
      .values({
        userId: parseInt(validatedData.userId),
        status: 'pending',
        total: orderTotal.toString(),
        shippingAddress: validatedData.shippingAddress,
        shippingCost: validatedData.shippingMethod.cost.toString(),
        paymentStatus: 'pending',
        metadata: {
          items: validatedData.items,
        },
      })
      .returning();

    // 6. Crear items de la orden
    for (const item of validatedData.items) {
      await db.insert(orderItems).values({
        orderId: newOrder.id,
        productId: parseInt(item.id),
        quantity: item.quantity,
        price: item.price.toString(),
      });
    }

    // 7. Crear preferencia de pago en MercadoPago
    const preferenceData = {
      items: validatedData.items.map(item => ({
        id: item.id,
        title: item.name,
        description: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        picture_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${item.image}`,
        currency_id: 'ARS',
      })),
      payer: {
        name: validatedData.shippingAddress.nombre.split(' ')[0],
        surname: validatedData.shippingAddress.nombre.split(' ').slice(1).join(' '),
        email: userData.email,
        phone: {
          area_code: validatedData.shippingAddress.telefono.substring(0, 2),
          number: validatedData.shippingAddress.telefono.substring(2),
        },
        address: {
          street_name: validatedData.shippingAddress.direccion,
          street_number: '',
          zip_code: validatedData.shippingAddress.codigoPostal,
          city: validatedData.shippingAddress.ciudad,
        },
        identification: {
          type: userData.documentType || undefined,
          number: userData.documentNumber || undefined,
        },
      },
      shipments: {
        cost: validatedData.shippingMethod.cost,
        mode: validatedData.shippingMethod.id.includes('me2') ? 'me2' : 'custom',
        free_shipping: validatedData.shippingMethod.cost === 0,
        receiver_address: {
          street_name: validatedData.shippingAddress.direccion,
          street_number: '',
          zip_code: validatedData.shippingAddress.codigoPostal,
          city: validatedData.shippingAddress.ciudad,
          state: validatedData.shippingAddress.provincia,
        },
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/payment/success`,
        failure: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/payment/failure`,
        pending: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/payment/pending`,
      },
      auto_return: 'approved',
      external_reference: newOrder.id.toString(),
      notification_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/mercadopago/webhooks`,
    };

    try {
      const preferenceClient = new Preference(CheckoutService.mpClient);
      const preference = await preferenceClient.create({
        body: preferenceData,
      });

      // 8. Actualizar la orden con el ID de preferencia
      await db
        .update(orders)
        .set({ 
          mercadoPagoId: preference.id,
          metadata: {
            ...(newOrder.metadata as Record<string, unknown>),
            preferenceId: preference.id,
          }
        })
        .where(eq(orders.id, newOrder.id));

      return {
        paymentUrl: preference.init_point || preference.sandbox_init_point || '',
        orderId: newOrder.id.toString(),
        preferenceId: preference.id || '',
      };
    } catch {
      // Si falla la creación de la preferencia, eliminar la orden
      await db.delete(orders).where(eq(orders.id, newOrder.id));
      throw new Error('Error al procesar el pago con MercadoPago');
    }
  }

  /**
   * Valida si un carrito es válido para el checkout
   */
  static validateCart(items: CheckoutItem[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!items || items.length === 0) {
      errors.push('El carrito está vacío');
    }

    for (const item of items) {
      if (!item.id || !item.name || !item.price || !item.quantity) {
        errors.push(`El producto ${item.name || 'sin nombre'} tiene datos incompletos`);
      }
      if (item.quantity <= 0) {
        errors.push(`La cantidad del producto ${item.name} debe ser mayor a 0`);
      }
      if (item.price <= 0) {
        errors.push(`El precio del producto ${item.name} debe ser mayor a 0`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calcula el total del checkout incluyendo envío y descuentos
   */
  static calculateTotal(items: CheckoutItem[], shippingCost: number): number {
    const subtotal = items.reduce((total, item) => {
      const price = item.discount && item.discount > 0 
        ? item.price * (1 - item.discount / 100) 
        : item.price;
      return total + (price * item.quantity);
    }, 0);

    return subtotal + shippingCost;
  }
}
