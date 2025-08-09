# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

**Development:**
- `npm run dev` - Start development server with hot-reload on port 5000 (Express + Vite middleware mode)
- `npm run check` - Run TypeScript type checking (no build output)

**Build & Production:**
- `npm run build` - Build both client and server for production
- `npm run build:client` - Build only the React frontend with Vite (output to `dist/public`)
- `npm run build:server` - Build only the Express backend with esbuild (output to `dist/index.js`)
- `npm run start` - Start production server (requires build first)

**Docker & Deployment:**
- `docker build -t pastel24h .` - Build production Docker image (includes automatic database migration)
- `docker-compose up` - Start containerized application
- Vercel serverless deployment via `/api/index.js` endpoint

**Database:**
- `npm run db:generate` - Generate new database migrations with Drizzle Kit from schema changes
- `npm run db:migrate` - Run pending database migrations (required on first run)

## Architecture Overview

This is a full-stack web application for restaurant shift management built with:

**Backend (Express.js):**
- SQLite database with Drizzle ORM for type-safe queries
- Passport.js authentication with local strategy and sessions
- RESTful API with role-based access control (admin/employee)
- Database schema shared between client and server via `shared/schema.ts`

**Frontend (React + Vite):**
- React with TypeScript and Wouter for routing
- TanStack Query for server state management
- Shadcn/ui components with Tailwind CSS and Framer Motion animations
- Comprehensive UI library: Radix UI components, Recharts for data visualization
- Export capabilities: PDF generation (jsPDF) and Excel export (xlsx)
- Mobile-first responsive design with advanced navigation
- Role-based protected routes and authentication context

**Key Directories:**
- `server/` - Express backend with authentication, routes, and database logic
- `client/src/` - React frontend application
- `client/src/lib/` - Business logic utilities (calculations, constants, apiClient)
- `client/src/components/` - UI components organized by feature (admin/, employee/, ui/)
- `client/src/pages/` - Page components with route definitions
- `shared/` - Shared TypeScript schemas and types between client and server
- `data/` - SQLite database file location (local.db)
- `migrations/` - Drizzle database migration files
- `api/` - Serverless deployment configuration (Vercel)

## Database Structure

The application manages restaurant operations through interconnected tables:
- **Users**: Employee/admin accounts with roles and transport configuration
- **Shifts**: Work periods with cash tracking, payments, and status management
- **Products**: Inventory items with categories and pricing
- **Shift Records**: Product quantities and sales during shifts
- **Transport Modes**: Employee transportation options with pricing
- **Weekly Reports**: Payroll calculations and employee hours
- **Timeline**: Activity logging for audit trails
- **Corrections**: Administrative corrections for closed shifts (quantities, payments, cash counts)
- **Cash Adjustments**: Cash withdrawal and adjustment records

## Development Notes

**Environment Setup:**
- Requires `.env` file with `SESSION_SECRET` for session security
- Database location: `./data/local.db` (SQLite)
- Development mode uses Vite middleware for frontend hot-reload (middlewareMode: true)
- TypeScript path aliases configured: `@/*` for client, `@shared/*` for shared modules
- Cross-platform environment variable support via cross-env
- Port 5000 used for both development and production servers

**Authentication Flow:**
- Passport local strategy with bcrypt password hashing (12 rounds)
- Session-based authentication with role-based access control
- Protected routes enforce authentication and admin privileges
- API client must include `credentials: 'include'` for session cookies

**Payment Processing:**
- Multiple payment methods: cash, PIX, Stone card/voucher, PagBank
- Configurable transaction rates for each payment type
- Real-time cash divergence tracking and adjustments

**State Management:**
- Server state via TanStack Query with optimistic updates
- Authentication context provides user state across components
- Toast notifications for user feedback
- API client in `/client/src/lib/apiClient.ts` handles credentials

**Business Logic:**
- Complex inventory calculations engine in `client/src/lib/calculations.ts`
- Comprehensive business constants and rules in `client/src/lib/constants.ts`
- Advanced cash divergence tracking and payment method handling
- Automated report generation with PDF and Excel export capabilities

## API Architecture

**Authentication Routes (`/api`):**
- `POST /api/register` - Create new user account
- `POST /api/login` - Authenticate user with email/password
- `POST /api/logout` - End user session
- `GET /api/user` - Get current authenticated user

**Main Application Routes (`/api`):**
- Products, shifts, users, transport modes, weekly reports
- All routes require authentication except public endpoints
- Admin routes require admin role for access
- Administrative corrections: `/api/admin/shifts/:id/corrections`
- Shift details with corrections: `/api/admin/shift-details/:id`

**Middleware Stack:**
- Session management with express-session and memorystore
- Passport.js for authentication strategies
- Role-based access control middleware (requireAuth, requireAdmin)
- Request validation using Zod schemas with enhanced error handling
- CORS configuration for production deployment
- Health check endpoints for monitoring (`/api/health`)

## Initial Setup

**First-time setup requires:**
1. Create `.env` file with `SESSION_SECRET` (use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate)
2. Run `npm install` to install all dependencies
3. Run `npm run db:migrate` to create database tables (required - application will exit with error if not run)
4. Start development with `npm run dev`

## Critical Implementation Patterns

**Database Queries with Relations:**
When fetching data that includes related entities, ALWAYS use Drizzle's query builder with `with` clause:
```typescript
// CORRECT - includes related data
const result = await db.query.shifts.findFirst({
  where: eq(shifts.id, shiftId),
  with: { user: true, records: true }
});

// INCORRECT - missing relations causes frontend crashes
const result = await db.select().from(shifts).where(eq(shifts.id, shiftId));
```

**Frontend Data Access Safety:**
Always use optional chaining when accessing nested properties:
```typescript
// SAFE - handles undefined gracefully
<span>{shift?.user?.name ?? 'Not found'}</span>

// UNSAFE - causes "Cannot read properties of undefined" errors
<span>{shift.user.name}</span>
```

**API Client Usage:**
Always use the centralized apiClient for fetch operations:
```typescript
// CORRECT - uses apiClient with credentials
import { api } from '@/lib/apiClient';
const data = await api.get('/api/endpoint');

// INCORRECT - direct fetch without credentials
const data = await fetch('/api/endpoint').then(res => res.json());
```

**Route Parameters with Wouter:**
Use `useRoute` hook for dynamic route parameters:
```typescript
// CORRECT - useRoute for dynamic params
import { useRoute } from 'wouter';
const [match, params] = useRoute('/admin/shifts/:id/corrections');
const shiftId = params?.id;

// INCORRECT - useParams doesn't work with wouter
import { useParams } from 'wouter'; // This doesn't exist in wouter
```

## Testing & Quality Checks

**Before committing code:**
- Run `npm run check` to verify TypeScript types
- Test authentication flows with both admin and employee roles
- Verify database migrations with `npm run db:migrate`
- Check API endpoints return proper status codes and error messages
- Ensure no sensitive data in commits (passwords are hashed with bcrypt, rounds=12)
- Verify all database queries include necessary relations when frontend expects nested data

## Deployment Options

**Docker Containerization:**
- Multi-stage Docker build with optimization for production
- Database migrations run automatically during container startup
- Docker Compose configuration available for local development

**Serverless Deployment:**
- Vercel-compatible serverless functions via `/api/index.js`
- Automatic scaling and edge distribution support
- Environment-specific configuration for production deployments