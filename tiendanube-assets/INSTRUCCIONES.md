# Guía de Instalación - Frontend Personalizado para Tiendanube

## 📋 Requisitos Previos

- Plan de Tiendanube que permita edición de código (Plan Professional o Superior)
- Acceso administrativo a la tienda
- Los archivos CSS y HTML preparados

## 🎯 Paso a Paso para Aplicar el Diseño Personalizado

### 1. Acceder al Editor de Código

1. Inicia sesión en tu panel de Tiendanube
2. Ve a **Mi Tienda** > **Diseño**
3. Haz clic en **Personalizar diseño actual**
4. Busca y haz clic en **Editar código** (solo visible en planes que lo permiten)

### 2. Aplicar el CSS Personalizado

**Opción A: Archivo CSS externo**

1. En el editor de código, navega a `static/css/`
2. Crea un nuevo archivo llamado `custom-styles.css`
3. Copia y pega todo el contenido de `tiendanube-assets/css/custom-styles.css`
4. Guarda el archivo

**Opción B: CSS inline (recomendado para mayor compatibilidad)**

1. Abre el archivo `layout.tpl` en la raíz
2. Justo antes de `</head>`, agrega:

```html
<style>
  /* Pega aquí todo el CSS de custom-styles.css */
</style>
```

### 3. Personalizar la Página de Inicio

1. Abre el archivo `home.tpl`
2. Reemplaza todo su contenido con el HTML personalizado
3. **IMPORTANTE**: Usa la sintaxis correcta de Liquid para Tiendanube:

### 4. Sintaxis Liquid Correcta para Tiendanube

#### Productos Destacados

```liquid
{% assign featured_products = products | where: 'featured', true %}
{% if featured_products.size > 0 %}
  {% for product in featured_products %}
    {{ product.name }}
    {{ product.price | money }}
  {% endfor %}
{% endif %}
```

#### Imágenes de Productos

```liquid
{% if product.images.size > 0 %}
  <img src="{{ product.images.first | img_url: 'large' }}"
       alt="{{ product.name }}">
{% endif %}
```

#### Precios con Descuento

```liquid
{% if product.compare_at_price > product.price %}
  <span class="price-original">{{ product.compare_at_price | money }}</span>
  <span class="price-discount">{{ product.price | money }}</span>
{% else %}
  <span>{{ product.price | money }}</span>
{% endif %}
```

#### URL del Store

```liquid
{{ store.url }}
```

#### Carrito

```liquid
{{ cart.items_count }}
```

### 5. HTML Corregido para Tiendanube

Reemplaza el contenido de `home.tpl` con:

```html
<!-- Header personalizado -->
<header class="header-container">
  <nav class="nav-container">
    <div class="nav-logo">
      <a href="{{ store.url }}">
        <img src="{{ settings.logo | img_url: 'original' }}" alt="{{ store.name }}" />
      </a>
    </div>

    <ul class="nav-menu">
      <li><a href="{{ store.url }}">Inicio</a></li>
      <li><a href="{{ store.url }}/products">Productos</a></li>
      <li><a href="{{ store.url }}/pages/nosotros">Nosotros</a></li>
      <li><a href="{{ store.url }}/pages/envios">Envíos</a></li>
    </ul>

    <div class="nav-actions">
      {% if customer %}
      <a href="{{ store.url }}/account" class="btn btn-secondary">Mi Cuenta</a>
      {% else %}
      <a href="{{ store.url }}/login" class="btn btn-secondary">Iniciar Sesión</a>
      <a href="{{ store.url }}/register" class="btn btn-secondary">Registrarse</a>
      {% endif %}
      <a href="{{ store.url }}/cart" class="btn btn-primary"> Carrito ({{ cart.items_count }}) </a>
    </div>
  </nav>
</header>

<!-- Hero Section -->
<section class="hero-section">
  <h1 class="hero-title">{{ store.name }}</h1>
  <p class="hero-subtitle">
    {{ store.description | default: 'La mejor selección de productos de calidad.' }}
  </p>
  <div class="hero-actions">
    <a href="{{ store.url }}/products" class="btn btn-primary">Ver Productos</a>
    <a href="{{ store.url }}/pages/contacto" class="btn btn-secondary">Contacto</a>
  </div>
</section>

<!-- Productos Destacados -->
{% assign featured_products = products | where: 'featured', true %} {% if featured_products.size > 0
%}
<section class="featured-section">
  <h2 class="section-title">Destacados</h2>

  <div class="featured-grid">
    <!-- Producto principal -->
    {% assign main_product = featured_products.first %}
    <div class="featured-main">
      <a href="{{ main_product.url }}" class="featured-item">
        {% if main_product.images.size > 0 %}
        <img
          src="{{ main_product.images.first | img_url: 'large' }}"
          alt="{{ main_product.name }}"
          class="featured-image"
        />
        {% endif %} {% if main_product.compare_at_price > main_product.price %} {% assign discount =
        main_product.compare_at_price | minus: main_product.price %} {% assign discount_percent =
        discount | times: 100 | divided_by: main_product.compare_at_price %}
        <span class="discount-badge">-{{ discount_percent }}%</span>
        {% endif %}

        <div class="featured-overlay">
          <h3 class="featured-title">{{ main_product.name }}</h3>
          <p class="featured-price">
            {% if main_product.compare_at_price > main_product.price %}
            <span class="price-original">{{ main_product.compare_at_price | money }}</span>
            <span class="price-discount">{{ main_product.price | money }}</span>
            {% else %}
            <span>{{ main_product.price | money }}</span>
            {% endif %}
          </p>
        </div>
      </a>
    </div>

    <!-- Productos secundarios -->
    <div class="featured-side">
      {% for product in featured_products offset: 1 limit: 2 %}
      <div class="featured-item">
        <a href="{{ product.url }}" class="featured-item">
          {% if product.images.size > 0 %}
          <img
            src="{{ product.images.first | img_url: 'medium' }}"
            alt="{{ product.name }}"
            class="featured-image"
          />
          {% endif %} {% if product.compare_at_price > product.price %} {% assign discount =
          product.compare_at_price | minus: product.price %} {% assign discount_percent = discount |
          times: 100 | divided_by: product.compare_at_price %}
          <span class="discount-badge">-{{ discount_percent }}%</span>
          {% endif %}

          <div class="featured-overlay">
            <h3 class="featured-title">{{ product.name }}</h3>
            <p class="featured-price">
              {% if product.compare_at_price > product.price %}
              <span class="price-original">{{ product.compare_at_price | money }}</span>
              <span class="price-discount">{{ product.price | money }}</span>
              {% else %}
              <span>{{ product.price | money }}</span>
              {% endif %}
            </p>
          </div>
        </a>
      </div>
      {% endfor %}
    </div>
  </div>
</section>
{% endif %}

<!-- Más Productos -->
{% if products.size > 0 %}
<section class="products-section">
  <h2 class="section-title">Más productos</h2>

  <div class="products-slider">
    {% for product in products limit: 8 %}
    <div class="product-card">
      <a href="{{ product.url }}">
        {% if product.images.size > 0 %}
        <img
          src="{{ product.images.first | img_url: 'medium' }}"
          alt="{{ product.name }}"
          class="product-image"
        />
        {% endif %}

        <div class="product-info">
          <h3 class="product-name">{{ product.name }}</h3>
          <p class="product-price">
            {% if product.compare_at_price > product.price %}
            <span class="price-original">{{ product.compare_at_price | money }}</span>
            <span class="price-discount">{{ product.price | money }}</span>
            {% else %}
            <span>{{ product.price | money }}</span>
            {% endif %}
          </p>
        </div>
      </a>
    </div>
    {% endfor %}
  </div>
</section>
{% endif %}

<!-- Newsletter -->
<section class="newsletter-section">
  <h2 class="section-title">Newsletter</h2>
  <p>Registrate y recibí nuestras ofertas.</p>

  <form class="newsletter-form" action="{{ store.url }}/newsletter" method="post">
    <input
      type="email"
      name="email"
      class="newsletter-input"
      placeholder="Tu correo electrónico"
      required
    />
    <button type="submit" class="newsletter-button">Suscribirse</button>
  </form>
</section>

<!-- Footer personalizado -->
<footer class="footer">
  <div class="footer-content">
    <div class="footer-section">
      <h3>{{ store.name }}</h3>
      <p>La mejor selección de productos de calidad para todos los gustos y necesidades.</p>
    </div>

    <div class="footer-section">
      <h3>Enlaces rápidos</h3>
      <ul class="footer-links">
        <li><a href="{{ store.url }}">Inicio</a></li>
        <li><a href="{{ store.url }}/products">Productos</a></li>
        <li><a href="{{ store.url }}/pages/nosotros">Nosotros</a></li>
        <li><a href="{{ store.url }}/pages/contacto">Contacto</a></li>
      </ul>
    </div>

    <div class="footer-section">
      <h3>Contacto</h3>
      <ul class="footer-links">
        <li><a href="mailto:{{ store.email }}">{{ store.email }}</a></li>
        <li><a href="tel:{{ store.phone }}">{{ store.phone }}</a></li>
        <li>{{ store.address }}</li>
      </ul>
    </div>

    <div class="footer-section">
      <h3>Legal</h3>
      <ul class="footer-links">
        <li><a href="{{ store.url }}/pages/terminos">Términos y condiciones</a></li>
        <li><a href="{{ store.url }}/pages/privacidad">Política de privacidad</a></li>
        <li><a href="{{ store.url }}/pages/devoluciones">Devoluciones</a></li>
      </ul>
    </div>
  </div>

  <div class="footer-bottom">
    <p>&copy; {{ 'now' | date: '%Y' }} {{ store.name }}. Todos los derechos reservados.</p>
    <p>
      <a
        href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
        target="_blank"
      >
        Defensa del Consumidor
      </a>
      <a href="{{ store.url }}/pages/arrepentimiento">Botón de arrepentimiento</a>
    </p>
  </div>
</footer>

<!-- Scripts personalizados -->
<script>
  // Animaciones y mejoras interactivas
  document.addEventListener('DOMContentLoaded', function () {
    // Smooth scroll para enlaces internos
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Animación de hover en productos
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach((card) => {
      card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-4px)';
      });
      card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
      });
    });

    // Validación del newsletter
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', function (e) {
        const email = this.querySelector('input[type="email"]').value;
        if (!email || !email.includes('@')) {
          e.preventDefault();
          alert('Por favor, ingresa un correo electrónico válido');
        }
      });
    }
  });
</script>
```

### 6. Configurar Productos como Destacados

1. Ve a **Productos** en el panel
2. Selecciona los productos que quieres destacar
3. Edita cada producto y marca la opción **"Destacado"** o **"Featured"**
4. Guarda los cambios

### 7. Personalizar Logo y Colores

1. En **Diseño** > **Personalizar diseño actual**
2. Ve a la sección **"Identidad de marca"**
3. Sube tu logo y ajusta los colores principales
4. Los colores configurados aquí sobrescribirán los del CSS

## ⚠️ Limitaciones y Consideraciones

### Límites de Archivos

- CSS: Máximo 250KB si se usa archivo externo
- JavaScript: Restricciones de seguridad (no eval(), no acceso a ciertas APIs)
- Imágenes: Máximo 10MB por imagen

### Restricciones de JavaScript

- No se puede usar `eval()` o `Function()`
- No acceso a cookies de terceros
- Algunos eventos pueden ser bloqueados por CSP
- Se recomienda usar JavaScript vanilla, no frameworks

### Mejores Prácticas

1. **Prueba en modo vista previa** antes de publicar
2. **Guarda copias de seguridad** de los archivos originales
3. **Usa CSS responsive** para asegurar compatibilidad móvil
4. **Optimiza imágenes** antes de subirlas
5. **Testea todas las funcionalidades** (carrito, checkout, etc.)

## 🔧 Solución de Problemas Comunes

### CSS no se aplica

- Verifica que el CSS esté correctamente vinculado
- Revisa la sintaxis Liquid en los selectores
- Limpia la caché del navegador

### Productos no aparecen

- Asegúrate de que los productos estén marcados como "Destacados"
- Verifica que haya stock disponible
- Revisa la sintaxis Liquid en el loop

### Errores de JavaScript

- Revisa la consola del navegador
- Verifica las restricciones de seguridad
- Usa try-catch para manejar errores

## 📞 Soporte

Si necesitas ayuda adicional:

1. Consulta la documentación oficial de Tiendanube
2. Contacta al soporte de Tiendanube
3. Revisa foros y comunidades de desarrolladores

---

**Nota**: Esta guía asume que tienes un plan de Tiendanube que permite edición de código. Si no tienes acceso a "Editar código", considera actualizar tu plan o contactar a soporte.
