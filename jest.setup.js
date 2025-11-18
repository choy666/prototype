import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Mock de Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock de next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signOut: jest.fn(),
  signIn: jest.fn(),
}));

// Mock de Zustand
jest.mock('zustand', () => ({
  create: jest.fn(() => jest.fn()),
}));

// Mock de componentes que requieren configuración especial
jest.mock('@/lib/actions/products', () => ({
  getFeaturedProducts: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/lib/actions/auth', () => ({
  auth: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/hooks/useProducts', () => ({
  useProducts: jest.fn(() => ({
    products: [],
    isLoading: false,
    error: null,
    pagination: { page: 1, totalPages: 1, total: 0 },
    updateFilters: jest.fn(),
    filters: {},
    refresh: jest.fn(),
  })),
}));

jest.mock('@/lib/stores/useCartStore', () => ({
  useCartStore: jest.fn(() => 0),
  selectTotalItems: jest.fn(() => 0),
}));
