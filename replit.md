# TechRepair - Appliance Repair Shop Management System

## Overview

TechRepair is a web-based management system for appliance repair shops (oficina de eletrodomésticos). The application provides a complete workflow for managing customers, appliances, and service orders with features including:

- Customer registration and management
- Appliance tracking per customer
- Service order creation with unified flow
- Status tracking throughout the repair process
- Thermal printing support for receipts and labels
- Public tracking page for customers to check order status
- WhatsApp integration for sharing order information
- Dashboard with statistics and charts

The system is designed for technicians and shop owners with a clean, modern interface that works on desktop, tablet, and mobile devices. All UI is in Brazilian Portuguese.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with HMR support
- **Animations**: Framer Motion for page transitions
- **Charts**: Recharts for dashboard visualizations

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts`
- **Authentication**: Local username/password with bcrypt, session-based with Passport.js
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **Authorization**: Role-based access control (RBAC) with ADMIN, ATENDENTE, TECNICO roles

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Managed via drizzle-kit with `db:push` command

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (shadcn/ui)
│   ├── hooks/           # Custom React hooks for data fetching
│   ├── pages/           # Page components
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── routes.ts        # API route handlers
│   ├── storage.ts       # Database operations
│   └── replit_integrations/auth/  # Authentication setup
├── shared/              # Shared code between client/server
│   ├── schema.ts        # Drizzle database schema
│   ├── routes.ts        # API route definitions with Zod validation
│   └── models/          # Shared type definitions
└── migrations/          # Database migrations
```

### Key Design Patterns
- **Shared Route Definitions**: API routes are defined once in `shared/routes.ts` with Zod schemas for input validation and response types
- **Type Safety**: Full TypeScript coverage with shared types between frontend and backend
- **Component Library**: shadcn/ui components provide consistent, accessible UI elements
- **Data Fetching Hooks**: Custom hooks in `client/src/hooks/` wrap React Query for each entity type

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication & Authorization
- **Local Auth**: Username/password authentication with bcrypt password hashing
- **RBAC Roles**:
  - `ADMIN`: Full access to all features + user management
  - `ATENDENTE`: Create OS, manage customers, update status, finalize orders, print
  - `TECNICO`: Edit technical fields (diagnosis, budget), update repair status
- **Default Credentials**: `admin` / `admin123` (created on first run)
- **User Management**: Admin-only page at `/users` for creating/disabling users
- **Required Environment Variables**:
  - `DATABASE_URL` - PostgreSQL connection string
  - `SESSION_SECRET` - Express session encryption key

### Third-Party Services
- **WhatsApp**: Share functionality via wa.me links (no API integration, uses deep links)

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `@tanstack/react-query` - Server state management
- `@radix-ui/*` - Accessible UI primitives
- `zod` - Runtime type validation
- `date-fns` - Date formatting (Brazilian Portuguese locale)
- `recharts` - Dashboard charts
- `framer-motion` - Animations
- `passport` / `openid-client` - Authentication