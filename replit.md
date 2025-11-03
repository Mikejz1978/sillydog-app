# SillyDog Pooper Scooper Services - Business Management Platform

## Overview
A comprehensive web-based business management application for SillyDog Pooper Scooper Services. This platform automates customer management, route scheduling, invoicing, payment processing, and automated SMS notifications for a pet waste removal business.

## Purpose
Streamline daily operations for Michael and staff by providing:
- **Admin Dashboard**: Manage customers, schedule routes, generate invoices, track payments
- **Customer Portal**: Allow clients to view services, upcoming appointments, and payment history
- **Automated SMS**: Send "In Route" and "Service Complete" notifications via Twilio
- **Payment Processing**: Accept payments online through Stripe integration

## Recent Changes (November 3, 2025)

### Phase 1 - MVP Launch
- **Initial MVP Launch**: Complete full-stack implementation
- **Schema Design**: Customers, routes, invoices, job history with TypeScript types
- **Frontend Components**: Dashboard, CRM, route scheduler, invoice manager, customer portal, settings
- **Backend API**: Full CRUD operations for all entities
- **Integrations**: Stripe for payments, Twilio for SMS notifications
- **Design System**: SillyDog branding with blue-to-green gradient (#2196F3 → #1DBF73), Fredoka + Open Sans fonts
- **Bug Fixes**: TanStack Query cache invalidation for routes, removed emoji usage per design guidelines

### Phase 2 - Enhanced Features
- **PostgreSQL Migration**: Migrated from in-memory storage to persistent Neon PostgreSQL database
- **Photo Upload System**: Before/after photo capture for job documentation with base64 storage
- **Route Optimization**: Alphabetical route sorting with "Optimize Routes" button (foundation for future geocoding)
- **Reporting & Analytics**: New reports page with CSV exports for revenue, jobs, and invoices with date filtering
- **Server-side Validation**: Enhanced photo upload endpoint with MIME type and size validation
- **Text Messaging Portal**: Two-way SMS communication interface with customer list, conversation view, and message history

## Project Architecture

### Tech Stack
- **Frontend**: React + TypeScript, Wouter routing, TailwindCSS + Shadcn UI
- **Backend**: Express.js + TypeScript
- **Data**: In-memory storage (MemStorage) for rapid prototyping
- **Payments**: Stripe API for payment intents and processing
- **SMS**: Twilio API for automated customer notifications
- **State Management**: TanStack Query v5 for server state

### Data Models
1. **Customers**: Name, address, phone, email, service plan (weekly/biweekly/one-time), number of dogs, gate codes, yard notes, billing method, status
2. **Routes**: Date, customer, scheduled time, status (scheduled/in_route/completed), order index
3. **Invoices**: Customer, invoice number, amount, status (unpaid/paid/overdue), due date, Stripe payment intent ID
4. **Job History**: Customer, route, service date, duration, before/after photos (base64), SMS notification tracking
5. **Messages**: Customer, direction (inbound/outbound), message text, status, timestamp

### API Endpoints
- `GET/POST /api/customers` - Customer CRUD
- `GET/POST /api/routes` - Route scheduling
- `PATCH /api/routes/:id/status` - Update route status (triggers SMS)
- `POST /api/routes/optimize` - Optimize route order
- `GET/POST /api/invoices` - Invoice management
- `POST /api/create-payment-intent` - Stripe payment initialization
- `POST /api/invoices/:id/pay` - Mark invoice paid
- `GET/POST /api/job-history` - Service history tracking
- `POST /api/job-history/:id/photos` - Upload before/after photos
- `GET /api/messages` - Get all messages or filter by customer
- `POST /api/messages/send` - Send SMS to customer via Twilio

### Key Features
1. **Customer Management**: Full CRM with service plans, dog counts, gate codes, yard notes
2. **Route Scheduling**: Daily route planning with manual ordering, status tracking (scheduled → in route → completed)
3. **Text Messaging Portal**: 
   - Two-column interface: customer list + conversation view
   - Send SMS messages directly to customers via Twilio
   - Message history with inbound/outbound tracking
   - Real-time conversation updates
4. **Automated Notifications**: 
   - "In Route" SMS when technician starts driving
   - "Service Complete" SMS when job finished
   - Invoice notifications and payment confirmations
5. **Invoicing**: Auto-calculate prices based on service plan + dog count, track payment status
6. **Customer Portal**: View service details, upcoming routes, payment history, outstanding balance
7. **Pricing Calculator**: Built-in rate tables for weekly/biweekly/one-time services (1-8 dogs)

### Design System
- **Primary Colors**: Blue (#2196F3) to Green (#1DBF73) gradient for branding
- **Typography**: 
  - Headers/Display: Fredoka (600 weight for headers)
  - Body/Data: Open Sans (400-600 weights)
- **Components**: Shadcn UI with hover-elevate interactions
- **Spacing**: Consistent 4/6/8/12/16 spacing units
- **Responsive**: Mobile-first design, works on iOS/Android/desktop browsers

## Environment Variables
Required secrets (configured via Replit Secrets):
- `STRIPE_SECRET_KEY` - Stripe API secret key (sk_...)
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key (pk_...)
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Twilio phone number (+1234567890)

## Development Workflow
1. **Start Development**: `npm run dev` (already configured workflow)
2. **Frontend**: Vite dev server with HMR at http://localhost:5000
3. **Backend**: Express API at http://localhost:5000/api
4. **Storage**: PostgreSQL (Neon) - data persists across restarts
5. **Database Push**: `npm run db:push` to sync schema changes

## User Preferences
- Professional, business-focused UI with friendly SillyDog personality
- Fun, approachable branding (paw print icon as logo substitute)
- Clean, modern design following Material Design principles
- Mobile-responsive for field technicians

## Future Enhancements (Phase 3+)
- Enhanced route optimization with real geocoding API and proximity algorithms
- PDF export generation for reports
- Visual revenue trend charts (Recharts integration)
- Timer tracking for first-time cleanups with auto-billing
- Payment reminders and automated recurring billing schedules
- GPS tracking per employee
- Customer ratings & testimonials
- Map visualization with route paths

## Project Status
**Current Phase**: Phase 2 Complete ✓ + Text Messaging Portal
- PostgreSQL database for persistent data storage
- Photo upload system for service documentation
- Route optimization functionality
- Reports page with CSV exports for revenue, jobs, and invoices
- **NEW: Text messaging portal for direct customer communication**
- All core features implemented and functional
- Stripe payment integration ready
- Twilio SMS notifications operational
- Beautiful, responsive UI with SillyDog branding and professional logo
- Ready for production deployment

## Notes
- This is a web-based solution accessible on any device (iOS, Android, desktop)
- No native iOS app - runs in browser (can be added to home screen as PWA)
- PostgreSQL database via Neon provides persistent data storage
- Photos stored as base64 in database (max 5MB each, validated server-side)
- Twilio SMS gracefully degrades if credentials unavailable (logs to console)
- Route optimization uses simple alphabetical sorting (placeholder for future geocoding API)
