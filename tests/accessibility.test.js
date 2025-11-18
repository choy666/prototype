// tests/accessibility.test.js
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

// Componentes a testear
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';

describe('Accessibility Tests - Módulo 1', () => {
  describe('Button Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Button>Click me</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA attributes when disabled', async () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Input Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Input placeholder="Enter text" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support aria-describedby for error messages', async () => {
      const { container } = render(
        <>
          <Input aria-describedby="error-message" />
          <div id="error-message">Error: Field required</div>
        </>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Navbar Component', () => {
    it('should have proper navigation structure', async () => {
      const { container } = render(<Navbar />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have accessible mobile menu', async () => {
      // Test mobile menu accessibility
      const { container } = render(<Navbar />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Footer Component', () => {
    it('should have accessible social links', async () => {
      const { container } = render(<Footer />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

// Tests de navegación por teclado
describe('Keyboard Navigation', () => {
  it('should allow tab navigation through interactive elements', () => {
    const { container } = render(<Navbar />);
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements.length).toBeGreaterThan(0);
  });
});

// Tests de responsive design
describe('Responsive Design', () => {
  it('should render mobile layout correctly', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { container } = render(<Navbar />);
    // Check for mobile-specific classes or elements
    const mobileMenu = container.querySelector('[data-mobile-menu]');
    expect(mobileMenu).toBeInTheDocument();
  });
});
