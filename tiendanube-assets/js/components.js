// Tiendanube Custom Components
// Componentes React embebidos para mejorar la experiencia

(function() {
  'use strict';

  // Utilidades
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  
  // Cache de componentes
  const components = new Map();

  // Componente: Galería de imágenes mejorada
  class ProductGallery {
    constructor(container) {
      this.container = container;
      this.images = [];
      this.currentIndex = 0;
      this.init();
    }

    init() {
      // Buscar imágenes del producto
      const productImages = $$('.product-image img, .product-gallery img');
      if (productImages.length === 0) return;

      this.images = Array.from(productImages).map(img => ({
        src: img.src,
        alt: img.alt || '',
        thumb: img.src.replace('/large/', '/medium/')
      }));

      this.createGallery();
      this.bindEvents();
    }

    createGallery() {
      // Crear contenedor de galería
      const galleryHTML = `
        <div class="tn-gallery">
          <div class="tn-gallery-main">
            <img src="${this.images[0]?.src || ''}" alt="" class="tn-gallery-image">
            <button class="tn-gallery-prev" aria-label="Anterior">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button class="tn-gallery-next" aria-label="Siguiente">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
          <div class="tn-gallery-thumbs">
            ${this.images.map((img, i) => `
              <button class="tn-gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}">
                <img src="${img.thumb}" alt="${img.alt}">
              </button>
            `).join('')}
          </div>
        </div>
      `;

      // Insertar después del contenedor original
      this.container.insertAdjacentHTML('afterend', galleryHTML);
      this.galleryElement = this.container.nextElementSibling;
    }

    bindEvents() {
      const prevBtn = this.galleryElement.querySelector('.tn-gallery-prev');
      const nextBtn = this.galleryElement.querySelector('.tn-gallery-next');
      const thumbs = this.galleryElement.querySelectorAll('.tn-gallery-thumb');

      prevBtn?.addEventListener('click', () => this.prev());
      nextBtn?.addEventListener('click', () => this.next());
      
      thumbs.forEach(thumb => {
        thumb.addEventListener('click', (e) => {
          this.goTo(parseInt(e.currentTarget.dataset.index));
        });
      });

      // Navegación con teclado
      this.galleryElement.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === 'ArrowRight') this.next();
      });
    }

    prev() {
      if (this.currentIndex > 0) {
        this.goTo(this.currentIndex - 1);
      }
    }

    next() {
      if (this.currentIndex < this.images.length - 1) {
        this.goTo(this.currentIndex + 1);
      }
    }

    goTo(index) {
      this.currentIndex = index;
      const mainImage = this.galleryElement.querySelector('.tn-gallery-image');
      const thumbs = this.galleryElement.querySelectorAll('.tn-gallery-thumb');

      mainImage.src = this.images[index].src;
      mainImage.alt = this.images[index].alt;

      thumbs.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
      });
    }
  }

  // Componente: Quick Add to Cart
  class QuickAdd {
    constructor(button) {
      this.button = button;
      this.productId = button.dataset.productId;
      this.variantId = button.dataset.variantId;
      this.init();
    }

    init() {
      this.createModal();
      this.bindEvents();
    }

    createModal() {
      const modalHTML = `
        <div class="tn-quickadd-modal" id="tn-quickadd-${this.productId}">
          <div class="tn-quickadd-backdrop"></div>
          <div class="tn-quickadd-content">
            <div class="tn-quickadd-header">
              <h3>Agregar al carrito</h3>
              <button class="tn-quickadd-close" aria-label="Cerrar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="tn-quickadd-body">
              <div class="tn-quickadd-quantity">
                <label>Cantidad:</label>
                <div class="tn-quantity-selector">
                  <button class="tn-quantity-minus">-</button>
                  <input type="number" value="1" min="1" max="99" class="tn-quantity-input">
                  <button class="tn-quantity-plus">+</button>
                </div>
              </div>
              <div class="tn-quickadd-variants">
                <!-- Variantes se cargarán dinámicamente -->
              </div>
            </div>
            <div class="tn-quickadd-footer">
              <button class="tn-quickadd-add btn btn-primary">
                <span class="spinner"></span>
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);
      this.modal = document.getElementById(`tn-quickadd-${this.productId}`);
    }

    bindEvents() {
      // Abrir modal
      this.button.addEventListener('click', () => this.open());

      // Cerrar modal
      const closeBtn = this.modal.querySelector('.tn-quickadd-close');
      const backdrop = this.modal.querySelector('.tn-quickadd-backdrop');
      
      closeBtn.addEventListener('click', () => this.close());
      backdrop.addEventListener('click', () => this.close());

      // Selector de cantidad
      const minusBtn = this.modal.querySelector('.tn-quantity-minus');
      const plusBtn = this.modal.querySelector('.tn-quantity-plus');
      const quantityInput = this.modal.querySelector('.tn-quantity-input');

      minusBtn.addEventListener('click', () => {
        if (quantityInput.value > 1) {
          quantityInput.value = parseInt(quantityInput.value) - 1;
        }
      });

      plusBtn.addEventListener('click', () => {
        if (quantityInput.value < 99) {
          quantityInput.value = parseInt(quantityInput.value) + 1;
        }
      });

      // Botón agregar
      const addBtn = this.modal.querySelector('.tn-quickadd-add');
      addBtn.addEventListener('click', () => this.addToCart());
    }

    open() {
      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    close() {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    async addToCart() {
      const addBtn = this.modal.querySelector('.tn-quickadd-add');
      const quantity = parseInt(this.modal.querySelector('.tn-quantity-input').value);
      
      addBtn.classList.add('loading');
      addBtn.disabled = true;

      try {
        // Simular llamada al carrito de Tiendanube
        await this.simulateAddToCart(quantity);
        
        // Mostrar éxito
        this.showSuccess();
        
        // Actualizar contador del carrito
        this.updateCartCount(quantity);
        
        setTimeout(() => this.close(), 1500);
      } catch (error) {
        this.showError();
      } finally {
        addBtn.classList.remove('loading');
        addBtn.disabled = false;
      }
    }

    simulateAddToCart(quantity) {
      return new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }

    showSuccess() {
      const addBtn = this.modal.querySelector('.tn-quickadd-add');
      addBtn.innerHTML = '✓ Agregado';
      addBtn.classList.add('success');
    }

    showError() {
      const addBtn = this.modal.querySelector('.tn-quickadd-add');
      addBtn.innerHTML = '✗ Error';
      addBtn.classList.add('error');
    }

    updateCartCount(quantity) {
      const cartButton = $('.cart-button');
      const cartCount = cartButton?.querySelector('.cart-count');
      
      if (cartCount) {
        const currentCount = parseInt(cartCount.textContent) || 0;
        cartCount.textContent = currentCount + quantity;
        cartCount.classList.add('pulse');
        setTimeout(() => cartCount.classList.remove('pulse'), 500);
      }
    }
  }

  // Componente: Cross-selling
  class CrossSell {
    constructor(container) {
      this.container = container;
      this.productId = container.dataset.productId;
      this.init();
    }

    init() {
      this.loadProducts();
    }

    async loadProducts() {
      try {
        // Simular carga de productos relacionados
        const products = await this.fetchRelatedProducts();
        this.render(products);
      } catch (error) {
        console.error('Error cargando productos relacionados:', error);
      }
    }

    async fetchRelatedProducts() {
      // Aquí se podría llamar a una API real
      return [
        {
          id: 1,
          name: 'Producto Relacionado 1',
          price: 2999,
          image: '/placeholder-product.jpg',
          url: '#'
        },
        {
          id: 2,
          name: 'Producto Relacionado 2',
          price: 3999,
          image: '/placeholder-product.jpg',
          url: '#'
        },
        {
          id: 3,
          name: 'Producto Relacionado 3',
          price: 1999,
          image: '/placeholder-product.jpg',
          url: '#'
        }
      ];
    }

    render(products) {
      const html = `
        <div class="tn-crosssell">
          <h3>Productos que te pueden gustar</h3>
          <div class="tn-crosssell-grid">
            ${products.map(product => `
              <div class="tn-crosssell-item">
                <a href="${product.url}">
                  <img src="${product.image}" alt="${product.name}">
                  <h4>${product.name}</h4>
                  <p class="tn-price">$${product.price.toLocaleString('es-AR')}</p>
                </a>
                <button class="tn-crosssell-add btn btn-outline" data-product-id="${product.id}">
                  Agregar
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      this.container.insertAdjacentHTML('afterend', html);
      this.bindAddButtons();
    }

    bindAddButtons() {
      const addButtons = this.container.parentElement.querySelectorAll('.tn-crosssell-add');
      addButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          // Crear QuickAdd para este producto
          new QuickAdd(e.target);
        });
      });
    }
  }

  // Inicialización de componentes
  function initComponents() {
    // Galería de productos
    const productContainers = $$('.product-images, .product-gallery');
    productContainers.forEach(container => {
      if (!components.has(container)) {
        components.set(container, new ProductGallery(container));
      }
    });

    // Quick Add buttons
    const quickAddButtons = $$('[data-action="quick-add"]');
    quickAddButtons.forEach(button => {
      if (!components.has(button)) {
        components.set(button, new QuickAdd(button));
      }
    });

    // Cross-selling
    const crossSellContainers = $$('[data-cross-sell]');
    crossSellContainers.forEach(container => {
      if (!components.has(container)) {
        components.set(container, new CrossSell(container));
      }
    });
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }

  // Re-inicializar en navegación SPA (si aplica)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(initComponents, 100);
    }
  }).observe(document, { subtree: true, childList: true });

})();
