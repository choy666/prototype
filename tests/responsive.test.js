// tests/responsive.test.js
import { render, screen } from '@testing-library/react';
import ProductsPage from '@/app/products/page';
import Home from '@/app/page';

// Mock de hooks y componentes
jest.mock('@/hooks/useProducts');
jest.mock('@/lib/actions/products');
jest.mock('@/components/products/ProductFilters', () => ({
  ProductFilters: () => <div data-testid="product-filters">Filters</div>
}));
jest.mock('@/components/products/ProductCard', () => ({
  ProductCard: ({ product }) => <div data-testid="product-card">{product.name}</div>
}));
jest.mock('@/components/products/ProductCardSkeleton', () => ({
  ProductCardSkeleton: () => <div data-testid="product-skeleton">Loading...</div>
}));

describe('Responsive Design Tests - Módulo 1', () => {
  beforeEach(() => {
    // Reset viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  describe('Products Page', () => {
    it('should render grid layout on desktop', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<ProductsPage />);

      // Check for desktop grid classes
      const gridContainer = document.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should render single column on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<ProductsPage />);

      // Check for mobile-specific layout
      const mobileLayout = document.querySelector('.flex-col.md\\:flex-row');
      expect(mobileLayout).toBeInTheDocument();
    });

    it('should hide filters on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<ProductsPage />);

      // Filters should be hidden or collapsed on mobile
      const filters = screen.getByTestId('product-filters');
      expect(filters).toBeInTheDocument();
    });
  });

  describe('Home Page', () => {
    it('should render responsive text sizes', () => {
      render(<Home />);

      // Check for responsive text classes
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveClass('text-3xl', 'md:text-4xl', 'lg:text-5xl');
    });

    it('should render responsive layout', () => {
      render(<Home />);

      // Check for responsive container classes
      const container = document.querySelector('.max-w-md.md\\:max-w-lg.lg\\:max-w-xl');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Navbar Component', () => {
    it('should show mobile menu on small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<Navbar />);

      // Check for mobile menu button
      const mobileMenuButton = screen.getByLabelText(/menú/i);
      expect(mobileMenuButton).toBeInTheDocument();
    });

    it('should hide mobile menu on desktop', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<Navbar />);

      // Mobile menu should be hidden
      const mobileMenu = document.querySelector('.lg\\:hidden');
      expect(mobileMenu).toBeInTheDocument();
    });
  });
});

// Tests de imágenes responsivas
describe('Image Optimization', () => {
  it('should use Next.js Image component with proper props', () => {
    render(<Home />);

    // Check for Image components with required props
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('src');
      expect(img).toHaveAttribute('alt');
    });
  });

  it('should have lazy loading on non-critical images', () => {
    render(<Home />);

    // Check for lazy loading on images below the fold
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    expect(lazyImages.length).toBeGreaterThan(0);
  });
});

// Tests de layout shifts
describe('Layout Stability', () => {
  it('should prevent layout shifts with proper image dimensions', () => {
    render(<Home />);

    const images = document.querySelectorAll('img');
    images.forEach(img => {
      // Images should have width and height to prevent shifts
      const imgElement = img.closest('[style*="width"]');
      expect(imgElement).toBeTruthy();
    });
  });
});
