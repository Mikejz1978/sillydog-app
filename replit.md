# SillyDog Pooper Scooper Services - Business Management Platform

## Overview
This project is a comprehensive web-based business management platform designed for SillyDog Pooper Scooper Services. Its primary purpose is to automate and streamline daily operations, including customer management, route scheduling, invoicing, payment processing, and customer communication via automated SMS notifications. The platform aims to enhance efficiency for Michael and his staff, providing tools for managing customer relationships, optimizing service routes, handling financial transactions, and enabling automated client communication.

## User Preferences
- Professional, business-focused UI with friendly SillyDog personality
- Fun, approachable branding (paw print icon as logo substitute)
- Clean, modern design following Material Design principles
- Mobile-responsive for field technicians

## System Architecture

### Tech Stack
-   **Frontend**: React + TypeScript, Wouter routing, TailwindCSS + Shadcn UI
-   **Backend**: Express.js + TypeScript
-   **State Management**: TanStack Query v5 for server state

### Key Features
-   **Customer Management**: Comprehensive CRM with service plans, dog counts, gate codes, yard notes, SMS opt-in, and autopay settings.
-   **Route Scheduling**: Daily route planning with manual ordering, status tracking (scheduled → in route → completed), and "Find Best Fit" for optimal service days via geocoding.
-   **Recurring Service Scheduling**: Automated weekly/biweekly scheduling with flexible service types, multi-day support, automatic route generation, and next visit display.
-   **CSV Import**: Functionality to import customers and schedules from CSV (e.g., HouseCall Pro) with duplicate detection.
-   **Text Messaging Portal**: Two-way SMS communication interface with customer list, conversation view, and message history.
-   **Automated Notifications**: "In Route," "Service Complete," night-before reminders, and booking notifications via SMS.
-   **Invoicing & Billing**: Auto-calculated invoices based on service plans and dog counts, timer-based billing for one-time services, automatic monthly billing, and autopay system.
-   **Customer Portal**: Allows clients to view service details, upcoming routes, payment history, and outstanding balances.
-   **Public Booking Page**: Customer-facing interface for new service requests with rate-limiting and admin notification system. When a booking is accepted, a customer is automatically created and added to the customer list.
-   **Service Catalog (Price Book)**: Manages service types with flexible pricing (base price + per-dog pricing).
-   **Job Documentation**: Photo upload system for before/after photos during service completion.
-   **Reporting**: Generates reports with CSV exports for revenue, jobs, and invoices.

### Design System
-   **Primary Colors**: Teal (#00BCD4) to Orange (#FF6F00) gradient matching the SillyDog logo, with Yellow (#FFC107) accents.
-   **Typography**: Fredoka for headers/display, Open Sans for body/data.
-   **Components**: Shadcn UI with hover-elevate interactions.
-   **Responsiveness**: Mobile-first design supporting iOS, Android, and desktop browsers.

## External Dependencies
-   **Database**: Neon PostgreSQL (for persistent data storage)
-   **Payments**: Stripe API (for payment intents, processing, and autopay)
-   **SMS**: Twilio API (for automated customer notifications and two-way messaging)
-   **Geocoding**: Google Maps Geocoding API (for address-to-coordinates conversion and route optimization suggestions)