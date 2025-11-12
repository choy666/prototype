# TODO: Implementar carrito sin login y checkout con login obligatorio

## Tareas Completadas

### 1. Modificar AddToCartButton.tsx
- [x] Eliminar la verificación de sesión en `handleAddToCart`
- [x] Permitir agregar productos al carrito usando solo el store local
- [x] Mantener la funcionalidad de sincronización con servidor cuando esté logueado

### 2. Mejorar sincronización del carrito en app/cart/page.tsx
- [x] Mejorar la lógica de sincronización cuando el usuario inicia sesión
- [x] Asegurar que el carrito local se fusione correctamente con el del servidor
- [x] Evitar duplicados al sincronizar

### 3. Reforzar mensaje de checkout en app/checkout/page.tsx
- [x] Mejorar el mensaje cuando el usuario no está logueado
- [x] Hacer el mensaje más claro y directo sobre la necesidad de iniciar sesión

## Tareas Pendientes

### 4. Testing y validación
- [ ] Probar agregar productos sin login
- [ ] Probar acceso al carrito sin login
- [ ] Probar checkout sin login (debe requerir login)
- [ ] Probar sincronización al loguearse
