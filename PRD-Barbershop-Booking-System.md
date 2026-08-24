# Product Requirements Document (PRD)
# Men's Barbershop Booking & Management System

**Version:** 1.0 (MVP)
**Date:** August 2026
**System Type:** Responsive Web Application (Single-Tenant / Single Salon)

---

## 1. Overview

A web-based system for managing a single men's barbershop, allowing customers to book appointments online with a specific barber for one or more services, while giving the salon owner a comprehensive dashboard to manage barbers, services, bookings, and work schedules — with real-time notifications whenever a booking changes.

### 1.1 Problem Statement
- Manually managing bookings (by phone/WhatsApp) is time-consuming and error-prone for the salon owner.
- Customers lack visibility into available time slots, causing conflicts or unnecessary waiting.
- No organized record of each barber's performance, services, or pricing.

### 1.2 Language & Direction
- The system's primary and only language: **Arabic**.
- The entire interface direction: **RTL** (Right-to-Left).
- Time format used everywhere in the system: **12-hour format** (AM/PM) — e.g., `10:30 AM`, `06:00 PM`.

> Note: While this PRD document itself is written in English for the development team/tooling, the actual product UI, content, and all user-facing text must be in Arabic with full RTL layout, as specified above.

---

## 2. User Roles

| Role | Description | Access Method |
|---|---|---|
| **Salon Owner (Admin)** | The single user with full administrative control: adds/manages barbers, services, monitors bookings, cancels them, sets work schedules, and marks no-show customers. | Login (Username/Password) |
| **Barber (Staff)** | **Does not have an independent login account.** Their data (name, services, prices, work schedule) is fully managed by the salon owner through the admin dashboard. | No direct login |
| **Customer** | Creates a simple account (username + phone number, no OTP), browses barbers and services, books appointments, edits/cancels their own bookings, and joins waitlists. | Simplified registration (no password/OTP) |

---

## 3. Core Features — MVP Scope (Version 1)

### 3.1 Public Page (Before Login)
- A page displaying the **list of services and prices** offered by the salon (accessible without login).
- **Does not** include an "About Us" page or general salon info/photos in this version.

### 3.2 Customer Account Registration
- Simple registration form: **username + phone number** only.
- No OTP verification and no complex password.
- Later login via phone number/username.

### 3.3 Barber Management (from the Salon Owner's Dashboard)
- Add/edit/delete a barber (name, optional photo, active/inactive status).
- Each barber has:
  - **Their own list of services** (not salon-wide) — added by the salon owner on the barber's behalf.
  - **An independent work schedule**: working days, start/end times per day, and days off (each barber's schedule is fully independent from the others).

### 3.4 Service Management (per Barber)
For each service, the following is defined:
- Service name (e.g., haircut, beard trim, hair coloring, etc.).
- Price.
- **Duration** (expected start and end time, e.g., 30 minutes) — used to automatically calculate available time slots in the calendar.
- Editable or deletable at any time by the salon owner.

### 3.5 Booking Flow (Customer-Facing)
1. Customer selects a **barber**.
2. Selects **one or more services** offered by that barber — the system automatically calculates the **total duration** and total price.
3. An **available time slot calendar** is displayed, based on:
   - The barber's work schedule.
   - Existing bookings.
   - The total duration required for the selected services.
4. Booking is only allowed **up to one week in advance** from today's date (no bookings beyond one week ahead).
5. Once a time slot is selected and confirmed: **the booking is automatically confirmed immediately** (no salon owner approval required).

### 3.6 Booking Cancellation / Modification
- **By the Customer:** Can cancel or modify their booking **at any time before the appointment** (no minimum time restriction).
- **By the Salon Owner:** Has the authority to cancel any booking at any time (from the dashboard).
- On any cancellation (by either party): an **instant notification** is sent to the other party.

### 3.7 Marking Bookings as "No-show"
- The salon owner can manually mark any completed/past booking as **"No-show"** from the dashboard (for record-keeping and reporting purposes only in this version — no automatic blocking).

### 3.8 Waitlist
- If a customer's desired time slot with a specific barber is booked, they can join a waitlist for that specific time/barber.
- When a cancellation occurs for that slot: an **instant notification** is sent to all customers on that waitlist simultaneously.
- **Priority mechanism:** "First to book, gets it" (best-effort, first-come-first-served) — there is no guaranteed queue order or automatic booking; all waitlisted customers are notified at the same time and whoever books first secures the slot.

### 3.9 Real-time Notifications
All notifications are **in-app only** in this version (no SMS or WhatsApp).

**Salon Owner Notifications:**
- New booking.
- Booking cancellation (by customer).

**Customer Notifications:**
- Their booking was cancelled (by the salon owner).
- A previously unavailable time slot they were waiting for has opened up (Waitlist).

> **Technical Note:** These notifications are built using **Cloudflare Durable Objects** to provide a live connection (WebSocket-based) instead of relying on polling, ensuring true real-time delivery and better resource efficiency. While current expected usage volume doesn't strictly require this, it is a design choice that ensures professional-grade performance and future scalability.

### 3.10 Salon Owner Admin Dashboard
- **Work schedule and time-off management** for each barber independently.
- **View all bookings** (daily/weekly calendar), filterable by barber/date/status.
- **Simple reports and statistics:**
  - Number of bookings (daily/weekly).
  - Expected revenue (based on prices of booked services; payment is cash, not processed through the system).
  - Most requested services.
  - Number of no-show occurrences per customer/barber.

### 3.11 Payment
- **No electronic payment is included in the system.** Payment is made **in cash** only, upon the customer's arrival at the salon. The system does not process any financial transactions.

---

## 4. Out of Scope / Future Enhancements

The following features were discussed but deferred to a later phase:

| Feature | Reason |
|---|---|
| Loyalty points / discount program | Requires detailed mechanism design later |
| WhatsApp/SMS notifications | Additional cost (WhatsApp Business API / SMS Gateway) |
| Electronic payment | Salon currently relies on cash payment only |
| Mobile app (iOS/Android) | Version 1 is web-only |
| Multi-branch support | System is designed for a single location only |
| Independent barber login accounts | Fully managed via the salon owner's account |
| Public "About Us" page | Limited to services/pricing page only |
| Automatic no-show blocking | Manual marking only in this version |
| Time restriction on booking cancellation | Not required — cancellation always allowed before the appointment |

---

## 5. Non-Functional Requirements

- **Language/Direction:** Fully Arabic, RTL across all pages and components (including calendar, tables, notifications).
- **Time Format:** 12-hour (AM/PM) everywhere a time is displayed (bookings, work schedules, reports).
- **Responsiveness:** Fully responsive design (mobile-first), since most customers are expected to book from mobile devices.
- **Performance:** Fast loading via Edge network (Cloudflare), instant notification delivery via Durable Objects.
- **Security:** Protection of customer data (name and phone number); strict access control (only the salon owner can access the admin dashboard).
- **Future Scalability:** Architecture that allows adding (multiple branches, electronic payment, mobile app, WhatsApp notifications) without major re-architecture.

---

## 6. Proposed Technical Stack

> A technical appendix intended for project implementation via Claude Code, based on project requirements (relatively simple system, single salon, limited data and request volume).

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js (React) via `@cloudflare/next-on-pages` + Tailwind CSS | Supports RTL easily, runs natively on Cloudflare Pages |
| **Backend / API** | Cloudflare Workers + Hono Framework | Lightweight and fast, purpose-built for Edge computing |
| **Real-time / Notifications** | Cloudflare **Durable Objects** | Live connection alternative to polling, ensures true real-time delivery and resource efficiency |
| **Database** | Cloudflare **D1** (Edge SQLite) | Fully sufficient for a single salon's data volume (barbers, services, bookings, customers) |
| **Future File Storage (images)** | Cloudflare **R2** | Not needed in v1, ready for future use for barber/service photos |
| **Hosting** | Cloudflare **Pages** | Initial URL format `salon-name.pages.dev`, with the option to connect a custom domain later |
| **Authentication** | Simple session/cookie for the salon owner account + lightweight token for customer account | No OTP, no complex password for customers |

### 6.1 Preliminary Data Model (Simplified)

```
Owner (Salon Owner)
 └── Barbers [1-N]
       ├── Services [1-N] { name, price, duration_minutes }
       ├── WorkSchedule [1-N] { day_of_week, start_time, end_time, is_day_off }
       └── Bookings [1-N]

Customers
 └── Bookings [1-N]
       ├── status: confirmed | cancelled | completed | no_show
       ├── services: [Service, Service, ...] (N-N relation)
       ├── start_time, end_time (calculated from sum of service durations)
       └── created_at

WaitlistEntries
 ├── customer_id
 ├── barber_id
 ├── requested_time_slot
 └── status: waiting | notified | fulfilled

Notifications
 ├── recipient_type: owner | customer
 ├── type: new_booking | cancellation | waitlist_available
 ├── is_read
 └── created_at
```

---

## 7. Key User Stories

1. **As a salon owner**, I want to add a new barber and define their services and work schedule, so they immediately become available for booking.
2. **As a customer**, I want to select a specific barber and multiple services in one appointment, so I can see the total price and duration before confirming.
3. **As a customer**, I want to cancel my booking at any time before the appointment without restrictions, since my circumstances may change.
4. **As a salon owner**, I want to receive an instant notification for any new booking or cancellation, so I can track my day accurately without manually refreshing the page.
5. **As a customer**, I want to join a waitlist when my desired time slot is booked, so I get a chance to book it if someone cancels.
6. **As a salon owner**, I want to see a simple report on the number of bookings and expected revenue, so I can evaluate the salon's performance weekly.

---

## 8. Success Metrics

- Percentage of completed bookings out of total bookings (Completed vs. Cancelled/No-show).
- Average number of daily bookings one month after launch.
- Waitlist-to-booking conversion rate.
- Salon owner's satisfaction with the accuracy and speed of real-time notifications.

---

## 9. Decision Log

| Decision | Final Choice |
|---|---|
| System type | Single Salon (Single-Tenant) |
| Barber accounts | None; fully managed by the salon owner |
| Customer registration | Username + phone number, no OTP |
| Booking confirmation | Automatic and instant (no prior approval) |
| Customer cancellation/modification | Always available, no time restriction |
| Waitlist | Instant notification + "first to book, gets it" |
| Notifications | In-app only, via Durable Objects |
| Payment | Cash only, outside the system's scope |
| Advance booking window | One week only |
| Barber work schedules | Independent per barber |
| Platform | Responsive web only |
| Hosting | Cloudflare Pages + Workers + D1 |

---

*End of Document*
