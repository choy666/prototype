# Tarea: Corroborar precios en carrusel del inicio con descuentos

## Información Recopilada:
- HeroSlider muestra productos sin considerar descuentos
- DiscountBadge y getDiscountedPrice existen y se usan en ProductCard
- Product tiene campos price y discount

## Plan Aprobado:
- Editar components/ui/HeroSlider.tsx para reutilizar lógica existente
- Agregar imports: DiscountBadge, getDiscountedPrice, formatPrice
- Calcular hasDiscount y finalPrice por producto
- Mostrar badge si hay descuento
- Mostrar precio tachado + precio final si hay descuento

## Pasos a Completar:
- [ ] Agregar imports necesarios en HeroSlider.tsx
- [ ] Calcular hasDiscount y finalPrice en el map de productos
- [ ] Agregar DiscountBadge posicionado sobre la imagen
- [ ] Modificar sección de precio: precio original tachado + precio final si descuento
- [ ] Verificar cambios visualmente en la página de inicio
