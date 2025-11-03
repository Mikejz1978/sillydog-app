# SillyDog Pooper Scooper Services - Design Guidelines

## Design Approach

**Hybrid Approach**: Professional utility design system with playful brand personality overlay. Drawing from Material Design principles for data-heavy components and forms, while infusing the SillyDog brand's fun, approachable character through custom visual elements and interactions.

**Key Design Principle**: Business-critical functionality wrapped in a warm, friendly aesthetic that makes managing a pet service business feel less corporate and more connected to the joy of caring for dogs.

## Typography System

**Primary Font (Headers/Display)**: Fredoka
- H1: 2.5rem (40px), weight 600
- H2: 2rem (32px), weight 600
- H3: 1.5rem (24px), weight 600
- H4: 1.25rem (20px), weight 500

**Secondary Font (Body/Data)**: Open Sans
- Body Large: 1rem (16px), weight 400
- Body Regular: 0.875rem (14px), weight 400
- Body Small: 0.75rem (12px), weight 400
- Labels/Caps: 0.75rem (12px), weight 600, uppercase, letter-spacing 0.5px

**Data Display**: Open Sans for tables, invoices, and financial information to ensure clarity and scannability.

## Layout & Spacing System

**Core Spacing Units**: Tailwind units 2, 4, 6, 8, 12, 16
- Tight spacing (within components): p-2, gap-2
- Standard spacing (between elements): p-4, gap-4, mb-6
- Section spacing: p-8, py-12, gap-8
- Large spacing (between major sections): py-16, mb-16

**Container Strategy**:
- Admin Dashboard: max-w-7xl with full-width data tables
- Customer Portal: max-w-6xl for comfortable reading
- Forms: max-w-2xl centered for focused data entry
- Maps/Route View: Full-width with side panel (w-80 or w-96)

**Grid Systems**:
- Dashboard Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Customer List: Single column with expandable rows
- Route Stops: Single column timeline on mobile, map + list on desktop

## Visual Identity & Branding

**Brand Gradient**: Linear gradient from #2196F3 (Blue) to #1DBF73 (Green)
- Use in: Headers, primary buttons, progress indicators, success states
- Application: bg-gradient-to-r from-[#2196F3] to-[#1DBF73]

**Paw Print Motif**:
- Subtle watermark background pattern in login screens
- Small decorative elements in empty states ("No routes today! 🐾")
- Corner accents in success messages and completion screens
- Animated paw print loader for async operations

**Logo Placement**:
- Top-left of navigation bar: "SillyDog Pooper Scooper" with small paw icon
- Login screen: Large centered logo with gradient text treatment

## Component Library

### Navigation
**Admin App**:
- Persistent left sidebar (w-64) on desktop with icon + label nav items
- Collapsible hamburger menu on mobile
- Active state: gradient background with white text
- Nav items: Dashboard, Customers, Routes, Invoices, Messages, Settings

**Customer Portal**:
- Top horizontal navigation with logo left, account menu right
- Tabs: Dashboard, My Services, Payment History, Account Settings

### Cards & Containers
**Standard Card Pattern**:
- White background with subtle shadow (shadow-md)
- Rounded corners (rounded-xl for major cards, rounded-lg for nested)
- Padding: p-6 for content cards, p-4 for compact lists
- Border: Optional border border-gray-200 for nested sections

**Customer Cards**: Display name, address, service plan, next service date, status badge
**Route Stop Cards**: Time window, customer name, address, gate code (revealed on tap), action buttons
**Invoice Cards**: Invoice number, date, amount, payment status, download button

### Forms & Inputs
**Input Fields**:
- Height: h-12 for comfortable touch targets
- Rounded: rounded-lg
- Border: border-2 border-gray-300, focus:border-blue-500
- Labels: Above input, weight 600, mb-2
- Helper text: text-sm text-gray-600, mt-1

**Button Hierarchy**:
- Primary (CTA): Gradient background, white text, rounded-lg, h-12, px-6, shadow-md, hover:shadow-lg
- Secondary: White background, gradient border (border-2), gradient text, rounded-lg, h-12, px-6
- Destructive: Red background (bg-red-500), white text, same dimensions
- Ghost: Transparent, text only, hover:bg-gray-100

**Form Layouts**:
- Two-column grid on desktop (grid-cols-2 gap-6), single column on mobile
- Full-width for textareas and address fields
- Group related fields with subtle background (bg-gray-50, rounded-lg, p-4)

### Data Display
**Tables**:
- Zebra striping (alternate rows with bg-gray-50)
- Sticky header with gradient background
- Row hover state: bg-blue-50
- Mobile: Convert to stacked cards with key information visible

**Status Badges**:
- Rounded-full, px-3, py-1, text-xs, font-semibold
- Active: bg-green-100 text-green-800
- Pending: bg-yellow-100 text-yellow-800
- Inactive: bg-gray-100 text-gray-800
- Paid: bg-blue-100 text-blue-800
- Overdue: bg-red-100 text-red-800

### Map & Route Components
**Map View**:
- Full-width map container with route polyline in gradient colors
- Custom map markers: Numbered paw prints for stops, house icon for home base
- Side panel (w-96) showing ordered list of stops with estimated times
- Current location indicator: Pulsing blue dot

**Route Actions**:
- Floating action button (bottom-right): Large, circular, gradient background
- States: "Start Route" → "Next Stop" → "Complete Service"
- Timer display in header when route active

### Customer Portal Specifics
**Dashboard Layout**:
- Hero section with next service countdown card (large, centered, gradient border)
- Quick stats: Services this month, current balance, last payment
- Upcoming services timeline
- Recent invoices table (3-5 most recent)

**Payment Interface**:
- Stripe Elements with matching design (rounded inputs, gradient focus states)
- Saved card display with last 4 digits, brand icon, edit/remove options
- Invoice preview before payment with line items clearly displayed

## Animation Guidelines

**Minimal & Purposeful**:
- Page transitions: Simple fade-in (duration-200)
- Card hover: Subtle lift (hover:shadow-lg, transition-shadow)
- Button press: Scale down slightly (active:scale-95)
- Route status changes: Slide-in notification from top
- Loading states: Animated paw print rotation (gentle, not distracting)

**No Animations**:
- Background patterns (static paw prints)
- Table row highlights
- Form validation states (instant feedback)

## Images

**Hero Image**: None - this is a utility application focused on data and functionality

**Decorative Graphics**:
- Login screen: Illustrated scene of happy dogs in a clean yard (top half of screen, gradient overlay at bottom)
- Empty states: Simple line illustrations of dogs with friendly messages
- Success screens: Confetti paw prints animation (brief, celebratory)

**Icons**: Heroicons library via CDN for all interface icons (outline style for navigation, solid for badges)

## Accessibility

- Minimum touch target: 44x44px (h-12 exceeds this)
- Color contrast: All text meets WCAG AA standards (test gradient text on white backgrounds)
- Focus indicators: 2px solid ring with offset (ring-2 ring-offset-2 ring-blue-500)
- Form validation: Icons + text, not color alone
- Screen reader labels for icon-only buttons
- Keyboard navigation throughout (logical tab order, escape to close modals)

## Responsive Behavior

**Breakpoints**:
- Mobile: < 768px (single column, bottom navigation)
- Tablet: 768px - 1024px (two-column grids, side navigation visible)
- Desktop: > 1024px (three-column grids, full feature set)

**Mobile Optimizations**:
- Bottom tab navigation for admin app (Dashboard, Routes, Customers, More)
- Swipe actions on lists (swipe customer card to call/text/edit)
- Collapsible sections in forms
- Map view takes full screen with slide-up panel for route details

This design system creates a professional, efficient business tool that doesn't sacrifice the warm, approachable personality of the SillyDog brand. Every interaction should feel helpful and delightful while maintaining the reliability needed for daily business operations.