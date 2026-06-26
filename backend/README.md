# TPPC Manufacturing — Backend

NestJS REST API for the TPPC Manufacturing & Production Management System. Uses PostgreSQL via Prisma ORM.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | NestJS |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) |
| Validation | class-validator + class-transformer |
| Rate limiting | @nestjs/throttler |
| Security headers | Helmet |

---

## Local Setup

```bash
npm install
```

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tppc_manufacturing
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
PORT=4000
```

Generate the Prisma client:

```bash
npx prisma generate
```

Run all pending migrations:

```bash
npx prisma migrate deploy
```

Seed the database with locations and staff:

```bash
npx prisma db seed
```

Start in development mode:

```bash
npm run start:dev
```

Start in production mode:

```bash
npm run start:prod
```

Type-check without building:

```bash
npx tsc --noEmit
```

Run unit tests:

```bash
npm run test
npx jest src/modules/production-orders --runInBand   # production cost-engine tests only
```

---

## Modules

| Module | Base path | Responsibility |
|---|---|---|
| Auth | `/api/auth` | Login, token refresh, register |
| Users | `/api/users` | Staff CRUD, CSV import (`POST /users/import`) |
| Production Orders | `/api/production-orders` | Orders, per-stage operations, cost roll-up, tasks |
| Inventory | `/api/inventory` | Stock items; paper inventory feeds the cost engine |
| Factory Activity | `/api/factory-activity` | Daily worker output and labour costing |
| Machinery | `/api/machinery` | Machine master data, stage-scoped queries |
| Vendors | `/api/vendors` | Vendor master data, stage-scoped queries |
| Location | `/api/locations` | Factory locations |
| Permissions | `/api/permissions` | Role-permission definitions and staff summaries |
| Notifications | `/api/notifications` | In-app notifications |
| Audit Logs | `/api/audit-logs` | Change audit trail |
| Zoho | `/api/zoho` | Zoho Books OAuth and sync |

---

## Production Cost Engine

All workbook-derived pricing rules live in `src/modules/production-orders/production-rules.ts` and are served to the frontend via `GET /api/production-orders/rules`.

### Paper rules
20 paper types with source-sheet size, cost per packet, sheets per packet, and cost per sheet. When a paper inventory item exists, its `averagePrice` overrides the hardcoded defaults.

### Cut-size and cut-cost tiers

| Cut-outs per sheet | Cost per cut (₦) | Cost per diecut (₦) |
|---|---|---|
| 1 – 6 | 7.00 | 15.00 |
| 7 – 16 | 5.00 | 6.00 |
| 17 – 48 | 2.50 | 4.00 |

Cut-out count formula: `floor((L0 / L) × (B0 / B))` where L0×B0 is the source sheet and L×B is the cut size.

### CTP cost (per plate/colour)

| Machine | ₦ per plate |
|---|---|
| Kord | 1,750 |
| MO | 1,750 |
| Sord | 2,000 |
| SM | 5,000 |
| ADAZ | 1,750 |

### Print cost (per impression or colour)

| Machine | ₦ per colour |
|---|---|
| Kord | 2,000 |
| MO | 4,000 |
| Sord | 6,000 |
| SM | 7,500 |
| DI paper print | 350 |
| DI card print | 500 |
| Screenprinting | 60 |
| ADAZ | 2,000 |

### Lamination cost (₦ per sheet — 16 sizes, Gloss and Matte rates)
See `LAMINATION_RULES` in `production-rules.ts` for the full table.

### Finishing cost
Per finished item: paper bags = ₦18, paper boxes = ₦12, snack papers = ₦5, consumables = ₦4.

### Bag base cost
| Size | ₦ per bag |
|---|---|
| Small / Medium | 5 |
| Large | 10 |
| XLarge | 15 |

### Twisted handles
Flat ₦65 per handle. The count recorded on the Finishing operation is multiplied by ₦65 and added to the finishing line total.

### Stage total formula
`total = (costPerUnit + bagBaseCost) × quantity + twistedHandles × 65`

---

## Database Migrations

Migrations live in `prisma/migrations/`. Key migrations:

| Migration | Change |
|---|---|
| `20260403184354_init` | Initial schema |
| `20260411065309_add_cutting_stage` | Cutting stage fields |
| `20260507120405_add_operation_fields_v2` | Extended operation fields |
| `20260515113808_add_factory_worker_activity_and_new_fields` | Factory labour tracking |
| `20260521120000_add_notifications` | Notifications model |
| `20260526160000_add_machinery_and_vendors` | Machinery + vendor tables |
| `20260601143000_add_user_profiles_and_permissions` | User profile fields + permissions |
| `20260603120000_add_missing_role_enum_values` | HUMAN_RESOURCES, CUSTOMER_CARE, FACTORY_WORKER roles |
| `20260604150000_add_user_location_relation` | User → Location relation |
| `20260606120000_add_bag_base_size_to_operation` | `bagBaseSize` field; drop misleading twistedHandles default |

Always run `npx prisma migrate deploy` before starting the server after pulling new code.

---

## Staff CSV Import

`POST /api/users/import` accepts a JSON array of staff rows (parsed from CSV on the frontend). Each row supports:

| Field | Required | Notes |
|---|---|---|
| `staffId` | Yes | Upsert key |
| `fullName` | Yes | Split into firstName + lastName |
| `email` | No | Auto-generated if omitted |
| `role` | Yes | Case-insensitive role enum |
| `jobTitle` | No | |
| `department` | No | |
| `phoneNumber` | No | Normalised to `0XXXXXXXXXX` |
| `reportingLine` | No | |
| `locationName` | No | Resolved to locationId by name lookup |

Default password set by the caller; users change it after first login.

---

## Deployment (Production — `102.223.38.207`)

The CI/CD workflow in `.github/workflows/deploy.yml` runs on push to `main`:

1. `git pull origin main`
2. `npm install`
3. `npx prisma generate`
4. `npx prisma migrate deploy`
5. `npm run build`
6. `pm2 restart TppcBackend`

The process is managed by PM2 and runs the compiled output from `dist/src/main.js`.

---

## Known Baseline Audit Issues

These exist in upstream dev dependencies and cannot be resolved without breaking Prisma:

| Package | Severity | Resolution path |
|---|---|---|
| `@hono/node-server` (via `@prisma/dev`) | Moderate | Requires `npm audit fix --force` which downgrades Prisma — not viable |

Do not introduce new vulnerabilities above this baseline.
