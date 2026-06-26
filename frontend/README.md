# TPPC Manufacturing — Frontend

Next.js 15 dashboard for the TPPC Manufacturing & Production Management System. It communicates exclusively with the companion NestJS backend API.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State / data-fetching | TanStack React Query |
| Forms | React Hook Form + Zod |
| PDF export | jspdf + jspdf-autotable |
| Charts | Recharts |

---

## Local Setup

```bash
npm install
```

Copy the sample environment file and fill in your backend URL:

```bash
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Start the dev server:

```bash
npm run dev          # http://localhost:3000
```

Type-check without building:

```bash
npx tsc --noEmit
```

---

## Pages and Features

### Authentication
- `/login` — email + password login; JWT stored in an HTTP-only cookie via the backend.

### Dashboard (`/`)
- Summary cards: open production orders, pending tasks, low-stock inventory.
- Quick links to active production work.

### Production Orders (`/production-orders`)
- List of all production orders with status and priority indicators.
- Per-order detail page (`/production-orders/[id]`) with a full stage pipeline.

Every stage dialog shows a live **Auto-Computed Stage Total (₦)** — unit cost × quantity — before saving.

| Stage | What you configure |
|---|---|
| **Paper Selection** | Paper type, source-sheet size, cost per sheet, cut size, quantity of sheets taken |
| **Cutting** | Cut size, requested cuts — auto-computes max cut-outs per sheet, cost per cut, bag-sheet count, paper cost |
| **Artwork / Design** | Vendor/designer, number of designs, design names, design status |
| **CTP Making** | Vendor, CTP machine, number of plates, cost per plate |
| **Printing** | Vendor, print machine, impressions, cost per impression |
| **Die Cutting** | Vendor, diecut size, pieces to diecut — auto-resolves cost from workbook tiers |
| **Lamination** | Vendor, type (Gloss/Matte), size — auto-resolves gloss/matte cost |
| **Finishing** | Finished item, cost per finish, quantity, bag base size (auto-resolves bag base cost), twisted handles count (auto-computes ₦65/handle), wastage breakdown |
| **Packaging** | Item packaged, quantity, cost per packaging |

Dedicated sub-pages:
- `/production-orders/[id]/paper-selection` — expanded paper + cutting planner.
- `/production-orders/[id]/finishing` — finishing + factory labour entry.

### Tasks (`/tasks`)
- Filtered task list by stage, status, priority, and assigned staff.
- Downstream task start is gated on actual released cutting/paper quantity.
- Supports `PENDING`, `IN_PROGRESS`, `PARTIALLY_COMPLETE`, and `COMPLETE` stage statuses.

### Inventory (`/inventory`)
- Stock list with SKU, item name, quantity in stock, and category.
- Paper inventory items automatically populate production-rules cost suggestions.

### Reports (`/reports`)
- Tabbed reports: Production Summary, Inventory, Worker Efficiency, Labour Cost.
- Download each report as **CSV**, **Excel (.xls)**, or **PDF**.

### Factory Activity (`/factory-activity`)
- Log daily factory worker output: location, supervisor, worker names, quantity allocated/finished, cost per finish.
- Factory labour totals feed into the production order cost roll-up.

### Staff Management (`/users`)
- Full staff directory (up to 200 staff shown in a single load).
- Create, edit, and delete staff; assign roles and factory location.
- **CSV Import** — import multiple staff at once via the Import button:
  - Download a pre-filled template from the import dialog.
  - Required columns: `staffId`, `fullName`, `role`, `jobTitle`, `department`, `reportingLine`, `locationName`.
  - Optional columns: `email` (auto-generated from name if omitted), `phoneNumber` (normalised to `0XXXXXXXXXX`).
  - Set a default password in the dialog — users change it after first login.
  - The import uses upsert-by-staffId so it is safe to re-run.

### Settings (`/settings`)
- **Roles & Permissions** — view and update per-role permission sets.
- **Locations** — manage factory locations.
- **Machinery** — manage machines linked to production stages.
- **Vendors** — manage vendors linked to production stages.
- **Zoho Books** — OAuth connection and sync configuration.

### Help (`/help`)
- In-app documentation covering production stages, roles, tasks, and notifications.

---

## User Roles

| Role constant | Display name | Primary access |
|---|---|---|
| `ADMINISTRATOR` | Administrator | Full access — always bypasses permission checks |
| `GENERAL_MANAGER` | General Manager | Full operational access |
| `PRODUCTION_MANAGER` | Production Manager | Production orders, tasks, reports |
| `HEAD_OF_OPERATIONS` | Head of Operations | Operations, tasks, reports |
| `SUPERVISOR` | Supervisor | Tasks, factory activity |
| `ACCOUNTANT` | Accountant | Reports, inventory |
| `LOGISTICS_TEAM` | Logistics Team | Inventory, production orders |
| `DESIGN_TEAM` | Design Team | Artwork / design stage |
| `HUMAN_RESOURCES` | Human Resources | Staff directory |
| `CUSTOMER_CARE` | Customer Care | Sales orders, customer view |
| `FACTORY_WORKER` | Factory Workers | Finishing / factory activity |

---

## Staff CSV Import — Column Reference

| Column | Required | Notes |
|---|---|---|
| `staffId` | Yes | Unique staff identifier, e.g. `STF-001` |
| `fullName` | Yes | First and last name |
| `email` | No | Auto-generated from name if omitted |
| `role` | Yes | One of the role constants above (case-insensitive) |
| `jobTitle` | Yes | Free-text job title |
| `department` | Yes | Department name |
| `phoneNumber` | No | Normalised to `0XXXXXXXXXX` format |
| `reportingLine` | Yes | Name of reporting manager |
| `locationName` | Yes | Must match an existing location name |

Download a ready-to-use template from **Users → Import Staff → Download Template**.

---

## Known Baseline Audit Issues

These exist in upstream dependencies and cannot be resolved without breaking framework changes:

| Package | Severity | Resolution path |
|---|---|---|
| `postcss` (via `next`) | Moderate | Requires `npm audit fix --force` which downgrades Next.js — not viable |

Do not introduce new vulnerabilities above this baseline.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
