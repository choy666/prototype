# TODO: Modificar sección de Variantes en Editar Producto

## Tareas a realizar:

### 1. Quitar función "Mostrar Imágenes Disponibles"
- Eliminar el botón "Mostrar Imágenes Disponibles" en `components/admin/ProductVariants.tsx`
- Eliminar el estado `showImageSuggestions`
- Eliminar la lógica de mostrar/ocultar imágenes disponibles
- Eliminar la grilla de imágenes disponibles

### 2. Cambiar estilo de agregar imagen en variantes
- Cambiar el campo de imagen de string a array de strings (images: string[]) para permitir múltiples imágenes
- Reemplazar el input simple de URL y la lógica de sugerencias por el componente `ImageReorder`
- Adaptar `ImageReorder` para que funcione con múltiples imágenes opcionales en variantes
- Asegurar que el estilo sea consistente con la sección de Nuevo Producto
- Agregar visualización minimalista debajo de las imágenes correspondientes

### 3. Actualizar interfaces y tipos
- Cambiar `ProductVariant` interface: `image?: string` a `images?: string[]`
- Actualizar `formData` en ProductVariants: `image: ''` a `images: []`
- Ajustar handlers para agregar/remover imágenes en arrays

### 4. Actualizar imports y dependencias
- Verificar que `ImageReorder` esté importado en `ProductVariants.tsx`
- Ajustar lógica de fetch y PUT para manejar arrays de imágenes

### 5. Pruebas
- Verificar que la funcionalidad de agregar múltiples imágenes funcione correctamente
- Asegurar que no haya errores en la consola
- Probar la UI en diferentes tamaños de pantalla
- Verificar visualización minimalista de imágenes
