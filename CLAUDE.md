# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (tsx server + vite)
- `npm run build` - Build for production (vite + esbuild bundle)
- `npm start` - Run production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes with Drizzle

### Database Management
- `npx drizzle-kit generate` - Generate database migrations
- `npx drizzle-kit migrate` - Run database migrations
- `npx drizzle-kit studio` - Open Drizzle Studio for database inspection

## Architecture Overview

### Full-Stack TypeScript Application
This is a Point of Sale (POS) system for Pastelaria 24h with distinct frontend and backend architectures:

**Frontend (client/):**
- React 18 + TypeScript + Vite
- TailwindCSS with shadcn/ui components
- TanStack Query for server state
- Wouter for routing
- React Hook Form + Zod validation

**Backend (server/):**
- Node.js + Express with TypeScript
- Passport.js authentication (local strategy)
- Express sessions with PostgreSQL store
- Drizzle ORM with Neon PostgreSQL

**Shared Code (shared/):**
- Zod schemas for validation
- TypeScript types exported from Drizzle

### Key Directories
- `client/src/components/` - UI components organized by domain (admin/, employee/, ui/)
- `client/src/pages/` - Main application pages
- `client/src/hooks/` - Custom React hooks for auth and mobile detection
- `server/` - Backend API routes and authentication
- `shared/schema.ts` - Database schema and validation schemas

### Database Schema
Complex business logic with security features:
- **Shift Management**: Cash inheritance between shifts, automatic product transfer
- **Security Features**: Shift signatures, cash adjustments audit trail, timeline logging
- **Business Logic**: Product inventory tracking, payment method breakdown, weekly payroll

### Authentication & Authorization
- Role-based access (admin/employee)
- Session-based authentication
- Protected routes with user context

### Business Domain Logic

**Employee Functions:**
- Shift opening/closing with cash reconciliation
- Product inventory management (entry, arrival, sales, waste)
- Multi-payment method support (cash, PIX, card terminals)
- Collaborative shift management

**Admin Functions:**
- Real-time dashboard with charts and alerts
- Product and user CRUD operations
- Transport management system
- Weekly payroll calculations
- Cash divergence monitoring

### Development Patterns
- Shared TypeScript types between frontend/backend
- Zod schemas for runtime validation
- React Query for server state management
- Responsive design with mobile-first approach
- Real-time updates for admin monitoring

### Environment Setup
- Requires `DATABASE_URL` environment variable for Neon PostgreSQL
- Development uses tsx for TypeScript execution
- Production builds with esbuild for server bundling
- Deployed on Vercel with serverless architecture