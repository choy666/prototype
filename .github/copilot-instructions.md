# Copilot Instructions for Mi Tienda E-commerce

Welcome to the Mi Tienda codebase! This document provides essential guidelines for AI coding agents to be productive in this project. It covers the architecture, workflows, conventions, and integration points specific to this e-commerce platform.

## Project Overview

Mi Tienda is a modern e-commerce platform built with:
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Drizzle ORM, PostgreSQL (Neon)
- **Integrations**: Mercado Pago (payments), Mercado Libre OAuth (authentication)

Key features include:
- Product catalog with filters and search
- Shopping cart with global state management
- User authentication (traditional + OAuth)
- Payment processing and order management
- Responsive design with light/dark themes

## Architecture

### Directory Structure
- `app/`: Next.js pages and routes
  - `(auth)/`: Authentication-related routes (e.g., login, register)
  - `(protected)/`: Protected routes (e.g., dashboard, payment status)
  - `api/`: API routes for authentication, checkout, order status, and webhooks
- `components/`: Reusable React components
  - `ui/`: UI components (e.g., buttons, cards, navbar)
  - `cart/`: Shopping cart components
  - `products/`: Product-related components
- `lib/`: Utilities and configurations
  - `actions/`: Server actions (e.g., auth, products)
  - `auth/`: Authentication logic
  - `db.ts`: Database connection
  - `schema.ts`: Database schemas
  - `utils/`: Helper functions (e.g., cookies, formatting, logging)
- `scripts/`: Utility scripts (e.g., backups, testing)
- `hooks/`: Custom React hooks
- `types/`: TypeScript type definitions

### Data Flow
- **Frontend**: State management via Zustand and React Query
- **Backend**: API routes handle business logic, database interactions, and external integrations
- **Database**: PostgreSQL with Drizzle ORM for schema management and migrations

### Key Integrations
- **Mercado Pago**: Payment processing
- **Mercado Libre OAuth**: Social authentication

## Developer Workflows

### Setup
1. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd mi-tienda
   npm install
   ```
2. Configure environment variables in `.env.local` (see `README.md` for details).
3. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### Testing
- Run all tests:
  ```bash
  npm run test
  ```
- Security tests:
  ```bash
  node security-tests.js
  ```
- CSRF tests:
  ```bash
  node csrf-tests.js
  ```

### Database Management
- Generate migrations:
  ```bash
  npm run db:generate
  ```
- Apply migrations:
  ```bash
  npm run db:push
  ```
- Backup database:
  ```bash
  npm run db:backup
  ```
- Restore database:
  ```bash
  npm run db:restore
  ```

### Deployment
- Recommended: Deploy to Vercel. Ensure environment variables are configured.

## Project-Specific Conventions

### Code Style
- Follow ESLint and Prettier rules. Run:
  ```bash
  npm run lint
  npm run lint:fix
  ```
- Use TypeScript for strict typing.

### Component Patterns
- **UI Components**: Located in `components/ui/`, designed to be reusable and theme-aware.
- **Server Actions**: Encapsulated in `lib/actions/` for modularity.
- **Custom Hooks**: Defined in `hooks/` to abstract reusable logic.

### API Design
- Use Next.js API routes for backend logic.
- Follow RESTful principles where applicable.
- Handle authentication via NextAuth.js.

### Error Handling
- Use `components/ui/error-boundary.tsx` for global error boundaries.
- Log errors using `lib/utils/logger.ts`.

## Examples

### Adding a New API Route
1. Create a new folder in `app/api/` (e.g., `app/api/new-feature/`).
2. Define the route handler in `route.ts`:
   ```typescript
   import { NextApiRequest, NextApiResponse } from 'next';

   export default function handler(req: NextApiRequest, res: NextApiResponse) {
     if (req.method === 'GET') {
       res.status(200).json({ message: 'Hello, world!' });
     } else {
       res.status(405).json({ error: 'Method not allowed' });
     }
   }
   ```

### Adding a New Component
1. Create the component in the appropriate folder under `components/`.
2. Follow the existing patterns for props and styling.
3. Export the component and use it in the relevant page or feature.

---

For further details, refer to the `README.md` or contact the development team.