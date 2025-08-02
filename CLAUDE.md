# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

**Development:**
- `npm run dev` - Start development server with hot-reload on port 5000
- `npm run check` - Run TypeScript type checking

**Build & Production:**
- `npm run build` - Build both client and server for production
- `npm run build:client` - Build only the React frontend with Vite
- `npm run build:server` - Build only the Express backend with esbuild
- `npm run start` - Start production server (requires build first)

**Database:**
- `npm run db:generate` - Generate new database migrations with Drizzle Kit
- `npm run db:migrate` - Run pending database migrations

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
- Shadcn/ui components with Tailwind CSS
- Role-based protected routes and authentication context

**Key Directories:**
- `server/` - Express backend with authentication, routes, and database logic
- `client/src/` - React frontend application
- `shared/` - Shared TypeScript schemas and types
- `data/` - SQLite database file location
- `migrations/` - Drizzle database migration files

## Database Structure

The application manages restaurant operations through interconnected tables:
- **Users**: Employee/admin accounts with roles and transport configuration
- **Shifts**: Work periods with cash tracking, payments, and status management
- **Products**: Inventory items with categories and pricing
- **Shift Records**: Product quantities and sales during shifts
- **Transport Modes**: Employee transportation options with pricing
- **Weekly Reports**: Payroll calculations and employee hours
- **Timeline**: Activity logging for audit trails

## Development Notes

**Environment Setup:**
- Requires `.env` file with `SESSION_SECRET` for session security
- Database auto-initializes on first migration run
- Development mode uses Vite middleware for frontend hot-reload

**Authentication Flow:**
- Passport local strategy with bcrypt password hashing
- Session-based authentication with role-based access control
- Protected routes enforce authentication and admin privileges

**Payment Processing:**
- Multiple payment methods: cash, PIX, Stone card/voucher, PagBank
- Configurable transaction rates for each payment type
- Real-time cash divergence tracking and adjustments

**State Management:**
- Server state via TanStack Query with optimistic updates
- Authentication context provides user state across components
- Toast notifications for user feedback