/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  Role,
  ProductType,
  ProductCategory,
  OperationStage,
  OperationStatus,
  Priority,
  State,
} from '../generated/prisma/enums';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── CSV USER IMPORT TEMPLATE ───────────────────────────────────────────────
//
// To import users via CSV, POST to: POST /users/import
// Expected CSV headers (in this exact order):
//   staffId,fullName,email,role,jobTitle,department,phoneNumber,reportingLine,locationName
//
// Example CSV rows:
//   STF-100,John Smith,john.smith@example.com,SUPERVISOR,Production Supervisor,Production,9021808412,Production Manager,Shomolu
//   STF-101,Sarah Johnson,sarah.johnson@example.com,FACTORY_WORKER,Factory Worker,Production,8063168208,Production Supervisor,Shomolu
//   STF-102,Michael Chen,michael.chen@example.com,ACCOUNTANT,Finance Officer,Finance,,Head of Operations,Lagos
//   STF-103,Amelia Brown,amelia.brown@example.com,DESIGN_TEAM,Graphic Designer,Design,9095276666,General Manager,Shomolu
//
// Notes:
//   - staffId: Unique identifier (required, will skip if already exists)
//   - fullName: Full name (required, auto-split into firstName/lastName)
//   - email: Email address (required, auto-generated if omitted: firstname.lastname@tppcng.com)
//   - role: One of: ADMINISTRATOR, GENERAL_MANAGER, PRODUCTION_MANAGER, HEAD_OF_OPERATIONS,
//           SUPERVISOR, ACCOUNTANT, LOGISTICS_TEAM, DESIGN_TEAM, HUMAN_RESOURCES,
//           CUSTOMER_CARE, FACTORY_WORKER (required)
//   - jobTitle: Job title (required)
//   - department: Department name (required)
//   - phoneNumber: Optional, will be normalized (10-digit → 0XXXXXXXXXX format)
//   - reportingLine: Optional, name of reporting manager (for reference only)
//   - locationName: Optional, location name for the staff member (will be resolved from locations table)
//
// Default password for new users: Password123!
// After import, users can change their password via the login page.
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers ────────────────────────────────────────────────────────────────

function dec(n: number) {
  return n.toFixed(2);
}
function lineTotal(qty: number, unitPrice: number) {
  return dec(qty * unitPrice);
}

function formatNamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s'-])[a-z]/g, (match) => match.toUpperCase());
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean).map(formatNamePart);
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.slice(1).join(' ') || parts[0] || fullName,
  };
}

function normalizePhoneNumber(phoneNumber?: string) {
  if (!phoneNumber) return undefined;
  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

function buildEmail(fullName: string, seen: Map<string, number>) {
  const base = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
  const nextCount = (seen.get(base) ?? 0) + 1;
  seen.set(base, nextCount);
  const localPart = nextCount === 1 ? base : `${base}.${nextCount}`;
  return `${localPart}@tppcng.com`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding TPPC Manufacturing database …');

  // ════════════════════════════════════════════════════════════════════════════
  // 1. STAFF / USERS
  //    Roles: Administrator, General Manager, Production Manager,
  //    Head of Operations, Supervisor, Accountant, Logistics Team, Design Team
  // ════════════════════════════════════════════════════════════════════════════
  const defaultPassword = await argon2.hash('Password123!');

  const emailCounts = new Map<string, number>();

  const staffRoster: Array<{
    staffId: string;
    fullName: string;
    accessRole: Role;
    jobTitle: string;
    department: string;
    phoneNumber?: string;
    reportingLine?: string;
    locationName?: string;
  }> = [
    {
      staffId: 'STF-001',
      fullName: 'Kess Oghoma',
      accessRole: Role.ADMINISTRATOR,
      jobTitle: 'General Manager',
      department: 'Executive',
    },
    {
      staffId: 'STF-002',
      fullName: 'Daniel Ajayi',
      accessRole: Role.HEAD_OF_OPERATIONS,
      jobTitle: 'Head of Operations',
      department: 'Operations',
      phoneNumber: '8063168208',
      reportingLine: 'General Manager',
    },
    {
      staffId: 'STF-003',
      fullName: 'Emeka Chukwukelu',
      accessRole: Role.PRODUCTION_MANAGER,
      jobTitle: 'Production Manager',
      department: 'Production',
      phoneNumber: '8038155060',
      reportingLine: 'Head of Operations',
    },
    {
      staffId: 'STF-004',
      fullName: 'Uche Mbonu',
      accessRole: Role.SUPERVISOR,
      jobTitle: 'Production Supervisor',
      department: 'Production',
      phoneNumber: '9168123355',
      reportingLine: 'Production Manager',
    },
    {
      staffId: 'STF-005',
      fullName: 'Kelechi Uzo',
      accessRole: Role.SUPERVISOR,
      jobTitle: 'Production Supervisor',
      department: 'Production',
      phoneNumber: '8130826006',
      reportingLine: 'Production Manager',
    },
    {
      staffId: 'STF-006',
      fullName: 'Chidinma Nwani',
      accessRole: Role.HUMAN_RESOURCES,
      jobTitle: 'HR Manager',
      department: 'Human Resources',
      phoneNumber: '9095276666',
      reportingLine: 'General Manager',
    },
    {
      staffId: 'STF-007',
      fullName: 'Mfonobong Obot',
      accessRole: Role.ACCOUNTANT,
      jobTitle: 'Head of Finance',
      department: 'Finance',
      phoneNumber: '8037978800',
      reportingLine: 'General Manager',
    },
    {
      staffId: 'STF-008',
      fullName: 'Agozie Ezeh',
      accessRole: Role.SUPERVISOR,
      jobTitle: 'Production Supervisor',
      department: 'Production',
      phoneNumber: '8119362225',
      reportingLine: 'Production Manager',
    },
    {
      staffId: 'STF-009',
      fullName: 'Collins Ehis Ojo',
      accessRole: Role.CUSTOMER_CARE,
      jobTitle: 'Customer Care Officer',
      department: 'Customer Care',
      phoneNumber: '7047002256',
      reportingLine: 'Head of Operations',
    },
    {
      staffId: 'STF-010',
      fullName: 'Rita Chioma',
      accessRole: Role.CUSTOMER_CARE,
      jobTitle: 'Customer Care Officer',
      department: 'Customer Care',
      reportingLine: 'Head of Operations',
    },
    {
      staffId: 'STF-011',
      fullName: 'Chinonso Obioha',
      accessRole: Role.SUPERVISOR,
      jobTitle: 'Production Supervisor',
      department: 'Production',
      phoneNumber: '9021808412',
      reportingLine: 'Production Manager',
    },
    {
      staffId: 'STF-012',
      fullName: 'Osita Nwabuisi',
      accessRole: Role.SUPERVISOR,
      jobTitle: 'Production Supervisor',
      department: 'Production',
      phoneNumber: '9157845787',
      reportingLine: 'Production Manager',
    },
    {
      staffId: 'STF-013',
      fullName: 'Jude Mbonu',
      accessRole: Role.SUPERVISOR,
      jobTitle: 'Production Supervisor',
      department: 'Production',
      phoneNumber: '8169109904',
      reportingLine: 'Production Manager',
    },
    {
      staffId: 'STF-014',
      fullName: 'Obioha Gospel Chinenye',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-015',
      fullName: 'Bailey Anuoluwapo',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-016',
      fullName: 'Emmanuel Tabansi',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-017',
      fullName: 'Segun Samson',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-018',
      fullName: 'James Gofrey',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-019',
      fullName: 'Daramola Samsom Ojo',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-020',
      fullName: 'Chijioke Bright Chibuike',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-021',
      fullName: 'Ronke Asunni',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-022',
      fullName: 'Praise Okegbe Tochi',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-023',
      fullName: 'Emem Adahada',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-024',
      fullName: 'Oyetunji Esther',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-025',
      fullName: 'Chinemerem Okenji',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Shomolu',
    },
    {
      staffId: 'STF-026',
      fullName: 'Chukwuka Christian Chuba',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-027',
      fullName: 'Mmesoma Ohajiuka',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-028',
      fullName: 'Chinenye Nwabuisi',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-029',
      fullName: 'Blessing Miracle',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-030',
      fullName: 'Abigail Nkanu Rekpene',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-031',
      fullName: 'Ozioma Onyenanu',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-032',
      fullName: 'Bethel Nwabuisi Ifeoma',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-033',
      fullName: 'Onyiyechi Okoro Racheal',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-034',
      fullName: 'Chiamaka Onyeji Maryann',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-035',
      fullName: 'Chioma Anastesia Okenji',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-036',
      fullName: 'Precious Okon Simon',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-037',
      fullName: 'Oluchi Chukwude',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-038',
      fullName: 'Chidera Godwin',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-039',
      fullName: 'Steven Agbasi Ifeanyi',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-040',
      fullName: 'Chisom Favour Okenji',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-041',
      fullName: 'Chekwube Favour Chiuba',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-042',
      fullName: 'Anthony Nwadibia',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-043',
      fullName: 'Glory Amumaji',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Rasak',
    },
    {
      staffId: 'STF-044',
      fullName: 'Okocha Happiness Chekwube',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-045',
      fullName: 'Ihewuike Loveth Oluchi',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-046',
      fullName: 'Obasi Chukwuemeka Micheal',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-047',
      fullName: 'Azeez Isjola Ganiyu',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-048',
      fullName: 'Daramola Kehinde',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-049',
      fullName: 'Collins Scripture Ebube',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-050',
      fullName: 'Amarachi Johnson Grace',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-051',
      fullName: 'Obi Esther Onyinyechi',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-052',
      fullName: 'Ibe Chimuanya Vivian',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-053',
      fullName: 'Ayomide Jimoh',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-054',
      fullName: 'Ajoke Abiodun',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-055',
      fullName: 'Jessica Chukwubuikem',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-056',
      fullName: 'Kamsi Anisiebo',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-057',
      fullName: 'James Tochukwu',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
    {
      staffId: 'STF-058',
      fullName: 'Williams Olufemi Olajide',
      accessRole: Role.FACTORY_WORKER,
      jobTitle: 'Factory Worker',
      department: 'Production',
      reportingLine: 'Production Supervisor',
      locationName: 'Natufe',
    },
  ];

  // ────── Factory locations — seeded before users so locationIds are available ──
  const locationIds: Record<string, string> = {};
  for (const locName of ['Shomolu', 'Rasak', 'Natufe']) {
    const existing = await prisma.location.findFirst({ where: { name: locName } });
    const saved = existing ?? await prisma.location.create({
      data: {
        name: locName,
        addressLine: `${locName}, Lagos`,
        state: State.Lagos,
        country: 'NIGERIA',
      },
    });
    locationIds[locName] = saved.id;
  }
  console.log('  ✓ 3 factory locations seeded (Shomolu, Rasak, Natufe)');

  const usersData = staffRoster.map((member) => {
    const name = splitFullName(member.fullName);

    return {
      staffId: member.staffId,
      firstName: name.firstName,
      lastName: name.lastName,
      email: buildEmail(member.fullName, emailCounts),
      role: member.accessRole,
      jobTitle: member.jobTitle,
      department: member.department,
      phoneNumber: normalizePhoneNumber(member.phoneNumber),
      reportingLine: member.reportingLine,
      locationId: member.locationName ? locationIds[member.locationName] : undefined,
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
    };
  });

  const users: Record<string, string> = {}; // staffId → userId
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { staffId: u.staffId },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role as Role,
        jobTitle: u.jobTitle,
        department: u.department,
        phoneNumber: u.phoneNumber,
        reportingLine: u.reportingLine,
        locationId: u.locationId ?? null,
        city: u.city,
        state: u.state,
        country: u.country,
      },
      create: { ...u, password: defaultPassword },
    });
    users[u.staffId] = user.id;
  }
  console.log(`  ✓ ${Object.keys(users).length} users seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 1.5. SUPER ADMIN USER
  // ════════════════════════════════════════════════════════════════════════════
  const superAdminPassword = await argon2.hash('Excellium2026');
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'devadmin@excellium.biz' },
    update: {
      password: superAdminPassword,
      role: Role.ADMINISTRATOR,
    },
    create: {
      staffId: 'SADMIN-001',
      firstName: 'Dev',
      lastName: 'Admin',
      email: 'devadmin@excellium.biz',
      password: superAdminPassword,
      role: Role.ADMINISTRATOR,
      jobTitle: 'System Administrator',
      department: 'IT',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
    },
  });
  console.log(`  ✓ Super admin user created: ${superAdminUser.email}`);

  // ════════════════════════════════════════════════════════════════════════════
  // 2. INVENTORY
  //    Raw materials used across the manufacturing process.
  //    Prices in NGN, picklist values from the sheet.
  //
  //    Paper sizes:  36×48, 24×36, 20×30, 24×18, 31×42, 36×47, 24×40
  //    Sheets/Packet: 100, 500, 460
  //    Cost/Packet:   47000–85000
  //    Cost/Sheet:    56–850
  // ════════════════════════════════════════════════════════════════════════════
  const inventoryData = [
    // ──── PAPER ──────────────────────────────────────────────────────────
    {
      sku: 'INV-001',
      itemName: 'White Art Card 36×48 (300gsm)',
      itemType: 'Paper',
      category: 'Art Card',
      quantityInStock: 200,
      averagePrice: 550.0,
      price: 55000.0,
      receivedDate: new Date('2026-03-01'),
    },
    {
      sku: 'INV-002',
      itemName: 'White Art Card 24×36 (300gsm)',
      itemType: 'Paper',
      category: 'Art Card',
      quantityInStock: 350,
      averagePrice: 275.0,
      price: 27500.0,
      receivedDate: new Date('2026-03-01'),
    },
    {
      sku: 'INV-003',
      itemName: 'Kraft Paper 36×48',
      itemType: 'Paper',
      category: 'Kraft Paper',
      quantityInStock: 150,
      averagePrice: 470.0,
      price: 47000.0,
      receivedDate: new Date('2026-03-05'),
    },
    {
      sku: 'INV-004',
      itemName: 'Duplex Board 24×36',
      itemType: 'Paper',
      category: 'Duplex Board',
      quantityInStock: 120,
      averagePrice: 255.0,
      price: 25500.0,
      receivedDate: new Date('2026-03-05'),
    },
    {
      sku: 'INV-005',
      itemName: 'White Art Card 20×30 (250gsm)',
      itemType: 'Paper',
      category: 'Art Card',
      quantityInStock: 400,
      averagePrice: 96.0,
      price: 48000.0,
      receivedDate: new Date('2026-03-10'),
    },
    {
      sku: 'INV-006',
      itemName: 'Ivory Board 36×48',
      itemType: 'Paper',
      category: 'Ivory Board',
      quantityInStock: 100,
      averagePrice: 600.0,
      price: 60000.0,
      receivedDate: new Date('2026-03-12'),
    },
    {
      sku: 'INV-007',
      itemName: 'Grey Board 31×42',
      itemType: 'Paper',
      category: 'Grey Board',
      quantityInStock: 80,
      averagePrice: 850.0,
      price: 85000.0,
      receivedDate: new Date('2026-03-15'),
    },
    {
      sku: 'INV-008',
      itemName: 'Newsprint Paper 24×36',
      itemType: 'Paper',
      category: 'Newsprint',
      quantityInStock: 500,
      averagePrice: 56.0,
      price: 28000.0,
      receivedDate: new Date('2026-03-15'),
    },
    // ──── INK ────────────────────────────────────────────────────────────
    {
      sku: 'INV-009',
      itemName: 'Process Cyan Ink (1kg)',
      itemType: 'Ink',
      category: 'Printing Ink',
      quantityInStock: 50,
      averagePrice: 4500.0,
      price: 4500.0,
      receivedDate: new Date('2026-03-01'),
    },
    {
      sku: 'INV-010',
      itemName: 'Process Magenta Ink (1kg)',
      itemType: 'Ink',
      category: 'Printing Ink',
      quantityInStock: 50,
      averagePrice: 4500.0,
      price: 4500.0,
      receivedDate: new Date('2026-03-01'),
    },
    {
      sku: 'INV-011',
      itemName: 'Process Yellow Ink (1kg)',
      itemType: 'Ink',
      category: 'Printing Ink',
      quantityInStock: 50,
      averagePrice: 4500.0,
      price: 4500.0,
      receivedDate: new Date('2026-03-01'),
    },
    {
      sku: 'INV-012',
      itemName: 'Process Black Ink (1kg)',
      itemType: 'Ink',
      category: 'Printing Ink',
      quantityInStock: 50,
      averagePrice: 4000.0,
      price: 4000.0,
      receivedDate: new Date('2026-03-01'),
    },
    // ──── LAMINATION ─────────────────────────────────────────────────────
    {
      sku: 'INV-013',
      itemName: 'Gloss Lamination Film (roll)',
      itemType: 'Lamination',
      category: 'Lamination Film',
      quantityInStock: 30,
      averagePrice: 25000.0,
      price: 25000.0,
      receivedDate: new Date('2026-03-02'),
    },
    {
      sku: 'INV-014',
      itemName: 'Matte Lamination Film (roll)',
      itemType: 'Lamination',
      category: 'Lamination Film',
      quantityInStock: 25,
      averagePrice: 30000.0,
      price: 30000.0,
      receivedDate: new Date('2026-03-02'),
    },
    // ──── FINISHING MATERIALS ────────────────────────────────────────────
    {
      sku: 'INV-015',
      itemName: 'Twisted Paper Handles (pack 100)',
      itemType: 'Handle',
      category: 'Finishing Supply',
      quantityInStock: 200,
      averagePrice: 65.0,
      price: 6500.0,
      receivedDate: new Date('2026-03-10'),
    },
    {
      sku: 'INV-016',
      itemName: 'Gum / Adhesive (5L)',
      itemType: 'Adhesive',
      category: 'Finishing Supply',
      quantityInStock: 40,
      averagePrice: 8500.0,
      price: 8500.0,
      receivedDate: new Date('2026-03-10'),
    },
    // ──── CTP PLATES ─────────────────────────────────────────────────────
    {
      sku: 'INV-017',
      itemName: 'CTP Plate Kord Size',
      itemType: 'CTP Plate',
      category: 'CTP Plates',
      quantityInStock: 60,
      averagePrice: 1750.0,
      price: 1750.0,
      receivedDate: new Date('2026-03-08'),
    },
    {
      sku: 'INV-018',
      itemName: 'CTP Plate MO Size',
      itemType: 'CTP Plate',
      category: 'CTP Plates',
      quantityInStock: 40,
      averagePrice: 2000.0,
      price: 2000.0,
      receivedDate: new Date('2026-03-08'),
    },
    {
      sku: 'INV-019',
      itemName: 'CTP Plate ADAZ Size',
      itemType: 'CTP Plate',
      category: 'CTP Plates',
      quantityInStock: 20,
      averagePrice: 5000.0,
      price: 5000.0,
      receivedDate: new Date('2026-03-08'),
    },
    // ──── DIECUT DIES ────────────────────────────────────────────────────
    {
      sku: 'INV-020',
      itemName: 'Diecut Die 16×18',
      itemType: 'Diecut Die',
      category: 'Diecut Tools',
      quantityInStock: 10,
      averagePrice: 45000.0,
      price: 45000.0,
      receivedDate: new Date('2026-03-15'),
    },
  ];

  const inventory: Record<string, string> = {}; // sku → inventoryId
  for (const item of inventoryData) {
    const inv = await prisma.inventory.upsert({
      where: { sku: item.sku },
      update: {},
      create: item,
    });
    inventory[item.sku] = inv.id;
  }
  console.log(`  ✓ ${Object.keys(inventory).length} inventory items seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 3. PRODUCTS (Bill Of Materials master definitions)
  //    Product Types:    Branded, Plain, Generic
  //    Product Categories: Bags, Boxes, Cups
  // ════════════════════════════════════════════════════════════════════════════
  const productsData = [
    {
      sku: 'PRD-001',
      itemName: 'TPPC Branded Shopping Bag (Large)',
      productType: ProductType.BRANDED,
      productCategory: ProductCategory.BAGS,
      openingStock: 500,
      description:
        'Full-colour branded shopping bag, 16×18, art card 300gsm, gloss lamination, twisted handles.',
    },
    {
      sku: 'PRD-002',
      itemName: 'Plain Kraft Bag (Medium)',
      productType: ProductType.PLAIN,
      productCategory: ProductCategory.BAGS,
      openingStock: 800,
      description:
        'Unprinted kraft paper bag, 13.5×15.5, natural finish, twisted handles.',
    },
    {
      sku: 'PRD-003',
      itemName: 'TPPC Branded Gift Box',
      productType: ProductType.BRANDED,
      productCategory: ProductCategory.BOXES,
      openingStock: 300,
      description:
        'Branded rigid box, 12×12, grey board, matte lamination, 4-colour print.',
    },
    {
      sku: 'PRD-004',
      itemName: 'Generic Paper Cup (12oz)',
      productType: ProductType.GENERIC,
      productCategory: ProductCategory.CUPS,
      openingStock: 2000,
      description:
        'Single-wall paper cup, 12oz, white art card, gloss interior coating.',
    },
    {
      sku: 'PRD-005',
      itemName: 'Branded Luxury Bag (XL)',
      productType: ProductType.BRANDED,
      productCategory: ProductCategory.BAGS,
      openingStock: 200,
      description:
        'Premium branded bag, 18×24, ivory board, matte lamination, spot UV, twisted handles.',
    },
    {
      sku: 'PRD-006',
      itemName: 'Plain White Box',
      productType: ProductType.PLAIN,
      productCategory: ProductCategory.BOXES,
      openingStock: 600,
      description:
        'Unprinted white duplex box, 10×15.5, scored and diecut, no lamination.',
    },
  ];

  const products: Record<string, string> = {}; // sku → productId
  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
    products[p.sku] = prod.id;
  }
  console.log(`  ✓ ${Object.keys(products).length} products seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 4. BOM MATERIALS
  //    Formula: lineTotal = quantity × unitPrice
  //    Material_Name is a picklist from Inventory.
  // ════════════════════════════════════════════════════════════════════════════

  // PRD-001: Branded Shopping Bag (Large) – Art Card 36×48
  // Materials: paper sheets + ink + gloss lamination film + handles + adhesive
  const bomMaterialsData = [
    // PRD-001 Branded Shopping Bag (Large)
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-001',
      quantity: 4,
      unitPrice: 550.0,
    }, // 4 sheets × ₦550 = ₦2,200
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-009',
      quantity: 0.25,
      unitPrice: 4500.0,
    }, // Cyan ink 0.25kg × ₦4,500 = ₦1,125
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-010',
      quantity: 0.25,
      unitPrice: 4500.0,
    }, // Magenta ink
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-011',
      quantity: 0.25,
      unitPrice: 4500.0,
    }, // Yellow ink
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-012',
      quantity: 0.25,
      unitPrice: 4000.0,
    }, // Black ink 0.25kg × ₦4,000 = ₦1,000
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-013',
      quantity: 1,
      unitPrice: 25000.0,
    }, // Gloss lamination roll
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-015',
      quantity: 2,
      unitPrice: 65.0,
    }, // Twisted handles (2 packs)
    {
      productSku: 'PRD-001',
      inventorySku: 'INV-016',
      quantity: 0.5,
      unitPrice: 8500.0,
    }, // Adhesive

    // PRD-002 Plain Kraft Bag (Medium) – no printing/lamination
    {
      productSku: 'PRD-002',
      inventorySku: 'INV-003',
      quantity: 3,
      unitPrice: 470.0,
    }, // 3 sheets kraft × ₦470
    {
      productSku: 'PRD-002',
      inventorySku: 'INV-015',
      quantity: 1,
      unitPrice: 65.0,
    }, // Handles
    {
      productSku: 'PRD-002',
      inventorySku: 'INV-016',
      quantity: 0.3,
      unitPrice: 8500.0,
    }, // Adhesive

    // PRD-003 Branded Gift Box – grey board + 4-colour print + matte
    {
      productSku: 'PRD-003',
      inventorySku: 'INV-007',
      quantity: 2,
      unitPrice: 850.0,
    }, // 2 sheets grey board × ₦850
    {
      productSku: 'PRD-003',
      inventorySku: 'INV-009',
      quantity: 0.2,
      unitPrice: 4500.0,
    }, // Cyan
    {
      productSku: 'PRD-003',
      inventorySku: 'INV-010',
      quantity: 0.2,
      unitPrice: 4500.0,
    }, // Magenta
    {
      productSku: 'PRD-003',
      inventorySku: 'INV-011',
      quantity: 0.2,
      unitPrice: 4500.0,
    }, // Yellow
    {
      productSku: 'PRD-003',
      inventorySku: 'INV-012',
      quantity: 0.2,
      unitPrice: 4000.0,
    }, // Black
    {
      productSku: 'PRD-003',
      inventorySku: 'INV-014',
      quantity: 1,
      unitPrice: 30000.0,
    }, // Matte lamination roll
    {
      productSku: 'PRD-003',
      inventorySku: 'INV-016',
      quantity: 0.4,
      unitPrice: 8500.0,
    }, // Adhesive

    // PRD-004 Generic Paper Cup (12oz) – art card + gloss interior
    {
      productSku: 'PRD-004',
      inventorySku: 'INV-005',
      quantity: 1,
      unitPrice: 96.0,
    }, // Art card 20×30
    {
      productSku: 'PRD-004',
      inventorySku: 'INV-013',
      quantity: 0.5,
      unitPrice: 25000.0,
    }, // Gloss film (interior)

    // PRD-005 Branded Luxury Bag (XL) – ivory board + 4-colour + matte
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-006',
      quantity: 6,
      unitPrice: 600.0,
    }, // 6 sheets ivory board
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-009',
      quantity: 0.5,
      unitPrice: 4500.0,
    }, // Cyan
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-010',
      quantity: 0.5,
      unitPrice: 4500.0,
    }, // Magenta
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-011',
      quantity: 0.5,
      unitPrice: 4500.0,
    }, // Yellow
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-012',
      quantity: 0.5,
      unitPrice: 4000.0,
    }, // Black
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-014',
      quantity: 1,
      unitPrice: 30000.0,
    }, // Matte lamination
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-015',
      quantity: 3,
      unitPrice: 65.0,
    }, // Handles
    {
      productSku: 'PRD-005',
      inventorySku: 'INV-016',
      quantity: 0.6,
      unitPrice: 8500.0,
    }, // Adhesive

    // PRD-006 Plain White Box – duplex board, diecut only, no print/lamination
    {
      productSku: 'PRD-006',
      inventorySku: 'INV-004',
      quantity: 2,
      unitPrice: 255.0,
    }, // 2 sheets duplex board
    {
      productSku: 'PRD-006',
      inventorySku: 'INV-016',
      quantity: 0.2,
      unitPrice: 8500.0,
    }, // Adhesive
  ];

  let bomMatCount = 0;
  for (const bm of bomMaterialsData) {
    const productId = products[bm.productSku];
    const inventoryId = inventory[bm.inventorySku];
    const lt = lineTotal(bm.quantity, bm.unitPrice);

    await prisma.bomMaterial.upsert({
      where: { productId_inventoryId: { productId, inventoryId } },
      update: {},
      create: {
        productId,
        inventoryId,
        quantity: bm.quantity,
        unitPrice: dec(bm.unitPrice),
        lineTotal: lt,
      },
    });
    bomMatCount++;
  }
  console.log(`  ✓ ${bomMatCount} BOM materials seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 5. BOM OPERATIONS
  //    Each product goes through manufacturing stages. The picklist values
  //    come directly from the design sheet.
  //
  //    Stages: CTP_MAKING → PRINTING → DIECUTTING → LAMINATION → PACKAGING → FINISHING
  //
  //    Formula references from the sheet:
  //    - Cost Per Sheet = Cost Per Packet / Sheets Per Packet
  //    - Cut sheets from a full sheet based on cut size
  //    - CTP cost = cost per color × number of colors
  //    - Print cost = cost per color × number of colors
  //    - Lamination cost = gloss or matte cost per unit
  //    - Diecut cost = cost per diecut × quantity
  //    - Finishing cost = cost per finish × quantity
  //    - Labour Cost = sum of labour across all operations
  // ════════════════════════════════════════════════════════════════════════════

  const bomOpsData = [
    // ───── PRD-001 Branded Shopping Bag (Large) ─────
    // CTP Making – Kord machine, 4 colours (CMYK)
    {
      productSku: 'PRD-001',
      operationStage: OperationStage.CTP_MAKING,
      inventorySku: 'INV-017',
      assignedStaffId: users['STF-003'],
      paperSize: '36*48',
      sheetsPerPacket: 100,
      costPerPacket: dec(55000),
      costPerSheet: dec(550), // 55000 / 100 = 550
      ctpMachine: 'Kord',
      ctpCostPerColor: dec(1750), // ₦1,750/color from sheet
      operationName: 'CTP for Branded Bag Large',
      estimatedTimeMin: 60,
      labourCost: dec(2000),
    },
    // Printing – Kord 4-colour
    {
      productSku: 'PRD-001',
      operationStage: OperationStage.PRINTING,
      inventorySku: 'INV-009',
      assignedStaffId: users['STF-003'],
      paperSize: '36*48',
      sheetsPerPacket: 100,
      costPerPacket: dec(55000),
      costPerSheet: dec(550),
      printMachine: 'Kord',
      printCostPerColor: dec(2000), // ₦2,000/color from sheet
      operationName: 'Print Branded Bag Large (4 colour)',
      estimatedTimeMin: 120,
      labourCost: dec(4000),
    },
    // Lamination – Gloss, size 16×18
    {
      productSku: 'PRD-001',
      operationStage: OperationStage.LAMINATION,
      inventorySku: 'INV-013',
      assignedStaffId: users['STF-004'],
      laminationType: 'Gloss',
      laminationSize: '16*18',
      glossCost: dec(40), // ₦40 per unit from sheet
      matteCost: dec(0),
      operationName: 'Gloss lamination for Branded Bag',
      estimatedTimeMin: 45,
      labourCost: dec(1500),
    },
    // Diecutting – size 16×18
    {
      productSku: 'PRD-001',
      operationStage: OperationStage.DIECUTTING,
      inventorySku: 'INV-020',
      assignedStaffId: users['STF-003'],
      cutSize: '16*18',
      cutQuantity: 4, // 4 cuts per full sheet (36×48 → 16×18)
      costPerCut: dec(7), // ₦7 per cut from sheet
      diecutSize: '16*18',
      costPerDiecut: dec(15), // ₦15 per diecut from sheet
      operationName: 'Diecut Branded Bag',
      estimatedTimeMin: 30,
      labourCost: dec(1500),
    },
    // Finishing – twisted handles (65 default per spec), cost/finish ₦18
    {
      productSku: 'PRD-001',
      operationStage: OperationStage.FINISHING,
      inventorySku: 'INV-015',
      assignedStaffId: users['STF-005'],
      itemFinished: 'Branded Shopping Bag Large',
      twistedHandles: 65,
      costPerFinish: dec(18), // ₦18 per finish from sheet
      operationName: 'Finish & handle attach',
      estimatedTimeMin: 90,
      labourCost: dec(3000),
    },
    // Packaging
    {
      productSku: 'PRD-001',
      operationStage: OperationStage.PACKAGING,
      assignedStaffId: users['STF-005'],
      operationName: 'Package branded bags (bundles of 25)',
      estimatedTimeMin: 30,
      labourCost: dec(1000),
    },

    // ───── PRD-002 Plain Kraft Bag (Medium) ─────
    // No CTP/printing/lamination needed. Just cutting, diecutting, finishing, packaging.
    {
      productSku: 'PRD-002',
      operationStage: OperationStage.DIECUTTING,
      inventorySku: 'INV-003',
      assignedStaffId: users['STF-003'],
      cutSize: '13.5*15.5',
      cutQuantity: 4,
      costPerCut: dec(5), // ₦5/cut from sheet
      diecutSize: '13.5*15.5',
      costPerDiecut: dec(6), // ₦6/diecut from sheet
      operationName: 'Diecut Kraft Bag Medium',
      estimatedTimeMin: 25,
      labourCost: dec(1200),
    },
    {
      productSku: 'PRD-002',
      operationStage: OperationStage.FINISHING,
      inventorySku: 'INV-015',
      assignedStaffId: users['STF-005'],
      itemFinished: 'Plain Kraft Bag Medium',
      twistedHandles: 65,
      costPerFinish: dec(12), // ₦12/finish from sheet
      operationName: 'Finish plain kraft bag',
      estimatedTimeMin: 60,
      labourCost: dec(2000),
    },
    {
      productSku: 'PRD-002',
      operationStage: OperationStage.PACKAGING,
      assignedStaffId: users['STF-005'],
      operationName: 'Package kraft bags',
      estimatedTimeMin: 20,
      labourCost: dec(800),
    },

    // ───── PRD-003 Branded Gift Box ─────
    // CTP (MO), Print (MO), Lamination (Matte), Diecut 12×12, Finishing, Packaging
    {
      productSku: 'PRD-003',
      operationStage: OperationStage.CTP_MAKING,
      inventorySku: 'INV-018',
      assignedStaffId: users['STF-003'],
      paperSize: '31*42',
      sheetsPerPacket: 100,
      costPerPacket: dec(85000),
      costPerSheet: dec(850), // 85000 / 100
      ctpMachine: 'MO',
      ctpCostPerColor: dec(2000), // ₦2,000/color from sheet
      operationName: 'CTP for Gift Box',
      estimatedTimeMin: 60,
      labourCost: dec(2000),
    },
    {
      productSku: 'PRD-003',
      operationStage: OperationStage.PRINTING,
      inventorySku: 'INV-009',
      assignedStaffId: users['STF-004'],
      paperSize: '31*42',
      sheetsPerPacket: 100,
      costPerPacket: dec(85000),
      costPerSheet: dec(850),
      printMachine: 'MO',
      printCostPerColor: dec(4000), // ₦4,000/color from sheet
      operationName: 'Print Gift Box (4 colour)',
      estimatedTimeMin: 90,
      labourCost: dec(3500),
    },
    {
      productSku: 'PRD-003',
      operationStage: OperationStage.LAMINATION,
      inventorySku: 'INV-014',
      assignedStaffId: users['STF-004'],
      laminationType: 'Matte',
      laminationSize: '12*12',
      glossCost: dec(0),
      matteCost: dec(22), // ₦22/unit matte from sheet
      operationName: 'Matte lamination for Gift Box',
      estimatedTimeMin: 40,
      labourCost: dec(1500),
    },
    {
      productSku: 'PRD-003',
      operationStage: OperationStage.DIECUTTING,
      inventorySku: 'INV-020',
      assignedStaffId: users['STF-003'],
      cutSize: '12*12',
      cutQuantity: 6,
      costPerCut: dec(5),
      diecutSize: '12*12',
      costPerDiecut: dec(6),
      operationName: 'Diecut Gift Box',
      estimatedTimeMin: 35,
      labourCost: dec(1500),
    },
    {
      productSku: 'PRD-003',
      operationStage: OperationStage.FINISHING,
      assignedStaffId: users['STF-005'],
      itemFinished: 'Branded Gift Box',
      costPerFinish: dec(5), // ₦5/finish from sheet
      operationName: 'Fold & glue Gift Box',
      estimatedTimeMin: 75,
      labourCost: dec(2500),
    },
    {
      productSku: 'PRD-003',
      operationStage: OperationStage.PACKAGING,
      assignedStaffId: users['STF-005'],
      operationName: 'Package Gift Boxes (bundles of 20)',
      estimatedTimeMin: 25,
      labourCost: dec(900),
    },

    // ───── PRD-004 Generic Paper Cup ─────
    // Printing (DI Paper Print), no lamination needed (coated), Diecutting, Finishing, Packaging
    {
      productSku: 'PRD-004',
      operationStage: OperationStage.PRINTING,
      inventorySku: 'INV-005',
      assignedStaffId: users['STF-008'],
      paperSize: '20*30',
      sheetsPerPacket: 500,
      costPerPacket: dec(48000),
      costPerSheet: dec(96), // 48000 / 500
      printMachine: 'DI Paper Print',
      printCostPerColor: dec(350), // ₦350/color from sheet
      operationName: 'Print Paper Cup blanks',
      estimatedTimeMin: 60,
      labourCost: dec(2000),
    },
    {
      productSku: 'PRD-004',
      operationStage: OperationStage.DIECUTTING,
      assignedStaffId: users['STF-008'],
      cutSize: '6*9',
      cutQuantity: 10,
      costPerCut: dec(2.5), // ₦2.5/cut from sheet
      diecutSize: '6*9',
      costPerDiecut: dec(4), // ₦4/diecut from sheet
      operationName: 'Diecut Cup blanks',
      estimatedTimeMin: 45,
      labourCost: dec(1500),
    },
    {
      productSku: 'PRD-004',
      operationStage: OperationStage.FINISHING,
      assignedStaffId: users['STF-005'],
      itemFinished: 'Generic Paper Cup 12oz',
      costPerFinish: dec(4), // ₦4/finish from sheet
      operationName: 'Cup forming & sealing',
      estimatedTimeMin: 120,
      labourCost: dec(4000),
    },
    {
      productSku: 'PRD-004',
      operationStage: OperationStage.PACKAGING,
      assignedStaffId: users['STF-005'],
      operationName: 'Package cups (sleeves of 50)',
      estimatedTimeMin: 30,
      labourCost: dec(1000),
    },

    // ───── PRD-005 Branded Luxury Bag (XL) ─────
    // Full pipeline: CTP (ADAZ), Print (ADAZ), Lamination (Matte), Diecut, Finishing, Packaging
    {
      productSku: 'PRD-005',
      operationStage: OperationStage.CTP_MAKING,
      inventorySku: 'INV-019',
      assignedStaffId: users['STF-003'],
      paperSize: '36*48',
      sheetsPerPacket: 100,
      costPerPacket: dec(60000),
      costPerSheet: dec(600), // 60000 / 100
      ctpMachine: 'ADAZ',
      ctpCostPerColor: dec(5000), // ₦5,000/color from sheet
      operationName: 'CTP for Luxury Bag XL',
      estimatedTimeMin: 90,
      labourCost: dec(3000),
    },
    {
      productSku: 'PRD-005',
      operationStage: OperationStage.PRINTING,
      inventorySku: 'INV-009',
      assignedStaffId: users['STF-003'],
      paperSize: '36*48',
      sheetsPerPacket: 100,
      costPerPacket: dec(60000),
      costPerSheet: dec(600),
      printMachine: 'ADAZ',
      printCostPerColor: dec(7500), // ₦7,500/color from sheet
      operationName: 'Print Luxury Bag XL (4 colour)',
      estimatedTimeMin: 150,
      labourCost: dec(5000),
    },
    {
      productSku: 'PRD-005',
      operationStage: OperationStage.LAMINATION,
      inventorySku: 'INV-014',
      assignedStaffId: users['STF-004'],
      laminationType: 'Matte',
      laminationSize: '18*24',
      glossCost: dec(0),
      matteCost: dec(48), // ₦48/unit matte from sheet
      operationName: 'Matte lamination Luxury Bag',
      estimatedTimeMin: 60,
      labourCost: dec(2000),
    },
    {
      productSku: 'PRD-005',
      operationStage: OperationStage.DIECUTTING,
      assignedStaffId: users['STF-003'],
      cutSize: '18*24',
      cutQuantity: 2, // 36×48 → 18×24 = 2×2 = 4 per sheet but 2-up for bag
      costPerCut: dec(7),
      diecutSize: '18*24',
      costPerDiecut: dec(15),
      operationName: 'Diecut Luxury Bag XL',
      estimatedTimeMin: 40,
      labourCost: dec(2000),
    },
    {
      productSku: 'PRD-005',
      operationStage: OperationStage.FINISHING,
      inventorySku: 'INV-015',
      assignedStaffId: users['STF-005'],
      itemFinished: 'Branded Luxury Bag XL',
      twistedHandles: 65, // default per spec
      costPerFinish: dec(18),
      operationName: 'Finish Luxury Bag XL (handles + spot UV)',
      estimatedTimeMin: 120,
      labourCost: dec(4000),
    },
    {
      productSku: 'PRD-005',
      operationStage: OperationStage.PACKAGING,
      assignedStaffId: users['STF-005'],
      operationName: 'Package luxury bags (boxes of 10)',
      estimatedTimeMin: 25,
      labourCost: dec(1000),
    },

    // ───── PRD-006 Plain White Box ─────
    // Diecut only + finishing + packaging (no print, no lamination)
    {
      productSku: 'PRD-006',
      operationStage: OperationStage.DIECUTTING,
      inventorySku: 'INV-004',
      assignedStaffId: users['STF-008'],
      cutSize: '10*15.5',
      cutQuantity: 4,
      costPerCut: dec(5),
      diecutSize: '10*15.5',
      costPerDiecut: dec(6),
      operationName: 'Diecut Plain White Box',
      estimatedTimeMin: 25,
      labourCost: dec(1200),
    },
    {
      productSku: 'PRD-006',
      operationStage: OperationStage.FINISHING,
      assignedStaffId: users['STF-005'],
      itemFinished: 'Plain White Box',
      costPerFinish: dec(5),
      operationName: 'Fold & glue Plain White Box',
      estimatedTimeMin: 50,
      labourCost: dec(1800),
    },
    {
      productSku: 'PRD-006',
      operationStage: OperationStage.PACKAGING,
      assignedStaffId: users['STF-005'],
      operationName: 'Package plain boxes (bundles of 25)',
      estimatedTimeMin: 20,
      labourCost: dec(700),
    },
  ];

  let bomOpsCount = 0;
  for (const op of bomOpsData) {
    const { productSku, inventorySku, ...fields } = op;
    const productId = products[productSku];
    const inventoryId = inventorySku ? inventory[inventorySku] : undefined;

    // BomOperation doesn't have a unique constraint on productId+operationStage,
    // so use create (idempotent via deleteMany first on re-seed)
    await prisma.bomOperation.create({
      data: {
        productId,
        operationStage: fields.operationStage,
        inventoryId,
        assignedStaffId: fields.assignedStaffId,
        paperSize: fields.paperSize,
        sheetsPerPacket: fields.sheetsPerPacket,
        costPerPacket: fields.costPerPacket,
        costPerSheet: fields.costPerSheet,
        cutSize: fields.cutSize,
        cutQuantity: fields.cutQuantity,
        costPerCut: fields.costPerCut,
        ctpMachine: fields.ctpMachine,
        ctpCostPerColor: fields.ctpCostPerColor,
        printMachine: fields.printMachine,
        printCostPerColor: fields.printCostPerColor,
        laminationType: fields.laminationType,
        laminationSize: fields.laminationSize,
        glossCost: fields.glossCost,
        matteCost: fields.matteCost,
        diecutSize: fields.diecutSize,
        costPerDiecut: fields.costPerDiecut,
        itemFinished: fields.itemFinished,
        twistedHandles: fields.twistedHandles,
        costPerFinish: fields.costPerFinish,
        operationName: fields.operationName,
        estimatedTimeMin: fields.estimatedTimeMin,
        labourCost: fields.labourCost,
      },
    });
    bomOpsCount++;
  }
  console.log(`  ✓ ${bomOpsCount} BOM operations seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 6. SALES ORDERS (as if synced from Zoho Books)
  // ════════════════════════════════════════════════════════════════════════════
  const salesOrdersData = [
    {
      zohoBooksId: 'ZB-SO-100001',
      salesOrderNumber: 'SO-2026-001',
      customer: 'Dangote Industries Ltd',
      customerEmail: 'procurement@dangote.com',
      createdOnDateTime: new Date('2026-03-20T09:30:00Z'),
      expectedShipmentDate: new Date('2026-04-10'),
      status: 'confirmed',
      // Line items below; subtotal & total are computed
      lineItems: [
        { productSku: 'PRD-001', orderedQuantity: 1000, sellingPrice: 350.0 },
        { productSku: 'PRD-003', orderedQuantity: 500, sellingPrice: 800.0 },
      ],
    },
    {
      zohoBooksId: 'ZB-SO-100002',
      salesOrderNumber: 'SO-2026-002',
      customer: 'Shoprite Nigeria',
      customerEmail: 'purchasing@shoprite.ng',
      createdOnDateTime: new Date('2026-03-22T14:00:00Z'),
      expectedShipmentDate: new Date('2026-04-15'),
      status: 'confirmed',
      lineItems: [
        { productSku: 'PRD-002', orderedQuantity: 5000, sellingPrice: 150.0 },
        { productSku: 'PRD-004', orderedQuantity: 10000, sellingPrice: 45.0 },
      ],
    },
    {
      zohoBooksId: 'ZB-SO-100003',
      salesOrderNumber: 'SO-2026-003',
      customer: 'GTBank Plc',
      customerEmail: 'admin@gtbank.com',
      createdOnDateTime: new Date('2026-03-25T10:15:00Z'),
      expectedShipmentDate: new Date('2026-04-20'),
      status: 'open',
      lineItems: [
        { productSku: 'PRD-005', orderedQuantity: 200, sellingPrice: 1500.0 },
      ],
    },
    {
      zohoBooksId: 'ZB-SO-100004',
      salesOrderNumber: 'SO-2026-004',
      customer: 'Chicken Republic',
      customerEmail: 'supply@chickenrepublic.com',
      createdOnDateTime: new Date('2026-03-28T08:00:00Z'),
      expectedShipmentDate: new Date('2026-04-12'),
      status: 'confirmed',
      lineItems: [
        { productSku: 'PRD-004', orderedQuantity: 20000, sellingPrice: 42.0 },
        { productSku: 'PRD-006', orderedQuantity: 3000, sellingPrice: 120.0 },
      ],
    },
  ];

  let salesCount = 0;
  for (const so of salesOrdersData) {
    const { lineItems, ...order } = so;

    // Compute subtotal & total: sum(orderedQuantity × sellingPrice) per line item
    // Formula: Line_Item_Total = Ordered_Quantity × Selling_Price
    // Subtotal = sum of all Line_Item_Totals
    // Total = Subtotal (no tax in the sheet)
    const computedLineItems = lineItems.map((li) => ({
      ...li,
      lineItemTotal: li.orderedQuantity * li.sellingPrice,
    }));
    const subtotal = computedLineItems.reduce(
      (sum, li) => sum + li.lineItemTotal,
      0,
    );
    const total = subtotal;

    const existingSO = await prisma.salesOrder.findUnique({
      where: { zohoBooksId: order.zohoBooksId },
    });

    if (!existingSO) {
      await prisma.salesOrder.create({
        data: {
          ...order,
          subtotal: dec(subtotal),
          total: dec(total),
          lineItems: {
            create: computedLineItems.map((li) => ({
              productId: products[li.productSku] || null,
              sku: li.productSku,
              orderedQuantity: li.orderedQuantity,
              sellingPrice: dec(li.sellingPrice),
              productionCost: dec(0), // filled when product order is created
              lineItemTotal: dec(li.lineItemTotal),
            })),
          },
        },
      });
      salesCount++;
    }
  }
  console.log(`  ✓ ${salesCount} sales orders seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 7. PRODUCT ORDERS
  //    Each product order references a product and has:
  //    - Material_required grid → ProductOrderMaterial
  //      Formula: lineTotal = quantity × unitPrice
  //      Formula: endTotal  = (quantity - quantityUsed) × unitPrice
  //    - Operations grid → ProductOrderOperation
  //    - Subtotal = sum of all material lineTotals
  //    - Labour Cost = sum of all operation labourCosts
  //    - GrandTotal = Subtotal + Labour Cost
  // ════════════════════════════════════════════════════════════════════════════
  const productOrdersData = [
    {
      sku: 'PRD-001',
      productName: 'TPPC Branded Shopping Bag (Large)',
      productType: ProductType.BRANDED,
      productCategory: ProductCategory.BAGS,
      quantity: 1000,
      orderType: 'Sales Order',
      priority: Priority.HIGH,
      zohoBooksId: 'ZB-SO-100001',
      notes: 'Urgent order for Dangote Industries – 1000 branded bags',
      createdByStaffId: 'STF-001',
      materials: [
        // lineTotal = quantity × unitPrice
        {
          inventorySku: 'INV-001',
          quantity: 40,
          quantityUsed: 0,
          unitPrice: 550,
        },
        {
          inventorySku: 'INV-009',
          quantity: 2.5,
          quantityUsed: 0,
          unitPrice: 4500,
        },
        {
          inventorySku: 'INV-010',
          quantity: 2.5,
          quantityUsed: 0,
          unitPrice: 4500,
        },
        {
          inventorySku: 'INV-011',
          quantity: 2.5,
          quantityUsed: 0,
          unitPrice: 4500,
        },
        {
          inventorySku: 'INV-012',
          quantity: 2.5,
          quantityUsed: 0,
          unitPrice: 4000,
        },
        {
          inventorySku: 'INV-013',
          quantity: 10,
          quantityUsed: 0,
          unitPrice: 25000,
        },
        {
          inventorySku: 'INV-015',
          quantity: 20,
          quantityUsed: 0,
          unitPrice: 65,
        },
        {
          inventorySku: 'INV-016',
          quantity: 5,
          quantityUsed: 0,
          unitPrice: 8500,
        },
      ],
      operations: [
        {
          operationStage: OperationStage.CTP_MAKING,
          inventorySku: 'INV-017',
          assignedStaffId: 'STF-003',
          paperSize: '36*48',
          sheetsPerPacket: 100,
          costPerPacket: dec(55000),
          costPerSheet: dec(550),
          ctpMachine: 'Kord',
          ctpCostPerColor: dec(1750),
          operationName: 'CTP Branded Bag Large',
          estimatedTimeMin: 60,
          labourCost: dec(2000),
        },
        {
          operationStage: OperationStage.PRINTING,
          inventorySku: 'INV-009',
          assignedStaffId: 'STF-003',
          paperSize: '36*48',
          sheetsPerPacket: 100,
          costPerPacket: dec(55000),
          costPerSheet: dec(550),
          printMachine: 'Kord',
          printCostPerColor: dec(2000),
          operationName: 'Print Branded Bag Large (CMYK)',
          estimatedTimeMin: 120,
          labourCost: dec(4000),
        },
        {
          operationStage: OperationStage.LAMINATION,
          inventorySku: 'INV-013',
          assignedStaffId: 'STF-004',
          laminationType: 'Gloss',
          laminationSize: '16*18',
          glossCost: dec(40),
          matteCost: dec(0),
          operationName: 'Gloss lamination',
          estimatedTimeMin: 45,
          labourCost: dec(1500),
        },
        {
          operationStage: OperationStage.DIECUTTING,
          inventorySku: 'INV-020',
          assignedStaffId: 'STF-003',
          cutSize: '16*18',
          cutQuantity: 4,
          costPerCut: dec(7),
          diecutSize: '16*18',
          costPerDiecut: dec(15),
          operationName: 'Diecut Branded Bag',
          estimatedTimeMin: 30,
          labourCost: dec(1500),
        },
        {
          operationStage: OperationStage.FINISHING,
          inventorySku: 'INV-015',
          assignedStaffId: 'STF-005',
          itemFinished: 'Branded Shopping Bag Large',
          twistedHandles: 65,
          costPerFinish: dec(18),
          operationName: 'Finish & attach handles',
          estimatedTimeMin: 90,
          labourCost: dec(3000),
        },
        {
          operationStage: OperationStage.PACKAGING,
          assignedStaffId: 'STF-005',
          operationName: 'Package bags (bundles of 25)',
          estimatedTimeMin: 30,
          labourCost: dec(1000),
        },
      ],
    },
    {
      sku: 'PRD-002',
      productName: 'Plain Kraft Bag (Medium)',
      productType: ProductType.PLAIN,
      productCategory: ProductCategory.BAGS,
      quantity: 5000,
      orderType: 'Sales Order',
      priority: Priority.MEDIUM,
      zohoBooksId: 'ZB-SO-100002',
      notes: 'Shoprite order – 5000 plain kraft bags',
      createdByStaffId: 'STF-001',
      materials: [
        {
          inventorySku: 'INV-003',
          quantity: 60,
          quantityUsed: 0,
          unitPrice: 470,
        },
        {
          inventorySku: 'INV-015',
          quantity: 50,
          quantityUsed: 0,
          unitPrice: 65,
        },
        {
          inventorySku: 'INV-016',
          quantity: 15,
          quantityUsed: 0,
          unitPrice: 8500,
        },
      ],
      operations: [
        {
          operationStage: OperationStage.DIECUTTING,
          inventorySku: 'INV-003',
          assignedStaffId: 'STF-003',
          cutSize: '13.5*15.5',
          cutQuantity: 4,
          costPerCut: dec(5),
          diecutSize: '13.5*15.5',
          costPerDiecut: dec(6),
          operationName: 'Diecut Kraft Bags',
          estimatedTimeMin: 60,
          labourCost: dec(2500),
        },
        {
          operationStage: OperationStage.FINISHING,
          inventorySku: 'INV-015',
          assignedStaffId: 'STF-005',
          itemFinished: 'Plain Kraft Bag Medium',
          twistedHandles: 65,
          costPerFinish: dec(12),
          operationName: 'Finish kraft bags',
          estimatedTimeMin: 150,
          labourCost: dec(5000),
        },
        {
          operationStage: OperationStage.PACKAGING,
          assignedStaffId: 'STF-005',
          operationName: 'Package kraft bags (bundles of 50)',
          estimatedTimeMin: 45,
          labourCost: dec(1500),
        },
      ],
    },
    {
      sku: 'PRD-005',
      productName: 'Branded Luxury Bag (XL)',
      productType: ProductType.BRANDED,
      productCategory: ProductCategory.BAGS,
      quantity: 200,
      orderType: 'Sales Order',
      priority: Priority.HIGH,
      zohoBooksId: 'ZB-SO-100003',
      notes: 'GTBank premium bags – 200 luxury bags',
      createdByStaffId: 'STF-001',
      materials: [
        {
          inventorySku: 'INV-006',
          quantity: 24,
          quantityUsed: 0,
          unitPrice: 600,
        },
        {
          inventorySku: 'INV-009',
          quantity: 2,
          quantityUsed: 0,
          unitPrice: 4500,
        },
        {
          inventorySku: 'INV-010',
          quantity: 2,
          quantityUsed: 0,
          unitPrice: 4500,
        },
        {
          inventorySku: 'INV-011',
          quantity: 2,
          quantityUsed: 0,
          unitPrice: 4500,
        },
        {
          inventorySku: 'INV-012',
          quantity: 2,
          quantityUsed: 0,
          unitPrice: 4000,
        },
        {
          inventorySku: 'INV-014',
          quantity: 4,
          quantityUsed: 0,
          unitPrice: 30000,
        },
        {
          inventorySku: 'INV-015',
          quantity: 6,
          quantityUsed: 0,
          unitPrice: 65,
        },
        {
          inventorySku: 'INV-016',
          quantity: 2.4,
          quantityUsed: 0,
          unitPrice: 8500,
        },
      ],
      operations: [
        {
          operationStage: OperationStage.CTP_MAKING,
          inventorySku: 'INV-019',
          assignedStaffId: 'STF-003',
          paperSize: '36*48',
          sheetsPerPacket: 100,
          costPerPacket: dec(60000),
          costPerSheet: dec(600),
          ctpMachine: 'ADAZ',
          ctpCostPerColor: dec(5000),
          operationName: 'CTP Luxury Bag XL',
          estimatedTimeMin: 90,
          labourCost: dec(3000),
        },
        {
          operationStage: OperationStage.PRINTING,
          inventorySku: 'INV-009',
          assignedStaffId: 'STF-003',
          paperSize: '36*48',
          sheetsPerPacket: 100,
          costPerPacket: dec(60000),
          costPerSheet: dec(600),
          printMachine: 'ADAZ',
          printCostPerColor: dec(7500),
          operationName: 'Print Luxury Bag XL (CMYK)',
          estimatedTimeMin: 150,
          labourCost: dec(5000),
        },
        {
          operationStage: OperationStage.LAMINATION,
          inventorySku: 'INV-014',
          assignedStaffId: 'STF-004',
          laminationType: 'Matte',
          laminationSize: '18*24',
          glossCost: dec(0),
          matteCost: dec(48),
          operationName: 'Matte lamination Luxury Bag',
          estimatedTimeMin: 60,
          labourCost: dec(2000),
        },
        {
          operationStage: OperationStage.DIECUTTING,
          assignedStaffId: 'STF-003',
          cutSize: '18*24',
          cutQuantity: 2,
          costPerCut: dec(7),
          diecutSize: '18*24',
          costPerDiecut: dec(15),
          operationName: 'Diecut Luxury Bag',
          estimatedTimeMin: 40,
          labourCost: dec(2000),
        },
        {
          operationStage: OperationStage.FINISHING,
          inventorySku: 'INV-015',
          assignedStaffId: 'STF-005',
          itemFinished: 'Branded Luxury Bag XL',
          twistedHandles: 65,
          costPerFinish: dec(18),
          operationName: 'Finish Luxury Bag (handles)',
          estimatedTimeMin: 120,
          labourCost: dec(4000),
        },
        {
          operationStage: OperationStage.PACKAGING,
          assignedStaffId: 'STF-005',
          operationName: 'Package luxury bags (boxes of 10)',
          estimatedTimeMin: 25,
          labourCost: dec(1000),
        },
      ],
    },
    {
      sku: 'PRD-004',
      productName: 'Generic Paper Cup (12oz)',
      productType: ProductType.GENERIC,
      productCategory: ProductCategory.CUPS,
      quantity: 20000,
      orderType: 'Sales Order',
      priority: Priority.HIGH,
      zohoBooksId: 'ZB-SO-100004',
      notes: 'Chicken Republic – 20,000 paper cups',
      createdByStaffId: 'STF-001',
      materials: [
        {
          inventorySku: 'INV-005',
          quantity: 200,
          quantityUsed: 0,
          unitPrice: 96,
        },
        {
          inventorySku: 'INV-013',
          quantity: 4,
          quantityUsed: 0,
          unitPrice: 25000,
        },
      ],
      operations: [
        {
          operationStage: OperationStage.PRINTING,
          inventorySku: 'INV-005',
          assignedStaffId: 'STF-008',
          paperSize: '20*30',
          sheetsPerPacket: 500,
          costPerPacket: dec(48000),
          costPerSheet: dec(96),
          printMachine: 'DI Paper Print',
          printCostPerColor: dec(350),
          operationName: 'Print Paper Cup blanks',
          estimatedTimeMin: 120,
          labourCost: dec(4000),
        },
        {
          operationStage: OperationStage.DIECUTTING,
          assignedStaffId: 'STF-008',
          cutSize: '6*9',
          cutQuantity: 10,
          costPerCut: dec(2.5),
          diecutSize: '6*9',
          costPerDiecut: dec(4),
          operationName: 'Diecut Cup blanks',
          estimatedTimeMin: 90,
          labourCost: dec(3000),
        },
        {
          operationStage: OperationStage.FINISHING,
          assignedStaffId: 'STF-005',
          itemFinished: 'Generic Paper Cup 12oz',
          costPerFinish: dec(4),
          operationName: 'Cup forming & sealing',
          estimatedTimeMin: 240,
          labourCost: dec(8000),
        },
        {
          operationStage: OperationStage.PACKAGING,
          assignedStaffId: 'STF-005',
          operationName: 'Package cups (sleeves of 50)',
          estimatedTimeMin: 60,
          labourCost: dec(2000),
        },
      ],
    },
  ];

  let poCount = 0;
  for (const po of productOrdersData) {
    const { materials, operations, createdByStaffId, ...orderFields } =
      po as any;
    const productId = products[po.sku] || undefined;
    const createdByUserId = users[createdByStaffId] || undefined;

    // Compute: lineTotal = qty × unitPrice for each material
    // endTotal = (qty - qtyUsed) × unitPrice
    // subtotal = sum of all lineTotals
    const computedMaterials = materials.map((m: any) => {
      const lt = m.quantity * m.unitPrice;
      const et = (m.quantity - m.quantityUsed) * m.unitPrice;
      return {
        inventoryId: inventory[m.inventorySku],
        quantity: m.quantity,
        quantityUsed: m.quantityUsed,
        unitPrice: dec(m.unitPrice),
        lineTotal: dec(lt),
        endTotal: dec(et),
      };
    });

    const subtotal = computedMaterials.reduce(
      (sum: number, m: any) => sum + parseFloat(m.lineTotal),
      0,
    );

    // labourCost = sum of all operation labour costs
    const totalLabour = operations.reduce(
      (sum: number, op: any) => sum + parseFloat(op.labourCost || '0'),
      0,
    );

    // grandTotal = subtotal + labourCost
    const grandTotal = subtotal + totalLabour;

    // Build operations data
    const computedOps = operations.map((op: any) => {
      const {
        inventorySku: invSku,
        assignedStaffId: staffId,
        ...opFields
      } = op;
      return {
        ...opFields,
        inventoryId: invSku ? inventory[invSku] : undefined,
        assignedStaffId: staffId ? users[staffId] : undefined,
      };
    });

    await prisma.productOrder.create({
      data: {
        sku: orderFields.sku,
        productName: orderFields.productName,
        productId,
        productType: orderFields.productType,
        productCategory: orderFields.productCategory,
        quantity: orderFields.quantity,
        orderType: orderFields.orderType,
        priority: orderFields.priority,
        zohoBooksId: orderFields.zohoBooksId,
        notes: orderFields.notes,
        createdByUserId,
        subtotal: dec(subtotal),
        labourCost: dec(totalLabour),
        grandTotal: dec(grandTotal),
        status: 'IN_PROGRESS',
        materials: { create: computedMaterials },
        productOrderOperations: { create: computedOps },
      },
    });
    poCount++;
  }
  console.log(
    `  ✓ ${poCount} product orders seeded (with materials & operations)`,
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 8. STANDALONE OPERATIONS (from the Operations form)
  //    Status values: Unassigned, Assigned, Work in Progress, Paused, Complete, Re-assigned
  // ════════════════════════════════════════════════════════════════════════════

  // Fetch the product orders we just created to link them
  const allPOs = await prisma.productOrder.findMany({
    select: { id: true, sku: true },
  });
  const poMap: Record<string, string> = {};
  for (const p of allPOs) {
    poMap[p.sku] = p.id;
  }

  const operationsData = [
    {
      operationId: 'OP-001',
      operationStage: OperationStage.CTP_MAKING,
      productOrderId: poMap['PRD-001'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-003'],
      estimatedTimeMin: 60,
      details:
        'CTP plate making for Branded Shopping Bag (Kord machine). 4 colour plates (CMYK).',
      startTime: new Date('2026-04-01T08:00:00Z'),
      endTime: new Date('2026-04-01T09:00:00Z'),
      status: OperationStatus.COMPLETE,
    },
    {
      operationId: 'OP-002',
      operationStage: OperationStage.PRINTING,
      productOrderId: poMap['PRD-001'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-003'],
      estimatedTimeMin: 120,
      details: 'Print Branded Bag on Kord machine. 4 colour process.',
      startTime: new Date('2026-04-01T09:30:00Z'),
      status: OperationStatus.WORK_IN_PROGRESS,
    },
    {
      operationId: 'OP-003',
      operationStage: OperationStage.LAMINATION,
      productOrderId: poMap['PRD-001'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-004'],
      estimatedTimeMin: 45,
      details: 'Gloss lamination for printed bag sheets. Size 16×18.',
      status: OperationStatus.ASSIGNED,
    },
    {
      operationId: 'OP-004',
      operationStage: OperationStage.DIECUTTING,
      productOrderId: poMap['PRD-001'],
      role: Role.SUPERVISOR,
      estimatedTimeMin: 30,
      details: 'Diecut printed laminated sheets. Size 16×18.',
      status: OperationStatus.UNASSIGNED,
    },
    {
      operationId: 'OP-005',
      operationStage: OperationStage.FINISHING,
      productOrderId: poMap['PRD-001'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-005'],
      estimatedTimeMin: 90,
      details: 'Attach twisted handles and final QC. 65 handles per batch.',
      status: OperationStatus.UNASSIGNED,
    },
    {
      operationId: 'OP-006',
      operationStage: OperationStage.PACKAGING,
      productOrderId: poMap['PRD-001'],
      role: Role.SUPERVISOR,
      estimatedTimeMin: 30,
      details: 'Package in bundles of 25.',
      status: OperationStatus.UNASSIGNED,
    },
    // Operations for PRD-002 (Kraft Bags)
    {
      operationId: 'OP-007',
      operationStage: OperationStage.DIECUTTING,
      productOrderId: poMap['PRD-002'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-003'],
      estimatedTimeMin: 60,
      details: 'Diecut kraft paper for medium bags. Size 13.5×15.5.',
      startTime: new Date('2026-04-02T08:00:00Z'),
      status: OperationStatus.WORK_IN_PROGRESS,
    },
    {
      operationId: 'OP-008',
      operationStage: OperationStage.FINISHING,
      productOrderId: poMap['PRD-002'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-005'],
      estimatedTimeMin: 150,
      details: 'Fold, glue, and attach twisted handles to kraft bags.',
      status: OperationStatus.ASSIGNED,
    },
    // Operations for PRD-005 (Luxury Bags)
    {
      operationId: 'OP-009',
      operationStage: OperationStage.CTP_MAKING,
      productOrderId: poMap['PRD-005'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-003'],
      estimatedTimeMin: 90,
      details: 'CTP plate making for Luxury Bag XL on ADAZ machine.',
      status: OperationStatus.ASSIGNED,
    },
    {
      operationId: 'OP-010',
      operationStage: OperationStage.PRINTING,
      productOrderId: poMap['PRD-005'],
      role: Role.SUPERVISOR,
      estimatedTimeMin: 150,
      details: 'Print Luxury Bag on ADAZ machine. 4 colour + spot UV.',
      status: OperationStatus.UNASSIGNED,
    },
    // Operations for PRD-004 (Paper Cups)
    {
      operationId: 'OP-011',
      operationStage: OperationStage.PRINTING,
      productOrderId: poMap['PRD-004'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-008'],
      estimatedTimeMin: 120,
      details: 'Print cup blanks on DI Paper Print machine.',
      startTime: new Date('2026-04-03T07:30:00Z'),
      status: OperationStatus.WORK_IN_PROGRESS,
    },
    {
      operationId: 'OP-012',
      operationStage: OperationStage.DIECUTTING,
      productOrderId: poMap['PRD-004'],
      role: Role.SUPERVISOR,
      assignedStaffId: users['STF-008'],
      estimatedTimeMin: 90,
      details: 'Diecut cup blanks. Size 6×9, 10 per sheet.',
      status: OperationStatus.ASSIGNED,
    },
  ];

  let opsCount = 0;
  for (const op of operationsData) {
    const existing = await prisma.operation.findUnique({
      where: { operationId: op.operationId },
    });
    if (!existing) {
      await prisma.operation.create({ data: op });
      opsCount++;
    }
  }
  console.log(`  ✓ ${opsCount} standalone operations seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 9. OPERATION STATUS HISTORY (audit trail examples)
  // ════════════════════════════════════════════════════════════════════════════

  const op1 = await prisma.operation.findUnique({
    where: { operationId: 'OP-001' },
  });
  const op2 = await prisma.operation.findUnique({
    where: { operationId: 'OP-002' },
  });

  if (op1) {
    const existing = await prisma.operationStatusHistory.findFirst({
      where: { operationId: op1.id },
    });
    if (!existing) {
      // OP-001 went UNASSIGNED → ASSIGNED → WORK_IN_PROGRESS → COMPLETE
      await prisma.operationStatusHistory.createMany({
        data: [
          {
            operationId: op1.id,
            previousStatus: OperationStatus.UNASSIGNED,
            newStatus: OperationStatus.ASSIGNED,
            changedByUserId: users['STF-001'],
            changeReason: 'Assigned to Emeka for CTP',
          },
          {
            operationId: op1.id,
            previousStatus: OperationStatus.ASSIGNED,
            newStatus: OperationStatus.WORK_IN_PROGRESS,
            changedByUserId: users['STF-003'],
            changeReason: 'Started CTP work',
          },
          {
            operationId: op1.id,
            previousStatus: OperationStatus.WORK_IN_PROGRESS,
            newStatus: OperationStatus.COMPLETE,
            changedByUserId: users['STF-003'],
            changeReason: 'All 4 CTP plates completed',
          },
        ],
      });
    }
  }

  if (op2) {
    const existing = await prisma.operationStatusHistory.findFirst({
      where: { operationId: op2.id },
    });
    if (!existing) {
      await prisma.operationStatusHistory.createMany({
        data: [
          {
            operationId: op2.id,
            previousStatus: OperationStatus.UNASSIGNED,
            newStatus: OperationStatus.ASSIGNED,
            changedByUserId: users['STF-001'],
            changeReason: 'Assigned to Emeka for printing',
          },
          {
            operationId: op2.id,
            previousStatus: OperationStatus.ASSIGNED,
            newStatus: OperationStatus.WORK_IN_PROGRESS,
            changedByUserId: users['STF-003'],
            changeReason: 'Started printing run',
          },
        ],
      });
    }
  }
  console.log('  ✓ Operation status history seeded');

  // ════════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  // 9.5. MACHINERY
  //      Registered production machines, grouped by operation stage.
  //      These appear in the stage operation dropdowns throughout the system.
  // ════════════════════════════════════════════════════════════════════════════
  const machineryData: Array<{
    name: string;
    operationStage: OperationStage;
  }> = [
    // ── CTP Making machines ──────────────────────────────────────────────
    { name: 'Kord CTP Machine', operationStage: OperationStage.CTP_MAKING },
    { name: 'MO CTP Machine', operationStage: OperationStage.CTP_MAKING },
    { name: 'Sord CTP Machine', operationStage: OperationStage.CTP_MAKING },
    { name: 'SM CTP Machine', operationStage: OperationStage.CTP_MAKING },
    { name: 'ADAZ CTP Machine', operationStage: OperationStage.CTP_MAKING },

    // ── Printing presses ─────────────────────────────────────────────────
    { name: 'Kord Press', operationStage: OperationStage.PRINTING },
    { name: 'MO Press', operationStage: OperationStage.PRINTING },
    { name: 'Sord Press', operationStage: OperationStage.PRINTING },
    { name: 'SM Press', operationStage: OperationStage.PRINTING },
    { name: 'DI Paper Digital Press', operationStage: OperationStage.PRINTING },
    { name: 'DI Card Digital Press', operationStage: OperationStage.PRINTING },
    { name: 'Screen Printing Machine', operationStage: OperationStage.PRINTING },
    { name: 'ADAZ Press', operationStage: OperationStage.PRINTING },

    // ── Cutting machines ─────────────────────────────────────────────────
    { name: 'Polar Paper Cutter', operationStage: OperationStage.CUTTING },
    { name: 'Guillotine Cutter', operationStage: OperationStage.CUTTING },

    // ── Lamination machines ──────────────────────────────────────────────
    { name: 'Gloss Lamination Machine', operationStage: OperationStage.LAMINATION },
    { name: 'Matte Lamination Machine', operationStage: OperationStage.LAMINATION },

    // ── Die Cutting machines ─────────────────────────────────────────────
    { name: 'Bobst Die Cutter', operationStage: OperationStage.DIECUTTING },
    { name: 'Platen Die Cutter', operationStage: OperationStage.DIECUTTING },

    // ── Finishing machines ───────────────────────────────────────────────
    { name: 'Handle Twisting Machine', operationStage: OperationStage.FINISHING },
    { name: 'Gluing Machine', operationStage: OperationStage.FINISHING },
    { name: 'Folding Machine', operationStage: OperationStage.FINISHING },

    // ── Packaging machines ───────────────────────────────────────────────
    { name: 'Packaging Table (Manual)', operationStage: OperationStage.PACKAGING },
    { name: 'Shrink Wrap Machine', operationStage: OperationStage.PACKAGING },
  ];

  let machineryCount = 0;
  for (const m of machineryData) {
    await prisma.machine.upsert({
      where: { name_operationStage: { name: m.name, operationStage: m.operationStage } },
      update: {},
      create: m,
    });
    machineryCount++;
  }
  console.log(`  ✓ ${machineryCount} machines seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 9.6. VENDORS
  //      Registered service and material vendors, grouped by operation stage.
  //      These appear in the stage operation dropdowns throughout the system.
  // ════════════════════════════════════════════════════════════════════════════
  const vendorsData: Array<{
    name: string;
    operationStage: OperationStage;
  }> = [
    // ── CTP service vendors ──────────────────────────────────────────────
    { name: 'Printmax Nigeria Ltd', operationStage: OperationStage.CTP_MAKING },
    { name: 'Optimum Graphics', operationStage: OperationStage.CTP_MAKING },
    { name: 'TPPC In-House CTP', operationStage: OperationStage.CTP_MAKING },

    // ── Printing vendors ─────────────────────────────────────────────────
    { name: 'Printmax Nigeria Ltd', operationStage: OperationStage.PRINTING },
    { name: 'Optimum Graphics', operationStage: OperationStage.PRINTING },
    { name: 'West African Press', operationStage: OperationStage.PRINTING },
    { name: 'Excellent Printers', operationStage: OperationStage.PRINTING },
    { name: 'TPPC In-House Print', operationStage: OperationStage.PRINTING },

    // ── Paper / material suppliers ───────────────────────────────────────
    { name: 'Lagos Paper Mills', operationStage: OperationStage.PAPER_SELECTION },
    { name: 'Ibadan Paper Supplies', operationStage: OperationStage.PAPER_SELECTION },
    { name: 'Crown Packaging Materials', operationStage: OperationStage.PAPER_SELECTION },
    { name: 'Polaris Packaging', operationStage: OperationStage.PAPER_SELECTION },

    // ── Cutting vendors ──────────────────────────────────────────────────
    { name: 'TPPC In-House Cutting', operationStage: OperationStage.CUTTING },
    { name: 'City Cut Services', operationStage: OperationStage.CUTTING },

    // ── Lamination vendors ───────────────────────────────────────────────
    { name: 'LamTech Nigeria', operationStage: OperationStage.LAMINATION },
    { name: 'Gloss & Matte Finishers', operationStage: OperationStage.LAMINATION },
    { name: 'TPPC In-House Lamination', operationStage: OperationStage.LAMINATION },

    // ── Die cutting vendors ──────────────────────────────────────────────
    { name: 'Die Masters Ltd', operationStage: OperationStage.DIECUTTING },
    { name: 'Precision Die & Cut', operationStage: OperationStage.DIECUTTING },
    { name: 'TPPC In-House Die Cutting', operationStage: OperationStage.DIECUTTING },

    // ── Finishing vendors ────────────────────────────────────────────────
    { name: 'TPPC In-House Finishing', operationStage: OperationStage.FINISHING },
    { name: 'Handle Suppliers NG', operationStage: OperationStage.FINISHING },

    // ── Packaging vendors ────────────────────────────────────────────────
    { name: 'TPPC In-House Packaging', operationStage: OperationStage.PACKAGING },
    { name: 'PackRight Nigeria', operationStage: OperationStage.PACKAGING },
  ];

  let vendorsCount = 0;
  for (const v of vendorsData) {
    await prisma.vendor.upsert({
      where: { name_operationStage: { name: v.name, operationStage: v.operationStage } },
      update: {},
      create: v,
    });
    vendorsCount++;
  }
  console.log(`  ✓ ${vendorsCount} vendors seeded`);

  // ════════════════════════════════════════════════════════════════════════════
  // 10. AUDIT LOGS (examples)
  // ════════════════════════════════════════════════════════════════════════════

  await prisma.auditLog.createMany({
    data: [
      {
        userId: users['STF-001'],
        action: 'CREATE',
        entityType: 'ProductOrder',
        entityId: poMap['PRD-001'] || 'unknown',
        changes: { note: 'Created product order for 1000 branded bags' },
        // Seed-only sentinel hashes. Real rows go through AuditService and
        // get hash-chained in a transaction.
        hash: 'seed-1',
        prevHash: 'genesis',
      },
      {
        userId: users['STF-002'],
        action: 'CREATE',
        entityType: 'Inventory',
        entityId: inventory['INV-001'] || 'unknown',
        changes: { note: 'Added 200 sheets of White Art Card 36×48' },
        hash: 'seed-2',
        prevHash: 'seed-1',
      },
      {
        userId: users['STF-001'],
        action: 'UPDATE',
        entityType: 'Operation',
        entityId: 'OP-001',
        changes: {
          before: { status: 'UNASSIGNED' },
          after: { status: 'ASSIGNED', assignedStaffId: users['STF-003'] },
        },
        hash: 'seed-3',
        prevHash: 'seed-2',
      },
    ],
  });
  console.log('  ✓ Audit logs seeded');

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
