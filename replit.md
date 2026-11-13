# MailFlow - Professional Email Marketing Platform

## Overview

MailFlow is a full-stack email marketing application that enables users to send single and bulk emails using their own SMTP credentials. The platform features user authentication, email logging, admin dashboard for user management, and configurable SMTP settings per user.

**Core Functionality:**
- User registration and authentication with session-based auth
- Single email sending with custom subject/message
- Bulk email campaigns to multiple recipients
- SMTP configuration per user (supports Gmail and other providers)
- Email delivery tracking and logging
- Admin panel for user management and system analytics

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** Zustand for global app state
- **Data Fetching:** TanStack React Query for server state
- **UI Components:** shadcn/ui component library built on Radix UI primitives
- **Styling:** Tailwind CSS v4 with CSS variables for theming
- **Build Tool:** Vite with custom plugins for Replit integration

**Key Design Decisions:**
- Client-side rendering approach (no SSR) for simplicity
- Component-based architecture with separation of pages and reusable UI components
- Custom API client class (`client/src/lib/api.ts`) wrapping fetch for type-safe API calls
- Path aliases configured (`@/` for client source, `@shared/` for shared code)

### Backend Architecture
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript with ES modules
- **Session Management:** express-session with in-memory storage (production should use connect-pg-simple)
- **Password Hashing:** bcryptjs for secure password storage
- **Email Delivery:** Nodemailer with user-configured SMTP settings

**API Structure:**
- `/api/auth/*` - Authentication endpoints (signup, login, logout, me)
- `/api/email/*` - Email sending endpoints (single, bulk)
- `/api/smtp/*` - SMTP configuration endpoints
- `/api/admin/*` - Admin-only endpoints for user and log management

**Key Design Decisions:**
- Session-based authentication (not JWT) for simpler state management
- Each user stores their own SMTP credentials in the database
- Email logs stored for tracking delivery status
- Middleware-based route protection for authenticated and admin routes

### Data Storage
- **Database:** PostgreSQL via Drizzle ORM
- **Schema Location:** `shared/schema.ts` (shared between client and server)
- **Migrations:** Drizzle Kit with `drizzle-kit push` for schema sync

**Database Tables:**
1. `users` - User accounts with SMTP credentials, role, status, email count
2. `email_logs` - Email delivery history with status tracking

**Key Design Decisions:**
- UUID primary keys using PostgreSQL's `gen_random_uuid()`
- SMTP credentials stored per-user (password stored in plain text - consider encryption for production)
- Soft status tracking for users (active/inactive) rather than hard deletes

### Authentication Flow
1. User signs up with name, email, password
2. Password hashed with bcryptjs before storage
3. Session created on login, stored server-side
4. Session ID sent to client as HTTP-only cookie
5. Protected routes check session middleware
6. Admin routes additionally verify user role

## External Dependencies

### Third-Party Services
- **Email Delivery:** User-provided SMTP servers (Gmail, custom SMTP)
  - Configuration: Host, port, username, password stored per user
  - Default setup: Gmail SMTP on port 587

### Key NPM Packages
- **Database:** `drizzle-orm`, `pg` (node-postgres)
- **Email:** `nodemailer`
- **Validation:** `zod`, `drizzle-zod`
- **UI:** Full shadcn/ui component suite with Radix UI primitives
- **Charts:** Recharts for admin analytics
- **Date Handling:** date-fns

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Secret for session encryption (optional, has default)

### Build & Development
- Development: `npm run dev` starts Express server with Vite middleware for HMR
- Production: `npm run build` bundles client with Vite, server with esbuild
- Database: `npm run db:push` syncs schema to database