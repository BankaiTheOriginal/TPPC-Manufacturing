"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingCart,
  Users,
  ScrollText,
  Settings,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowRight,
  HelpCircle,
  ShieldCheck,
  Wrench,
  TrendingUp,
  Scissors,
  Printer,
  Zap,
  BookOpen,
  MapPin,
  BarChart2,
  ActivitySquare,
  ListChecks,
  PhoneCall,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "production-orders", label: "Production Orders", icon: ClipboardList },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "factory-activity", label: "Factory Activity", icon: ActivitySquare },
  { id: "sales-orders", label: "Sales Orders", icon: ShoppingCart },
  { id: "customer-care", label: "Customer Care", icon: PhoneCall },
  { id: "reports", label: "Reports", icon: BarChart2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "users", label: "Users & Settings", icon: Users },
  { id: "audit-logs", label: "Audit Trail", icon: ScrollText },
  { id: "zoho-settings", label: "Zoho Settings", icon: Settings },
  { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
] as const;

type SectionId = (typeof sections)[number]["id"];

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500 shadow-md shadow-teal-200">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
        <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoBox({
  type,
  children,
}: {
  type: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const config = {
    info: {
      bg: "bg-blue-50 border-blue-200",
      icon: Info,
      iconColor: "text-blue-500",
      titleColor: "text-blue-700",
      label: "Note",
    },
    warning: {
      bg: "bg-amber-50 border-amber-200",
      icon: AlertTriangle,
      iconColor: "text-amber-500",
      titleColor: "text-amber-700",
      label: "Important",
    },
    tip: {
      bg: "bg-emerald-50 border-emerald-200",
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      titleColor: "text-emerald-700",
      label: "Tip",
    },
  }[type];
  const Icon = config.icon;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", config.bg)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconColor)} />
      <p className="text-sm text-zinc-700">{children}</p>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white shadow-sm shadow-teal-200">
        {number}
      </div>
      <div className="pb-5">
        <p className="font-medium text-zinc-900">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-zinc-600">
          {children}
        </div>
      </div>
    </div>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-800">
        <ChevronRight className="h-4 w-4 text-teal-400" />
        {title}
      </h3>
      <div className="space-y-3 pl-6">{children}</div>
    </div>
  );
}

function RoleTag({ color, label }: { color: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        color,
      )}
    >
      {label}
    </span>
  );
}

function StageCard({
  icon: Icon,
  title,
  description,
  fields,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  fields: string[];
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-teal-500" />
        <p className="font-medium text-zinc-800">{title}</p>
      </div>
      <p className="mb-3 text-xs text-zinc-500">{description}</p>
      <ul className="space-y-1">
        {fields.map((f) => (
          <li
            key={f}
            className="flex items-center gap-1.5 text-xs text-zinc-600"
          >
            <ArrowRight className="h-3 w-3 text-zinc-300" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Section content ──────────────────────────────────────────────────────────

function OverviewSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={BookOpen}
        title="TPPC Manufacturing — Help & Guide"
        subtitle="Everything you need to know to operate this system effectively"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The <strong>TPPC Manufacturing System</strong> is an end-to-end
        operations platform designed to manage inventory, production orders,
        sales order synchronisation from Zoho Books, staff management, and full
        audit traceability. This guide covers every module in detail so every
        team member can work confidently.
      </p>

      <SubSection title="How the System Connects">
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              Zoho Books
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-400" />
            <span className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              Sales Orders
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-400" />
            <span className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
              Production Orders
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-400" />
            <span className="rounded-lg bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
              Production Stages
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-400" />
            <span className="rounded-lg bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700">
              Inventory Consumed
            </span>
          </div>
          <p className="mt-3 text-xs">
            Sales orders flow in from Zoho Books. Draft orders can be pushed
            into Production Orders with a single click. Each production order
            passes through up to 8 manufacturing stages. When completed,
            inventory is automatically adjusted and finished goods are synced
            back to Zoho.
          </p>
        </div>
      </SubSection>

      <SubSection title="Quick Navigation">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              icon: LayoutDashboard,
              label: "Dashboard",
              desc: "At-a-glance metrics and recent activity",
            },
            {
              icon: Package,
              label: "Inventory",
              desc: "Raw materials and finished goods stock",
            },
            {
              icon: ClipboardList,
              label: "Production Orders",
              desc: "Full production lifecycle management",
            },
            {
              icon: ListChecks,
              label: "Tasks",
              desc: "View and update assigned production tasks",
            },
            {
              icon: ActivitySquare,
              label: "Factory Activity",
              desc: "Log finishing worker activity and output",
            },
            {
              icon: ShoppingCart,
              label: "Sales Orders",
              desc: "Read-only view synced from Zoho Books",
            },
            {
              icon: PhoneCall,
              label: "Customer Care",
              desc: "Customer interactions and order follow-ups",
            },
            {
              icon: BarChart2,
              label: "Reports",
              desc: "Production, wastage, and financial analytics",
            },
            {
              icon: Bell,
              label: "Notifications",
              desc: "Task assignments and production updates",
            },
            {
              icon: Users,
              label: "Users & Settings",
              desc: "Staff accounts, roles, and system config",
            },
            {
              icon: ScrollText,
              label: "Audit Trail",
              desc: "Full activity history of all changes",
            },
            {
              icon: Settings,
              label: "Settings",
              desc: "Locations, machinery, vendors, and Zoho",
            },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                <Icon className="h-4 w-4 text-teal-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-800">{label}</p>
                <p className="text-xs text-zinc-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SubSection>
    </div>
  );
}

function DashboardSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Your real-time operational overview"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Dashboard is the first screen you see after logging in. It gives you
        an instant snapshot of the factory's current operational state without
        needing to navigate to individual modules.
      </p>

      <SubSection title="What You See">
        <div className="space-y-3 text-sm text-zinc-600">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
            <div>
              <p className="font-medium text-zinc-800">Summary Cards</p>
              <p>
                Four KPI cards at the top show total active production orders,
                pending orders, in-progress orders, and completed orders. These
                update in real time as orders change status.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
            <div>
              <p className="font-medium text-zinc-800">
                Recent Production Orders
              </p>
              <p>
                A live table shows the latest production orders with their SKU,
                product name, status badge, and priority. Clicking any row takes
                you directly to that order's detail page.
              </p>
            </div>
          </div>
        </div>
      </SubSection>

      <SubSection title="Status Colour Guide">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: "Pending", cls: "bg-zinc-100 text-zinc-700" },
            { label: "Assigned", cls: "bg-blue-100 text-blue-700" },
            { label: "In Progress", cls: "bg-teal-50 text-teal-700" },
            { label: "Paused", cls: "bg-yellow-100 text-yellow-700" },
            { label: "Complete", cls: "bg-emerald-100 text-emerald-700" },
            { label: "Cancelled", cls: "bg-red-100 text-red-700" },
          ].map(({ label, cls }) => (
            <span
              key={label}
              className={cn(
                "inline-flex justify-center rounded-full px-3 py-1 text-xs font-medium",
                cls,
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </SubSection>

      <InfoBox type="tip">
        The Dashboard is visible to all authenticated users. Use it as your
        starting point each morning to understand what is currently in progress
        and what needs attention.
      </InfoBox>
    </div>
  );
}

function InventorySection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Package}
        title="Inventory"
        subtitle="Manage raw materials and track stock levels"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Inventory module is the central store of all raw materials and
        consumables used in production. Every item in the system — paper, ink,
        lamination film, adhesives, chemicals, and so on — must exist here
        before it can be attached to a production order.
      </p>

      <InfoBox type="warning">
        This module is restricted to <strong>Administrators</strong>,{" "}
        <strong>General Managers</strong>, <strong>Production Managers</strong>,
        <strong>Heads of Operations</strong>, and <strong>Supervisors</strong>.
      </InfoBox>

      <SubSection title="Viewing Inventory">
        <p className="text-sm text-zinc-600">
          The main inventory list displays all items in a paginated table. Each
          row shows the SKU, item name, category, item type, quantity in stock,
          average price, and the date the item was received. Use the search bar
          at the top to filter by item name or SKU instantly.
        </p>
        <InfoBox type="info">
          Items whose <strong>Quantity in Stock</strong> is zero or very low
          will show a red warning indicator. Restock these items promptly to
          avoid production delays.
        </InfoBox>
      </SubSection>

      <SubSection title="Adding a New Item">
        <div className="space-y-3">
          <Step number={1} title='Click the "Add Item" button'>
            The orange "Add Item" button is in the top-right of the toolbar.
            Clicking it opens the creation form.
          </Step>
          <Step number={2} title="Fill in item details">
            <ul className="mt-1 space-y-1.5">
              {[
                {
                  f: "SKU",
                  d: "A unique code for this material (e.g. PAP-A4-70GSM). Must be unique across the entire system.",
                },
                {
                  f: "Item Name",
                  d: "A clear, descriptive name (e.g. A4 70gsm White Bond Paper).",
                },
                {
                  f: "Item Type",
                  d: "Choose from Paper/Board, Ink/Coating, Lamination Film, Dye/Pigment, Chemical, Adhesive/Glue, Packaging Material, Metal/Wire, Consumable, or Other.",
                },
                {
                  f: "Category",
                  d: "The broader category group for filtering and reporting.",
                },
                {
                  f: "Quantity in Stock",
                  d: "The current quantity on hand at the time of entry.",
                },
                {
                  f: "Average Price (₦)",
                  d: "The average cost per unit of this item. Used to compute material costs on production orders.",
                },
                { f: "Price (₦)", d: "The selling or reference price." },
                {
                  f: "Received Date",
                  d: "The date this item was received into the warehouse.",
                },
                {
                  f: "Last Restock Date",
                  d: "Optional — the most recent restock date.",
                },
              ].map(({ f, d }) => (
                <li key={f} className="text-xs">
                  <span className="font-medium text-zinc-800">{f}:</span>{" "}
                  <span className="text-zinc-600">{d}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step number={3} title='Click "Add Item" to save'>
            The item is created immediately and appears in the list. It is now
            available to be attached to production orders as a raw material.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Editing an Item">
        <div className="space-y-3">
          <Step number={1} title="Open the item detail page">
            Click any row in the inventory list to open the item's detail page.
          </Step>
          <Step number={2} title='Click "Edit"'>
            Press the pencil icon button in the top-right area of the detail
            page. The edit form opens pre-filled with the current values.
          </Step>
          <Step number={3} title="Update fields and save">
            Modify any field and click Save. Changes are immediately reflected
            system-wide — including any production orders that reference this
            item.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Deleting an Item">
        <InfoBox type="warning">
          Deleting an inventory item is <strong>permanent</strong>. Only delete
          items that are no longer used and have no active production order
          associations. The system will ask for a confirmation before deleting.
        </InfoBox>
        <p className="mt-2 text-sm text-zinc-600">
          On the item detail page, click the red "Delete" button and confirm the
          prompt. The item and all its records will be permanently removed.
        </p>
      </SubSection>

      <SubSection title="Refreshing / Re-syncing">
        <p className="text-sm text-zinc-600">
          The "Refresh" button in the toolbar forces a re-fetch from the server,
          updating quantities that may have changed due to completed production
          orders consuming stock.
        </p>
      </SubSection>
    </div>
  );
}

function LocationsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={MapPin}
        title="Locations"
        subtitle="Manage factory and warehouse locations for stage tracking"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Locations module lets you define physical factory or warehouse sites
        that can be assigned to individual production stages. This gives you
        visibility into where each step of an order is happening.
      </p>

      <InfoBox type="warning">
        Managing locations is restricted to <strong>Administrators</strong>,{" "}
        <strong>General Managers</strong>, <strong>Production Managers</strong>,
        and <strong>Heads of Operations</strong>.
      </InfoBox>

      <SubSection title="Adding a Location">
        <div className="space-y-3">
          <Step number={1} title='Click "Add Location"'>
            On the Locations page, click the orange "Add Location" button in the
            top-right corner.
          </Step>
          <Step number={2} title="Fill in the details">
            <ul className="mt-1 space-y-1 text-xs">
              <li>
                <strong>Location Name:</strong> A short, descriptive name (e.g.
                Lagos Warehouse).
              </li>
              <li>
                <strong>Address:</strong> Street address of the site.
              </li>
              <li>
                <strong>State:</strong> Select from the Nigerian states / FCT
                dropdown.
              </li>
            </ul>
          </Step>
          <Step number={3} title='Click "Create"'>
            The location is saved and appears in the table immediately.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Editing a Location">
        <p className="text-sm text-zinc-600">
          Click the pencil icon on any location row to open the edit dialog.
          Change the name, address, or state, then click "Save Changes".
        </p>
      </SubSection>

      <SubSection title="Deleting a Location">
        <p className="text-sm text-zinc-600">
          Click the trash icon on any location row and confirm the deletion.
          Note that deleting a location does not remove it from historical stage
          records — those will simply show the location ID.
        </p>
      </SubSection>

      <SubSection title="Assigning Locations to Stages">
        <p className="text-sm text-zinc-600">
          When recording a production stage operation, you can pick a location
          from the <strong>Factory Location</strong> dropdown inside the stage
          dialog. This tells the system where that stage was performed.
        </p>
      </SubSection>
    </div>
  );
}

function ProductionOrdersSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ClipboardList}
        title="Production Orders"
        subtitle="The full manufacturing lifecycle from creation to completion"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        Production Orders are the heart of the system. Each order represents a
        single manufacturing run — from the initial product brief all the way
        through paper selection, cutting, printing, lamination, die-cutting,
        finishing, and packaging. This module is used by{" "}
        <strong>Supervisors</strong>, <strong>Production Managers</strong>,{" "}
        <strong>Design Team</strong>, and <strong>Administrators</strong>.
      </p>

      <SubSection title="Creating a Production Order">
        <div className="space-y-3">
          <Step number={1} title='Click "New Order"'>
            On the Production Orders list page, click the orange "New Order"
            button at the top right.
          </Step>
          <Step number={2} title="Complete the order form">
            <ul className="mt-1 space-y-1.5">
              {[
                {
                  f: "SKU",
                  d: "A unique product code for this job (e.g. BAG-BRD-001).",
                },
                {
                  f: "Product Name",
                  d: "Descriptive name of the finished product.",
                },
                { f: "Product Type", d: "BRANDED, PLAIN, or GENERIC." },
                { f: "Product Category", d: "BAGS, BOXES, or CUPS." },
                {
                  f: "Quantity",
                  d: "Number of finished units to be produced.",
                },
                {
                  f: "Order Type",
                  d: "Free text — e.g. Standard, Rush, Sample.",
                },
                {
                  f: "Priority",
                  d: "HIGH, MEDIUM, or LOW. Affects ordering in the dashboard.",
                },
                {
                  f: "Zoho Books ID",
                  d: "Optional — links the production order back to a Zoho sales order.",
                },
                {
                  f: "Notes",
                  d: "Any special instructions for the production team.",
                },
              ].map(({ f, d }) => (
                <li key={f} className="text-xs">
                  <span className="font-medium text-zinc-800">{f}:</span>{" "}
                  <span className="text-zinc-600">{d}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step number={3} title='Click "Create Order"'>
            The order is saved with status <strong>PENDING</strong> and you are
            taken directly to its detail page to begin adding materials and
            logging stages.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Production Order Statuses">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              s: "PENDING",
              d: "Order created, not yet started. Awaiting assignment.",
              cls: "bg-zinc-100 text-zinc-700",
            },
            {
              s: "ASSIGNED",
              d: "Order has been assigned to a production team member.",
              cls: "bg-blue-100 text-blue-700",
            },
            {
              s: "WORK IN PROGRESS",
              d: "Active manufacturing is taking place.",
              cls: "bg-teal-50 text-teal-700",
            },
            {
              s: "PAUSED",
              d: "Production temporarily stopped (e.g. material shortage).",
              cls: "bg-yellow-100 text-yellow-700",
            },
            {
              s: "COMPLETE",
              d: "All stages finished and the order is closed out.",
              cls: "bg-emerald-100 text-emerald-700",
            },
            {
              s: "CANCELLED",
              d: "Order was cancelled and will not be produced.",
              cls: "bg-red-100 text-red-700",
            },
          ].map(({ s, d, cls }) => (
            <div
              key={s}
              className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3"
            >
              <span
                className={cn(
                  "mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
                  cls,
                )}
              >
                {s}
              </span>
              <p className="text-xs text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Adding Raw Materials">
        <p className="text-sm text-zinc-600">
          On the production order detail page, the{" "}
          <strong>Raw Materials</strong> card lists every material planned for
          this order. Before any production stage is logged, ensure all required
          materials are added.
        </p>
        <div className="mt-3 space-y-3">
          <Step number={1} title='Click "Add Material"'>
            The orange "Add Material" button is in the Raw Materials card
            header.
          </Step>
          <Step number={2} title="Select inventory item">
            Search and select any item from your inventory by its SKU or name.
            The item must already exist in the Inventory module.
          </Step>
          <Step number={3} title="Enter quantity and unit price">
            Specify how many units of this material are needed and the cost per
            unit. The system automatically calculates the line total.
          </Step>
          <Step number={4} title="Track usage">
            As production progresses, update the <strong>Quantity Used</strong>{" "}
            column by clicking on the number in the table. This helps track
            actual vs. planned consumption.
          </Step>
        </div>
        <InfoBox type="tip">
          When a production order is pushed from a Sales Order using the "Make
          to Production Order" button, all sales order line items are
          automatically added as materials — saving you manual entry time.
        </InfoBox>
      </SubSection>

      <SubSection title="Production Stages">
        <p className="mb-4 text-sm text-zinc-600">
          Each production order supports up to 8 sequential manufacturing
          stages. Click any stage button in the "Operations Pipeline" card to
          log the operation for that stage.
        </p>
        <p className="mb-4 text-sm text-zinc-600">
          A <strong>progress bar</strong> at the top of the pipeline shows how
          many stages are marked Complete out of the total non-N/A stages,
          giving an instant percentage view of overall order progress.
        </p>
        <p className="mb-4 text-sm text-zinc-600">
          Each stage has a <strong>Stage Status</strong> you can set inside its
          dialog:
        </p>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            {
              s: "Pending",
              d: "Not yet started (default).",
              cls: "bg-zinc-200 text-zinc-600",
            },
            {
              s: "In Progress",
              d: "Work underway.",
              cls: "bg-blue-100 text-blue-700",
            },
            {
              s: "Partially Complete",
              d: "Stage partially done — downstream tasks can begin with the released quantity.",
              cls: "bg-amber-100 text-amber-700",
            },
            {
              s: "Complete",
              d: "Stage fully finished.",
              cls: "bg-green-100 text-green-700",
            },
            {
              s: "N/A",
              d: "Not applicable, excluded from progress.",
              cls: "bg-zinc-100 text-zinc-400",
            },
            {
              s: "Skipped",
              d: "Stage deliberately skipped by a manager. Excluded from progress tracking.",
              cls: "bg-purple-100 text-purple-600",
            },
          ].map(({ s, d, cls }) => (
            <div
              key={s}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
            >
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  cls,
                )}
              >
                {s}
              </span>
              <p className="mt-1 text-xs text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
        <p className="mb-4 text-sm text-zinc-600">
          You can also assign a <strong>Factory Location</strong> to each stage
          to indicate where that step is being performed. Locations are managed
          in the <strong>Locations</strong> module.
        </p>
        <InfoBox type="tip">
          Every stage dialog shows a live <strong>Auto-Computed Stage Total (₦)</strong> banner
          at the bottom before you save. This preview updates in real-time as you fill in
          quantities and select options, so you can verify the cost calculation before
          committing the record.
        </InfoBox>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StageCard
            icon={Layers}
            title="1. Paper Selection"
            description="Choose the paper stock for this job. The system looks up cost-per-sheet automatically from the production rules based on the paper type and size you select."
            fields={[
              "Source Sheet Size (e.g. 60×90cm)",
              "Paper Type (e.g. Art Card 250gsm, Bond 70gsm)",
              "Sheets Per Packet",
              "Cost Per Packet (₦) — auto-resolved from rules",
              "Cost Per Sheet (₦) — auto-resolved from rules",
              "Auto-Computed Stage Total (₦)",
            ]}
          />
          <StageCard
            icon={Scissors}
            title="2. Cutting"
            description="Define the cut size and quantity. The system resolves the cost per cut from the production rules table and shows a live Stage Total preview before you save."
            fields={[
              "Source Sheet Size",
              "Cut Size (e.g. 15×21cm)",
              "Cut Quantity",
              "Cost Per Cut (₦) — auto-resolved from rules",
              "Factory Location",
              "Auto-Computed Stage Total (₦)",
            ]}
          />
          <StageCard
            icon={Zap}
            title="3. CTP Making"
            description="Computer-to-Plate pre-press stage. Select the CTP machine and vendor; cost per colour and number of plates are used to compute the stage total."
            fields={[
              "CTP Machine (Kord, MO, Sord, SM, ADAZ)",
              "Vendor",
              "Number of CTP Plates",
              "Cost Per CTP Color (₦) — auto-resolved",
              "Estimated Time (min)",
              "Auto-Computed Stage Total (₦)",
            ]}
          />
          <StageCard
            icon={Printer}
            title="4. Printing"
            description="The main press run. Select the machine and vendor; cost is calculated from number of impressions × cost per impression (or per colour for colour jobs)."
            fields={[
              "Print Machine (Kord, MO, Sord, SM, DI Paper, DI Card, Screen, ADAZ)",
              "Vendor",
              "Number of Impressions",
              "Cost Per Impression (₦) — auto-resolved from rules",
              "Estimated Time (min)",
              "Auto-Computed Stage Total (₦)",
            ]}
          />
          <StageCard
            icon={Layers}
            title="5. Lamination"
            description="Apply gloss or matte laminate. Select the lamination size and finish type; the cost per sheet is auto-resolved from the rules table."
            fields={[
              "Lamination Size (e.g. A4, A3, 60×90cm)",
              "Finish Type (Gloss / Matte)",
              "Vendor",
              "Number of Lamination Sheets",
              "Lamination Cost (₦/sheet) — auto-resolved",
              "Estimated Time (min)",
              "Auto-Computed Stage Total (₦)",
            ]}
          />
          <StageCard
            icon={Scissors}
            title="6. Die Cutting"
            description="Die cutting to shape the product. Enter the number of pieces to diecut; cost per piece is auto-resolved from the tiered production rules (quantity 1–6 / 7–16 / 17–48+)."
            fields={[
              "Die Cut Size",
              "Vendor",
              "No. of Pieces to Diecut",
              "Cost Per Die Cut (₦) — auto-resolved from rules",
              "Estimated Time (min)",
            ]}
          />
          <StageCard
            icon={Wrench}
            title="7. Finishing"
            description="Final assembly — gluing, folding, handle-twisting, and quality checks. Bag base cost and twisted handle cost are auto-computed; wastage breakdown is entered here."
            fields={[
              "Item Finished (e.g. Bag, Box)",
              "Finishing Location",
              "Quantity of Finished Products",
              "Bag Base Size (SMALL=₦5, MEDIUM=₦5, LARGE=₦10, XLARGE=₦15) — auto cost",
              "Number of Twisted Handles (₦65 per handle — auto cost)",
              "Cost Per Finish (₦) — auto-resolved from rules",
              "Wastage from Printing",
              "Wastage from Die Cutting",
              "Wastage from Laminating",
              "Wastage from Handling / Stains",
              "Auto-Computed Stage Total (₦)",
            ]}
          />
          <StageCard
            icon={Package}
            title="8. Packaging"
            description="Final packaging and dispatch preparation. Record the packaged item, location, and total quantity completed."
            fields={[
              "Item Packaged",
              "Packaging Location",
              "Quantity Item Finished",
              "Cost Per Packaging (₦)",
              "Estimated Time (min)",
              "Auto-Computed Stage Total (₦)",
            ]}
          />
        </div>
        <InfoBox type="info">
          You do not need to complete all stages — skip any that are not
          applicable to the product being manufactured. Only stages you log will
          contribute to the order's Grand Total.
        </InfoBox>
      </SubSection>

      <SubSection title="Order Financials">
        <p className="text-sm text-zinc-600">
          The <strong>Order Info</strong> sidebar card on the detail page
          displays a running cost breakdown:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-600">
          {[
            { l: "Material Cost", d: "Sum of all raw material line totals." },
            {
              l: "Operations Cost",
              d: "Sum of all stage totals (cutting, CTP, printing, lamination, die-cutting, finishing, packaging) auto-computed from production rules.",
            },
            {
              l: "Grand Total",
              d: "Material Cost + Operations Cost. This is the total manufacturing cost of the order.",
            },
          ].map(({ l, d }) => (
            <li key={l} className="flex items-start gap-2">
              <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-teal-400" />
              <span>
                <strong className="text-zinc-800">{l}:</strong> {d}
              </span>
            </li>
          ))}
        </ul>
      </SubSection>

      <SubSection title="Completing an Order">
        <div className="space-y-3">
          <Step number={1} title='Click "Edit Status"'>
            In the top-right action bar of the order detail page, click "Edit
            Status".
          </Step>
          <Step number={2} title="Set Status to COMPLETE">
            Select <strong>COMPLETE</strong> from the status dropdown.
          </Step>
          <Step number={3} title="Select a Zoho Location">
            Completing an order requires selecting a{" "}
            <strong>Zoho Location</strong>. This tells the system which
            warehouse the finished goods are being moved into. The dropdown
            pulls live data from Zoho Books.
          </Step>
          <Step number={4} title="Save">
            Click Save. The system will deduct the materials used from inventory
            and increment the finished goods stock at the selected Zoho
            location.
          </Step>
        </div>
        <InfoBox type="warning">
          You cannot complete an order without selecting a Zoho Location. If the
          dropdown is empty, check that your Zoho Books integration is connected
          in Settings.
        </InfoBox>
      </SubSection>

      <SubSection title="Repeating an Order">
        <p className="text-sm text-zinc-600">
          When a production order is in the <strong>COMPLETE</strong> status, an
          orange "Repeat Order" button appears in the action bar. Clicking it
          creates a new production order with the same product details (SKU,
          name, category, type, quantity, and priority), resetting all stages
          and materials so the new run can be managed independently.
        </p>
      </SubSection>

      <SubSection title="Deleting an Order">
        <InfoBox type="warning">
          Deleting a production order is permanent and cannot be undone. This
          action is restricted to <strong>Administrators</strong> only. The red
          &quot;Delete&quot; button appears on the order detail page only when you are
          logged in with the Administrator role. A confirmation dialog is shown
          before deletion proceeds.
        </InfoBox>
      </SubSection>

      <SubSection title="Bulk Actions on the List Page">
        <p className="text-sm text-zinc-600">
          <strong>Administrators</strong> can select multiple orders using the
          checkboxes on each row. Once at least one row is selected, a red
          &quot;Delete Selected&quot; button appears, allowing permanent removal of
          multiple orders in a single action. The checkboxes and delete button
          are not visible to non-Administrator roles. Always double-check your
          selection before confirming.
        </p>
      </SubSection>
    </div>
  );
}

function TasksSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ListChecks}
        title="Tasks"
        subtitle="View and manage assigned production tasks across all orders"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Tasks module provides a unified view of every production stage
        operation across all production orders. Instead of navigating into each
        order individually, supervisors, workers, and managers can see all
        assigned work in one paginated, filterable table.
      </p>

      <InfoBox type="info">
        <strong>Non-management users</strong> (Design Team, Logistics, Factory
        Workers, Customer Care) only see tasks that have been specifically
        assigned to them. Management roles (Administrator, General Manager,
        Production Manager, Head of Operations, Supervisor) see all tasks.
      </InfoBox>

      <SubSection title="Task Stages & Cutting Dependencies">
        <p className="text-sm text-zinc-600">
          Production tasks follow the same stage pipeline as production orders.
          However, the stages have different dependency rules:
        </p>
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-700">
              Independent Stages (can start anytime)
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              <strong>Paper Selection</strong>, <strong>Cutting</strong>,{" "}
              <strong>Artwork / Design</strong>, and <strong>CTP Making</strong>{" "}
              can begin even if cutting has not been completed. These stages do
              not depend on cutout availability.
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">
              Cutout-Dependent Stages (require released cut quantity)
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              <strong>Printing</strong>, <strong>Die Cutting</strong>,{" "}
              <strong>Lamination</strong>, <strong>Finishing</strong>, and{" "}
              <strong>Packaging</strong> unlock once the Cutting stage records an
              actual released quantity (even if cutting is only{" "}
              <strong>Partially Complete</strong>). The available quantity for
              downstream stages is determined by the actual cut quantity released
              — not just by the cutting stage status.
            </p>
          </div>
        </div>
      </SubSection>

      <SubSection title="New Cutouts Indicator">
        <p className="text-sm text-zinc-600">
          For cutout-dependent stages, a{" "}
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />{" "}
          <strong>red dot</strong> appears next to the stage name when new
          cutouts have been completed but the task has not yet processed them.
          This tells the assigned worker that there are fresh cutouts available
          to work on.
        </p>
      </SubSection>

      <SubSection title="Filtering & Sorting">
        <p className="text-sm text-zinc-600">
          The toolbar provides several filters to narrow the task list:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-600">
          {[
            {
              l: "Search",
              d: "Filter by product name, SKU, or assignee name.",
            },
            {
              l: "Order Filter",
              d: "Select a specific Sales Order or Production Order.",
            },
            {
              l: "Priority",
              d: "Show only HIGH, MEDIUM, or LOW priority tasks.",
            },
            { l: "Stage", d: "Filter by a specific production stage." },
            { l: "Status", d: "Filter by Pending, In Progress, Partially Complete, Complete, Skipped, or N/A." },
            {
              l: "Sort",
              d: "Sort by Due/ETA, Priority, Stage, or Production Order.",
            },
          ].map(({ l, d }) => (
            <li key={l} className="flex items-start gap-2">
              <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-teal-400" />
              <span>
                <strong className="text-zinc-800">{l}:</strong> {d}
              </span>
            </li>
          ))}
        </ul>
      </SubSection>

      <SubSection title="Updating a Task">
        <div className="space-y-3">
          <Step number={1} title='Click "Update" on a task row'>
            Each task row has an Update button on the right side.
          </Step>
          <Step number={2} title="Update the task status and quantities">
            In the dialog you can change the Stage Status, enter Items Completed
            and Items Wasted, and set an Estimated Hours value.
          </Step>
          <Step number={3} title="Assign a staff member (management only)">
            Managers can assign or reassign a task to any staff member using the
            Assigned To dropdown. When a task is assigned, the assigned user
            receives an in-app notification.
          </Step>
          <Step number={4} title="Save Changes">
            Click Save to persist the update. The task list refreshes
            automatically.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Task Notifications">
        <p className="text-sm text-zinc-600">
          When a task is assigned to a user, they receive an in-app notification
          with the stage name and production order details. Notifications appear
          via the bell icon in the header bar.
        </p>
      </SubSection>
    </div>
  );
}

function CustomerCareSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={PhoneCall}
        title="Customer Care"
        subtitle="Track customer interactions and order follow-ups"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Customer Care module provides a workspace for managing customer
        interactions, order follow-ups, and delivery coordination. Customer Care
        Officers use this as their primary module alongside Tasks and Production
        Orders.
      </p>

      <InfoBox type="info">
        Accessible to <strong>Administrators</strong>,{" "}
        <strong>General Managers</strong>, <strong>Production Managers</strong>,{" "}
        <strong>Heads of Operations</strong>, <strong>Supervisors</strong>,{" "}
        <strong>Logistics Team</strong>, and{" "}
        <strong>Customer Care Officers</strong>.
      </InfoBox>

      <SubSection title="What You Can Do">
        <ul className="space-y-1 text-sm text-zinc-600">
          {[
            "View and track customer orders and their production status",
            "Log customer interactions and follow-up notes",
            "Coordinate delivery scheduling with the Logistics team",
            "Escalate issues to Production or Operations management",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SubSection>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Bell}
        title="Notifications"
        subtitle="Stay informed about task assignments and production updates"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The notification system keeps every user informed about activity
        relevant to them. Notifications appear via the bell icon in the top-right
        of the header bar.
      </p>

      <SubSection title="Notification Types">
        <div className="space-y-2">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-800">
              Task Assignment
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              When a manager assigns a production task to you, you receive a
              notification with the stage name and production order details.
              Clicking the notification takes you to the relevant production
              order.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-800">
              Production Order Completed
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              When a production order is marked as complete, all active users
              receive a notification so the team is aware of finished jobs.
            </p>
          </div>
        </div>
      </SubSection>

      <SubSection title="Using Notifications">
        <div className="space-y-3">
          <Step number={1} title="Check the bell icon">
            A red badge on the bell icon shows how many unread notifications you
            have. The count refreshes automatically every 30 seconds.
          </Step>
          <Step number={2} title="Open the dropdown">
            Click the bell icon to see your most recent 20 notifications. Unread
            items are highlighted with a teal left border.
          </Step>
          <Step number={3} title="Click a notification">
            Clicking a notification marks it as read and navigates you to the
            relevant production order (if applicable).
          </Step>
          <Step number={4} title="Mark all as read">
            Use the &quot;Mark all read&quot; button at the bottom of the dropdown to
            clear all unread indicators at once.
          </Step>
        </div>
      </SubSection>
    </div>
  );
}

function FactoryActivitySection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ActivitySquare}
        title="Factory Activity"
        subtitle="Log and track finishing worker output and efficiency"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Factory Activity module records individual finishing-floor sessions
        — who worked, how much they finished, how much was wasted, and what it
        cost. Use this to monitor worker productivity and track finishing costs
        per location.
      </p>

      <InfoBox type="warning">
        This module is accessible to <strong>Administrators</strong>,{" "}
        <strong>General Managers</strong>, <strong>Production Managers</strong>,{" "}
        <strong>Heads of Operations</strong>, and <strong>Supervisors</strong>.
      </InfoBox>

      <SubSection title="Logging a New Activity">
        <div className="space-y-3">
          <Step number={1} title='Click "Log Activity"'>
            On the Factory Activity page, click the orange "Log Activity" button
            in the top-right corner.
          </Step>
          <Step number={2} title="Fill in activity details">
            <ul className="mt-1 space-y-1 text-xs">
              {[
                {
                  f: "Factory Location",
                  d: "Select the location where this finishing session took place.",
                },
                {
                  f: "Supervisor",
                  d: "Select the supervisor who oversaw this activity session.",
                },
                {
                  f: "Worker Names",
                  d: "Enter each worker's name and press Enter or comma to add them. Multiple workers can be recorded per session.",
                },
                {
                  f: "Quantity Allocated",
                  d: "How many units were given to the team to finish.",
                },
                {
                  f: "Quantity Finished",
                  d: "How many units were successfully completed.",
                },
                {
                  f: "Quantity Wasted",
                  d: "How many units were damaged or discarded during finishing.",
                },
                {
                  f: "Type of Finishing",
                  d: "Describe the finishing operation — e.g. Handle Twisting, Gluing, Folding.",
                },
                {
                  f: "Cost Per Finish (₦)",
                  d: "The cost charged or allocated per finished unit.",
                },
                {
                  f: "Notes",
                  d: "Optional free-text remarks for this session.",
                },
              ].map(({ f, d }) => (
                <li key={f}>
                  <span className="font-medium text-zinc-800">{f}:</span>{" "}
                  <span className="text-zinc-600">{d}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step number={3} title='Click "Create"'>
            The activity record is saved and appears in the list immediately.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Reading the Activity List">
        <p className="text-sm text-zinc-600">
          Each row in the activity list shows the location, supervisor,
          date/time, allocation and finish counts, and an{" "}
          <strong>Efficiency %</strong> badge — calculated as{" "}
          <em>(Quantity Finished ÷ Quantity Allocated) × 100</em>. Expand any
          row by clicking the chevron to see worker names, cost per finish,
          total earnings, and notes.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            {
              label: "≥ 90%",
              cls: "bg-emerald-100 text-emerald-700",
              note: "High efficiency",
            },
            {
              label: "70 – 89%",
              cls: "bg-yellow-100 text-yellow-700",
              note: "Moderate",
            },
            {
              label: "< 70%",
              cls: "bg-red-100 text-red-700",
              note: "Low — investigate wastage",
            },
          ].map(({ label, cls, note }) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-center"
            >
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  cls,
                )}
              >
                {label}
              </span>
              <p className="mt-1 text-xs text-zinc-500">{note}</p>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Filtering">
        <p className="text-sm text-zinc-600">
          Use the <strong>Location</strong> and <strong>Supervisor</strong>{" "}
          dropdowns above the table to narrow results. Both filters can be
          applied simultaneously. Click <strong>Clear Filters</strong> to reset.
        </p>
      </SubSection>

      <SubSection title="Editing and Deleting">
        <p className="text-sm text-zinc-600">
          Each expanded row exposes an <strong>Edit</strong> button (pencil
          icon) and a <strong>Delete</strong> button (trash icon). Editing opens
          the same dialog pre-filled with the existing values. Deletion asks for
          confirmation before removing the record permanently.
        </p>
        <InfoBox type="warning">
          Deleting an activity record is permanent and cannot be undone. Only
          remove records that were logged in error.
        </InfoBox>
      </SubSection>
    </div>
  );
}

function ReportsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={BarChart2}
        title="Reports"
        subtitle="Analytics across production, wastage, workers, and finances"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Reports module aggregates data from across the system into seven
        analytical tabs with interactive charts and graphs. Use it to identify
        bottlenecks, track wastage trends, monitor worker performance, and
        produce financial summaries. Each tab includes both visual charts
        (bar charts, pie charts, line charts) and detailed data tables.
      </p>

      <InfoBox type="warning">
        Access is restricted to <strong>Administrators</strong>,{" "}
        <strong>General Managers</strong>, <strong>Production Managers</strong>,{" "}
        <strong>Heads of Operations</strong>, and <strong>Accountants</strong>.
      </InfoBox>

      <SubSection title="Exporting Reports">
        <p className="text-sm text-zinc-600">
          Every report tab includes download buttons in the toolbar to export
          the currently displayed data:
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              label: "CSV",
              desc: "Raw comma-separated values — ideal for further analysis in Excel or Google Sheets.",
              cls: "bg-emerald-50 text-emerald-700",
            },
            {
              label: "Excel (.xls)",
              desc: "Formatted spreadsheet with headers and column widths pre-set.",
              cls: "bg-blue-50 text-blue-700",
            },
            {
              label: "PDF",
              desc: "Print-ready report with TPPC branding, summary tables, and the selected date range.",
              cls: "bg-red-50 text-red-700",
            },
          ].map(({ label, desc, cls }) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
            >
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cls)}>
                {label}
              </span>
              <p className="mt-1 text-xs text-zinc-600">{desc}</p>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Date Range Filter">
        <p className="text-sm text-zinc-600">
          All seven tabs share a single <strong>From</strong> and{" "}
          <strong>To</strong> date filter at the top of the page. Changing the
          range re-fetches all data instantly. Defaults to the last 30 days.
        </p>
      </SubSection>

      <SubSection title="Tab 1 — Production Summary">
        <p className="text-sm text-zinc-600">
          Four KPI cards show total orders, completed, in-progress, and pending
          counts for the selected period. Below the cards, a stage breakdown
          table counts how many operations are at each manufacturing stage and
          their average completion time.
        </p>
      </SubSection>

      <SubSection title="Tab 2 — Stage Performance">
        <p className="text-sm text-zinc-600">
          A per-stage table shows the number of operations logged, the average
          time taken (in hours), and how many were marked Complete vs. still in
          progress. Use this to identify which stages are becoming bottlenecks.
        </p>
      </SubSection>

      <SubSection title="Tab 3 — Wastage & Cost">
        <p className="text-sm text-zinc-600">
          Aggregated wastage figures across all production operations — broken
          down by printing, die-cutting, lamination, and handling wastage. The
          top-10 orders by total wastage are listed with per-order totals so you
          can pinpoint the highest-waste jobs.
        </p>
      </SubSection>

      <SubSection title="Tab 4 — Worker Activity">
        <p className="text-sm text-zinc-600">
          Summarises factory activity records by supervisor: total sessions
          logged, total units allocated, total units finished, and average
          efficiency percentage. The full activity log table is displayed below
          for drill-down.
        </p>
      </SubSection>

      <SubSection title="Tab 5 — Order Delays">
        <p className="text-sm text-zinc-600">
          Lists all production orders that have at least one operation whose
          expected timeline has passed but whose stage status is not yet
          Complete. The overdue count per order is shown so you can prioritise
          the most behind-schedule jobs.
        </p>
      </SubSection>

      <SubSection title="Tab 6 — Inventory Health">
        <p className="text-sm text-zinc-600">
          Pulls current stock levels from the Inventory module and flags items
          that are low or out of stock. The table shows item name, current
          quantity, and a status badge (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Out of Stock
          </span>
          {" / "}
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Low Stock
          </span>
          {" / "}
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            OK
          </span>
          ).
        </p>
        <InfoBox type="tip">
          Items with zero stock will block production stages that depend on
          them. Use this tab regularly to keep ahead of restock needs.
        </InfoBox>
      </SubSection>

      <SubSection title="Tab 7 — Financial Overview">
        <p className="text-sm text-zinc-600">
          Combines material costs and finishing costs across all operations in
          the selected period into a single financial summary. Totals are shown
          per cost category (cut sheet cost, lamination cost, finishing cost)
          alongside a grand total manufacturing spend.
        </p>
      </SubSection>
    </div>
  );
}

function SalesOrdersSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ShoppingCart}
        title="Sales Orders"
        subtitle="Read-only view of orders synced from Zoho Books"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Sales Orders module provides a read-only window into orders that
        exist in Zoho Books. This data is <strong>not editable</strong> here —
        all changes to sales orders must be made in Zoho Books. The system
        automatically syncs order data when you navigate to this page or click
        Refresh.
      </p>

      <InfoBox type="warning">
        This module is accessible to <strong>Administrators</strong>,{" "}
        <strong>General Managers</strong>, <strong>Heads of Operations</strong>,
        and <strong>Logistics Team</strong>.
      </InfoBox>

      <SubSection title="Sales Order Statuses">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            {
              s: "draft",
              d: "Created in Zoho, not yet confirmed.",
              cls: "bg-zinc-100 text-zinc-600",
            },
            {
              s: "confirmed",
              d: "Confirmed by a sales rep.",
              cls: "bg-blue-100 text-blue-700",
            },
            {
              s: "invoiced",
              d: "Invoice has been raised.",
              cls: "bg-purple-100 text-purple-700",
            },
            {
              s: "open",
              d: "Active and awaiting fulfilment.",
              cls: "bg-green-100 text-green-700",
            },
            {
              s: "overdue",
              d: "Past the shipment date.",
              cls: "bg-teal-50 text-teal-700",
            },
            {
              s: "void",
              d: "Cancelled in Zoho Books.",
              cls: "bg-red-100 text-red-600",
            },
          ].map(({ s, d, cls }) => (
            <div
              key={s}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
            >
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  cls,
                )}
              >
                {s}
              </span>
              <p className="mt-1 text-xs text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Make to Production Orders">
        <p className="text-sm text-zinc-600">
          Sales orders with a <strong>draft</strong> status show a blue "Send to
          Production" button at the top of the detail page. This converts the
          sales order into one or more production orders — one per line item.
        </p>
        <div className="mt-3 space-y-3">
          <Step number={1} title="Open the sales order">
            Click on any draft sales order in the list to open its detail page.
          </Step>
          <Step number={2} title='Click "Send to Production"'>
            The button appears in the top-right action bar. Click it to open the
            production order creation dialog.
          </Step>
          <Step number={3} title="Review and configure line items">
            Each line item appears as a row in the dialog with its sales
            quantity shown. You can:
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
              <li>
                • Adjust the <strong>Production Qty</strong> per item using the
                +/- controls or by typing directly.
              </li>
              <li>
                • The <strong>vs Order</strong> column shows how much your
                production qty differs from the sales qty (green for surplus,
                amber for short).
              </li>
              <li>
                • Uncheck any item you don't want to create a production order
                for.
              </li>
            </ul>
          </Step>
          <Step number={4} title="Set shared fields">
            <ul className="mt-1 space-y-1 text-xs">
              <li>
                <strong>Product Type:</strong> BRANDED, PLAIN, or GENERIC —
                applies to all created orders.
              </li>
              <li>
                <strong>Product Category:</strong> BAGS, BOXES, or CUPS.
              </li>
              <li>
                <strong>Order Type:</strong> Free text — e.g. Standard, Rush.
              </li>
              <li>
                <strong>Priority:</strong> HIGH, MEDIUM, or LOW.
              </li>
            </ul>
          </Step>
          <Step number={5} title='Click "Create N Production Orders"'>
            One production order is created for each included line item with:
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
              <li>
                • SKU set to <em>SalesOrderNumber-ItemSKU</em>
              </li>
              <li>• Product name set to the line item name</li>
              <li>• Quantity set to your configured production quantity</li>
              <li>
                • Materials left empty (to be filled in manually or from cutting
                stage data)
              </li>
            </ul>
            If a single order is created, you are taken directly to it. If
            multiple orders are created, you are taken to the Production Orders
            list.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Refreshing Orders">
        <p className="text-sm text-zinc-600">
          Click the <strong>Refresh</strong> button in the top-right of the
          Sales Orders list page to force a fresh sync from Zoho Books. This is
          useful if an order was just created or updated in Zoho and you need
          the latest data immediately.
        </p>
      </SubSection>

      <SubSection title="Searching and Filtering">
        <p className="text-sm text-zinc-600">
          Use the search bar on the list page to filter orders by order number
          or customer name. Results update in real time as you type.
        </p>
      </SubSection>
    </div>
  );
}

function UsersSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Users}
        title="Users & Settings"
        subtitle="Manage staff accounts, roles, permissions, and system configuration"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Users module (found under <strong>Settings → Staff Directory</strong>)
        allows authorised users to create and manage all staff accounts in the
        system. Every person who needs to log in must have an account here. Each
        account is assigned exactly one role which controls what they can see
        and do.
      </p>

      <InfoBox type="info">
        User management is available to <strong>Administrators</strong>,{" "}
        <strong>General Managers</strong>, <strong>Heads of Operations</strong>,
        and <strong>Human Resources</strong>.
      </InfoBox>

      <SubSection title="Creating a New User">
        <div className="space-y-3">
          <Step number={1} title='Click "New User"'>
            On the Staff Directory page, click the orange &quot;New User&quot; button.
          </Step>
          <Step number={2} title="Fill in the user details">
            <ul className="mt-1 space-y-1 text-xs">
              {[
                {
                  f: "Staff ID",
                  d: "A unique identifier for the employee (e.g. EMP-001). Used for login and audit trail attribution.",
                },
                {
                  f: "First Name & Last Name",
                  d: "The staff member's full name.",
                },
                {
                  f: "Email",
                  d: "Must be unique. Used for system notifications.",
                },
                {
                  f: "Password",
                  d: "Initial password (min 8 characters). Staff should change it after first login.",
                },
                {
                  f: "Job Title",
                  d: "The staff member's job title (e.g. Production Supervisor).",
                },
                {
                  f: "Department",
                  d: "The department the staff member belongs to.",
                },
                {
                  f: "Phone Number",
                  d: "Optional contact phone number.",
                },
                {
                  f: "Reporting Line",
                  d: "Optional — who the staff member reports to.",
                },
                {
                  f: "Location",
                  d: "Assign the staff member to a factory or warehouse location (managed under Settings → Locations).",
                },
                {
                  f: "Role",
                  d: "Select the appropriate role (see Roles & Permissions for full details). The role determines what the user can access.",
                },
              ].map(({ f, d }) => (
                <li key={f}>
                  <span className="font-medium text-zinc-800">{f}:</span>{" "}
                  <span className="text-zinc-600">{d}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step number={3} title='Click "Create User"'>
            The account is created immediately. The new user can now log in.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Bulk Import via CSV">
        <p className="text-sm text-zinc-600">
          You can create or update multiple staff accounts at once by uploading a
          CSV file. Click the <strong>Import Users</strong> button in the Staff
          Directory toolbar to open the import dialog.
        </p>
        <div className="mt-3 space-y-3">
          <Step number={1} title="Download the template">
            Click <strong>Download Template</strong> inside the import dialog to
            get a correctly formatted CSV. Fill it in with your staff data.
          </Step>
          <Step number={2} title="Fill in the CSV columns">
            <ul className="mt-1 space-y-1 text-xs">
              {[
                { f: "staffId", d: "Required. Unique employee ID (e.g. EMP-001). If a user with this ID already exists, their record is updated (upsert)." },
                { f: "firstName", d: "Required. Staff first name." },
                { f: "lastName", d: "Required. Staff last name." },
                { f: "email", d: "Required. Must be unique across all users." },
                { f: "role", d: "Required. One of: ADMINISTRATOR, GENERAL_MANAGER, PRODUCTION_MANAGER, HEAD_OF_OPERATIONS, SUPERVISOR, HR_MANAGER, ACCOUNTANT, CUSTOMER_CARE, LOGISTICS, DESIGN_TEAM, FACTORY_WORKER." },
                { f: "password", d: "Optional. If omitted, a secure default password is assigned. Staff should change it on first login." },
                { f: "jobTitle", d: "Optional. Job title string." },
                { f: "department", d: "Optional. Department name." },
                { f: "phoneNumber", d: "Optional. Contact number." },
                { f: "reportingLine", d: "Optional. Who the staff member reports to." },
                { f: "locationName", d: "Optional. Must match an existing Location name exactly. Leave blank to leave unassigned." },
              ].map(({ f, d }) => (
                <li key={f}>
                  <span className="font-mono font-medium text-zinc-800">{f}:</span>{" "}
                  <span className="text-zinc-600">{d}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step number={3} title="Upload and review">
            Click <strong>Choose File</strong>, select your CSV, then click
            <strong> Upload</strong>. The system validates each row and shows a
            summary of created, updated, and failed rows. Any errors (e.g.
            duplicate email or missing required field) are listed with the row
            number so you can correct the file and re-import.
          </Step>
        </div>
        <InfoBox type="info">
          Import is an <strong>upsert</strong> operation — existing users matched
          by <strong>staffId</strong> are updated; new staffIds create new
          accounts. This means you can also use the import to update roles or
          departments for a large group of staff at once.
        </InfoBox>
      </SubSection>

      <SubSection title="Editing a User">
        <p className="text-sm text-zinc-600">
          Click on any user row to open their profile page. From there, click
          &quot;Edit&quot; to update their name, email, role, job title, department, or
          contact details. You can also activate or deactivate their account.
        </p>
        <InfoBox type="info">
          Deactivating a user prevents them from logging in but preserves all
          their historical data and audit trail entries.
        </InfoBox>
      </SubSection>

      <SubSection title="Settings Hub">
        <p className="text-sm text-zinc-600">
          The Settings section groups all administrative modules:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-600">
          {[
            { l: "Staff Directory", d: "Create, edit, and manage user accounts." },
            { l: "Roles & Permissions", d: "Review the access matrix for all roles." },
            { l: "Locations", d: "Manage factory and warehouse locations." },
            { l: "Machinery", d: "Register and manage production machines." },
            { l: "Vendors", d: "Manage material and service vendors." },
            { l: "Zoho Books", d: "Configure and manage the Zoho Books integration." },
            { l: "Task Prerequisites", d: "Configure stage gating rules — which stages must complete before others can start in the Tasks module." },
          ].map(({ l, d }) => (
            <li key={l} className="flex items-start gap-2">
              <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-teal-400" />
              <span>
                <strong className="text-zinc-800">{l}:</strong> {d}
              </span>
            </li>
          ))}
        </ul>
      </SubSection>

      <SubSection title="Deleting a User">
        <InfoBox type="warning">
          Deleting a user is permanent. Their audit log entries will be
          anonymised. Only delete accounts for staff who have permanently left
          the organisation. Consider deactivating instead if there is any doubt.
        </InfoBox>
      </SubSection>
    </div>
  );
}

function AuditLogsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ScrollText}
        title="Audit Trail"
        subtitle="A full history of every change made in the system"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        The Audit Trail records every create, update, and delete action taken by
        any user across all modules. It is immutable — entries cannot be
        modified or deleted. Use it to investigate discrepancies, track
        accountability, and meet compliance requirements.
      </p>

      <InfoBox type="warning">
        This module is restricted to <strong>Administrators</strong> only.
      </InfoBox>

      <SubSection title="Reading an Audit Entry">
        <div className="space-y-2 text-sm text-zinc-600">
          <p>Each row in the audit log contains:</p>
          <ul className="space-y-1.5">
            {[
              {
                f: "Timestamp",
                d: "The exact date and time the action was performed.",
              },
              {
                f: "User",
                d: "The staff member who performed the action, shown by name and Staff ID.",
              },
              {
                f: "Action",
                d: "CREATE (green), UPDATE (blue), or DELETE (red).",
              },
              {
                f: "Entity Type",
                d: "The type of record affected — e.g. Inventory, ProductOrder, User.",
              },
              {
                f: "Entity ID",
                d: "The internal ID of the specific record that was changed.",
              },
              {
                f: "IP Address",
                d: "The IP address from which the action was performed.",
              },
            ].map(({ f, d }) => (
              <li key={f} className="flex items-start gap-2">
                <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-teal-400" />
                <span>
                  <strong className="text-zinc-800">{f}:</strong> {d}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </SubSection>

      <SubSection title="Viewing Change Details">
        <p className="text-sm text-zinc-600">
          Click the <strong>eye icon</strong> or the row expand button on any
          audit entry to open a detail panel. This panel shows the full
          <strong> before and after</strong> snapshot of every field that
          changed in a JSON view. This is particularly useful for update actions
          where you need to see exactly what value was altered.
        </p>
      </SubSection>

      <SubSection title="Filtering the Audit Log">
        <div className="space-y-2 text-sm text-zinc-600">
          <p>Three filters are available at the top of the page:</p>
          <ul className="space-y-1.5">
            {[
              {
                f: "Search",
                d: "Free-text search across entity IDs and user names.",
              },
              {
                f: "Entity Type",
                d: "Filter to a specific record type — User, Inventory, ProductOrder, Operation, etc.",
              },
              {
                f: "Action",
                d: "Filter by CREATE, UPDATE, or DELETE to isolate specific operation types.",
              },
            ].map(({ f, d }) => (
              <li key={f} className="flex items-start gap-2">
                <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-teal-400" />
                <span>
                  <strong className="text-zinc-800">{f}:</strong> {d}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </SubSection>

      <SubSection title="Pagination">
        <p className="text-sm text-zinc-600">
          The audit log loads 50 entries per page. Use the Previous / Next
          buttons at the bottom to navigate through the full history.
        </p>
      </SubSection>

      <InfoBox type="tip">
        If you need to investigate why a production order's cost changed
        unexpectedly, filter by Entity Type → ProductOrder and search for the
        order's ID. You will see every update made to that record.
      </InfoBox>
    </div>
  );
}

function ZohoSettingsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Settings}
        title="Zoho Settings"
        subtitle="Connect and maintain the Zoho Books integration"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        Zoho Books is the external accounting and sales-order system that TPPC
        uses. This settings page lets Administrators authorise the integration
        so that sales orders, inventory items, and locations can be synced
        between the two systems.
      </p>

      <InfoBox type="warning">
        This module is restricted to <strong>Administrators</strong> only.
      </InfoBox>

      <SubSection title="Connecting Zoho Books">
        <div className="space-y-3">
          <Step number={1} title="Navigate to Settings → Zoho Books">
            Click "Zoho Settings" in the left sidebar.
          </Step>
          <Step number={2} title='Click "Connect Zoho Books"'>
            The blue "Connect Zoho Books" button initiates the OAuth 2.0
            authorisation flow. You will be redirected to the Zoho login page.
          </Step>
          <Step number={3} title="Log in and authorise">
            Sign in with the Zoho account that owns the TPPC organisation. Click
            "Allow" to grant the system access to read sales orders and items.
          </Step>
          <Step number={4} title="Verify the connection">
            You are redirected back to the Settings page. The status card should
            now show a green <strong>Connected</strong> badge along with the
            token expiry date.
          </Step>
        </div>
      </SubSection>

      <SubSection title="Token Expiry">
        <p className="text-sm text-zinc-600">
          Zoho access tokens expire periodically. When the token is expired, a
          red <strong>Expired</strong> badge appears. Click{" "}
          <strong>"Reconnect"</strong> to go through the OAuth flow again and
          obtain a fresh token. The system cannot sync sales orders or complete
          production orders (which require a Zoho location) while the token is
          expired.
        </p>
        <InfoBox type="warning">
          If sales orders are not loading or production order completion is
          failing with a Zoho error, check this page first. A reconnection
          usually resolves the problem.
        </InfoBox>
      </SubSection>

      <SubSection title="What the Integration Enables">
        <ul className="space-y-2 text-sm text-zinc-600">
          {[
            "Syncing draft, confirmed, and invoiced sales orders from Zoho Books into the Sales Orders module.",
            "Resolving Zoho item IDs when adding materials to production orders — automatically creating inventory records if they don't yet exist locally.",
            "Fetching active Zoho warehouse/location data when completing a production order.",
            "Updating finished goods stock levels in Zoho Books upon production completion.",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
      </SubSection>
    </div>
  );
}

function RolesSection() {
  const roles = [
    {
      name: "Administrator",
      color: "bg-red-100 text-red-700",
      description:
        "Full read/write/edit access to every module in the application by default. Responsible for system configuration, user management, and overall oversight. Administrator access cannot be restricted.",
      access: [
        "All modules — full read, write, and edit access",
        "Dashboard, Inventory, Production Orders, Tasks, Factory Activity",
        "Sales Orders, Customer Care, Reports, Audit Trail",
        "Settings: Users, Permissions, Locations, Machinery, Vendors, Zoho",
      ],
    },
    {
      name: "General Manager",
      color: "bg-orange-100 text-orange-700",
      description:
        "Broad operational oversight. Can access all production, sales, and reporting modules. Can manage staff accounts and view permissions.",
      access: [
        "Dashboard (view)",
        "Inventory (view + manage)",
        "Production Orders (full CRUD + stage logging)",
        "Tasks (view all + assign)",
        "Factory Activity (view + log)",
        "Sales Orders (view + make to production)",
        "Customer Care (view + follow up)",
        "Reports (view all tabs)",
        "Audit Trail (view)",
        "Settings: Users, Permissions (manage)",
      ],
    },
    {
      name: "Production Manager",
      color: "bg-teal-100 text-teal-700",
      description:
        "Manages production workflow end-to-end. Can create, progress, and close production orders, assign tasks, and log factory activity.",
      access: [
        "Dashboard (view)",
        "Inventory (view + manage)",
        "Production Orders (full CRUD + stage logging)",
        "Tasks (view all + assign)",
        "Factory Activity (view + log)",
        "Customer Care (view)",
        "Reports (view all tabs)",
      ],
    },
    {
      name: "Head of Operations",
      color: "bg-blue-100 text-blue-700",
      description:
        "Oversees factory operations, locations, and logistics. Can manage locations, machinery, vendors, and staff accounts.",
      access: [
        "Dashboard (view)",
        "Inventory (view + manage)",
        "Production Orders (full CRUD + stage logging)",
        "Tasks (view all + assign)",
        "Factory Activity (view + log)",
        "Sales Orders (view + make to production)",
        "Customer Care (view + follow up)",
        "Reports (view all tabs)",
        "Settings: Users, Permissions, Locations, Machinery, Vendors (manage)",
      ],
    },
    {
      name: "Supervisor",
      color: "bg-purple-100 text-purple-700",
      description:
        "Factory floor supervisor. Progresses production orders through stages, assigns tasks, and logs finishing worker activity.",
      access: [
        "Dashboard (view)",
        "Inventory (view)",
        "Production Orders (view + stage logging)",
        "Tasks (view all + assign)",
        "Factory Activity (view + log)",
        "Customer Care (view)",
      ],
    },
    {
      name: "HR Manager",
      color: "bg-indigo-100 text-indigo-700",
      description:
        "Maintains staff records and access rights. Can create, edit, and deactivate user accounts and review role permissions.",
      access: [
        "Dashboard (view)",
        "Settings: Staff Directory (full CRUD)",
        "Settings: Roles & Permissions (view + review)",
      ],
    },
    {
      name: "Head of Finance / Accountant",
      color: "bg-emerald-100 text-emerald-700",
      description:
        "Financial oversight role. Has read-only access to reports for cost analysis, production costing, and financial summaries.",
      access: ["Dashboard (view)", "Reports (view all tabs)"],
    },
    {
      name: "Customer Care Officer",
      color: "bg-sky-100 text-sky-700",
      description:
        "Handles customer care workflows, order follow-up, and delivery coordination. Can view assigned tasks, production orders, and sales orders.",
      access: [
        "Dashboard (view)",
        "Tasks (view assigned only)",
        "Production Orders (view)",
        "Sales Orders (view)",
        "Customer Care (view + follow up)",
      ],
    },
    {
      name: "Logistics Team",
      color: "bg-cyan-100 text-cyan-700",
      description:
        "Handles order dispatch and fulfilment logistics. Can view sales orders, customer care, and assigned tasks.",
      access: [
        "Dashboard (view)",
        "Tasks (view assigned only)",
        "Sales Orders (view)",
        "Customer Care (view)",
      ],
    },
    {
      name: "Design Team",
      color: "bg-pink-100 text-pink-700",
      description:
        "Manages artwork design and CTP operations. Can view production orders and update artwork/CTP stages on assigned tasks.",
      access: [
        "Dashboard (view)",
        "Tasks (view assigned only)",
        "Production Orders (view + artwork/CTP stage logging)",
      ],
    },
    {
      name: "Factory Worker",
      color: "bg-amber-100 text-amber-700",
      description:
        "Views and works on assigned tasks only. Cannot access other modules. Updates task progress, items completed, and items wasted.",
      access: [
        "Dashboard (view)",
        "Tasks (view assigned only + update progress)",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ShieldCheck}
        title="Roles & Permissions"
        subtitle="Understand who can access what in the system"
      />

      <p className="text-sm leading-relaxed text-zinc-600">
        Every user is assigned exactly one role. The role determines which
        navigation items they see in the sidebar and which actions they can
        perform. Attempting to access a page you do not have permission for
        redirects you back to the Dashboard automatically.
      </p>

      <InfoBox type="info">
        The <strong>Administrator</strong> role has full read, write, and edit
        access to every module in the application by default. This cannot be
        restricted. All other roles are scoped to specific modules as shown
        below.
      </InfoBox>

      <InfoBox type="tip">
        Non-management roles (Design Team, Logistics, Factory Workers, Customer
        Care) only see tasks assigned to them in the Tasks module. Management
        roles see all tasks across all orders.
      </InfoBox>

      <div className="space-y-4">
        {roles.map((r) => (
          <div
            key={r.name}
            className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  r.color,
                )}
              >
                {r.name}
              </span>
            </div>
            <p className="mb-3 text-sm text-zinc-600">{r.description}</p>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Access
              </p>
              <ul className="space-y-0.5">
                {r.access.map((a) => (
                  <li
                    key={a}
                    className="flex items-center gap-1.5 text-xs text-zinc-600"
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <InfoBox type="tip">
        If a staff member changes responsibilities — for example a Sales Rep
        being promoted to an Administrator — an Administrator must update their
        role in the Users module. The change takes effect immediately on their
        next page load.
      </InfoBox>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const sectionContent: Record<SectionId, React.ReactNode> = {
  overview: <OverviewSection />,
  dashboard: <DashboardSection />,
  inventory: <InventorySection />,
  locations: <LocationsSection />,
  "production-orders": <ProductionOrdersSection />,
  tasks: <TasksSection />,
  "factory-activity": <FactoryActivitySection />,
  "sales-orders": <SalesOrdersSection />,
  "customer-care": <CustomerCareSection />,
  reports: <ReportsSection />,
  notifications: <NotificationsSection />,
  users: <UsersSection />,
  "audit-logs": <AuditLogsSection />,
  "zoho-settings": <ZohoSettingsSection />,
  roles: <RolesSection />,
};

export default function HelpPage() {
  const [active, setActive] = useState<SectionId>("overview");

  return (
    <div className="flex h-full gap-6">
      {/* Left nav */}
      <aside className="hidden w-52 shrink-0 xl:block">
        <div className="sticky top-0">
          <div className="mb-3 flex items-center gap-2 px-1">
            <HelpCircle className="h-4 w-4 text-teal-500" />
            <p className="text-sm font-semibold text-zinc-700">Help Centre</p>
          </div>
          <nav>
            <ul className="space-y-0.5">
              {sections.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setActive(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all",
                        active === s.id
                          ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          active === s.id ? "text-teal-500" : "text-zinc-400",
                        )}
                      />
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile section picker */}
      <div className="mb-4 xl:hidden">
        <select
          value={active}
          onChange={(e) => setActive(e.target.value as SectionId)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <main className="min-w-0 flex-1">
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          {sectionContent[active]}
        </div>
      </main>
    </div>
  );
}
