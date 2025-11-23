'use server'

import { db } from '@/lib/db'
import { carts, cartItems, products, productVariants } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/actions/auth'

/**
 * Obtiene el carrito del usuario actual
 */
export async function getUserCart(userId: number) {
  const cart = await db
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1)

  if (!cart.length) return null

  const items = await db
    .select({
      id: cartItems.id,
      cartId: cartItems.cartId,
      productId: cartItems.productId,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        discount: products.discount,
        image: products.image,
        stock: products.stock,
        weight: products.weight,
        attributes: products.attributes,
        isActive: products.isActive,
      },
      variant: {
        id: productVariants.id,
        name: productVariants.name,
        additionalAttributes: productVariants.additionalAttributes,
        price: productVariants.price,
        stock: productVariants.stock,
        images: productVariants.images,
        isActive: productVariants.isActive,
      },
    })
    .from(cartItems)
    .innerJoin(products, and(eq(cartItems.productId, products.id), eq(products.isActive, true)))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(and(
      eq(cartItems.cartId, cart[0].id),
      // Si hay variante, verificar que también esté activa
      cartItems.variantId ? eq(productVariants.isActive, true) : eq(products.isActive, true)
    ))

  return {
    ...cart[0],
    items: items.map(item => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      product: item.product,
      variant: item.variant,
    }))
  }
}

/**
 * Agrega un item al carrito del usuario
 */
export async function addToCart(
  userId: number,
  productId: number,
  quantity: number,
  variantId?: number
) {
  // Verificar autenticación
  const session = await auth()
  if (!session?.user || session.user.id !== userId.toString()) {
    throw new Error('No autorizado')
  }

  // Verificar que el producto existe y está activo
  const product = await db
    .select()
    .from(products)
    .where(and(
      eq(products.id, productId),
      eq(products.isActive, true)
    ))
    .limit(1)

  if (!product.length) {
    throw new Error('Producto no encontrado o no disponible')
  }

  // Si hay variantId, verificar que existe, pertenece al producto y está activa
  if (variantId) {
    const variant = await db
      .select()
      .from(productVariants)
      .where(and(
        eq(productVariants.id, variantId),
        eq(productVariants.productId, productId),
        eq(productVariants.isActive, true)
      ))
      .limit(1)

    if (!variant.length) {
      throw new Error('Variante no encontrada o no disponible')
    }

    // Verificar stock de la variante
    if (variant[0].stock < quantity) {
      throw new Error('Stock insuficiente para la variante seleccionada')
    }
  } else {
    // Verificar stock del producto base
    if (product[0].stock < quantity) {
      throw new Error('Stock insuficiente para el producto')
    }
  }

  // Obtener o crear carrito del usuario
  let cart = await db
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1)

  if (!cart.length) {
    const newCart = await db
      .insert(carts)
      .values({ userId })
      .returning()
    cart = newCart
  }

  const cartId = cart[0].id

  // Verificar si el item ya existe en el carrito (mismo producto y variante)
  const existingItem = await db
    .select()
    .from(cartItems)
    .where(and(
      eq(cartItems.cartId, cartId),
      eq(cartItems.productId, productId),
      variantId ? eq(cartItems.variantId, variantId) : isNull(cartItems.variantId)
    ))
    .limit(1)

  if (existingItem.length) {
    // Actualizar cantidad
    await db
      .update(cartItems)
      .set({
        quantity: existingItem[0].quantity + quantity,
        updatedAt: new Date()
      })
      .where(eq(cartItems.id, existingItem[0].id))
  } else {
    // Crear nuevo item
    await db
      .insert(cartItems)
      .values({
        cartId,
        productId,
        variantId: variantId || null,
        quantity
      })
  }

  revalidatePath('/cart')
  return { success: true }
}

/**
 * Actualiza la cantidad de un item en el carrito
 */
export async function updateCartItemQuantity(
  userId: number,
  cartItemId: number,
  quantity: number
) {
  // Verificar autenticación
  const session = await auth()
  if (!session?.user || session.user.id !== userId.toString()) {
    throw new Error('No autorizado')
  }

  if (quantity <= 0) {
    throw new Error('La cantidad debe ser mayor a 0')
  }

  // Verificar que el item pertenece al usuario
  const item = await db
    .select({
      id: cartItems.id,
      cartId: cartItems.cartId,
      cart: carts
    })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .where(eq(cartItems.id, cartItemId))
    .limit(1)

  if (!item.length || item[0].cart.userId !== userId) {
    throw new Error('Item no encontrado o no autorizado')
  }

  await db
    .update(cartItems)
    .set({
      quantity,
      updatedAt: new Date()
    })
    .where(eq(cartItems.id, cartItemId))

  revalidatePath('/cart')
  return { success: true }
}

/**
 * Remueve un item del carrito
 */
export async function removeFromCart(userId: number, cartItemId: number) {
  // Verificar autenticación
  const session = await auth()
  if (!session?.user || session.user.id !== userId.toString()) {
    throw new Error('No autorizado')
  }

  // Verificar que el item pertenece al usuario
  const item = await db
    .select({
      id: cartItems.id,
      cartId: cartItems.cartId,
      cart: carts
    })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .where(eq(cartItems.id, cartItemId))
    .limit(1)

  if (!item.length || item[0].cart.userId !== userId) {
    throw new Error('Item no encontrado o no autorizado')
  }

  await db
    .delete(cartItems)
    .where(eq(cartItems.id, cartItemId))

  revalidatePath('/cart')
  return { success: true }
}

/**
 * Vacía el carrito del usuario
 */
export async function clearCart(userId: number) {
  // Verificar autenticación
  const session = await auth()
  if (!session?.user || session.user.id !== userId.toString()) {
    throw new Error('No autorizado')
  }

  const cart = await db
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1)

  if (!cart.length) {
    return { success: true } // Carrito ya vacío
  }

  await db
    .delete(cartItems)
    .where(eq(cartItems.cartId, cart[0].id))

  revalidatePath('/cart')
  return { success: true }
}
