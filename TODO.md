# TODO: Resolver errores de autenticación en funciones de stock

## Problema
Los errores "Usuario no autenticado" ocurren en las funciones de stock porque usan una configuración de auth básica que no maneja correctamente las cookies en producción/entornos con proxy.

## Solución
Cambiar los imports de `auth` de `@/lib/auth` a `@/lib/actions/auth` para usar la configuración más robusta con `trustHost: true` y cookies personalizadas.

## Pasos
- [ ] Cambiar import en `lib/actions/stock.ts`
- [ ] Cambiar import en `app/api/admin/products/[id]/variants/route.ts`
- [ ] Cambiar import en `app/api/admin/products/[id]/variants/route-new.ts`
- [ ] Probar que las funciones de stock funcionen correctamente
