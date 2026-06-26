import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  buildOperationServiceSummary,
  getOperationServiceDefinition,
  isOperationServiceStage,
  operationServiceStages,
} from 'src/modules/production-orders/operation-services';
import { getProductionRules } from 'src/modules/production-orders/production-rules';
import {
  ZohoService,
  CompositeItemResponse,
  InventoryListItem,
  ZohoMappedItem,
  ZohoAssemblyLineItem,
  ZohoCompositeMappedItemPayload,
} from './zoho.service';

@Injectable()
export class ZohoSyncService {
  private readonly logger = new Logger(ZohoSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zohoService: ZohoService,
  ) {}

  async getZohoItemById(itemId: string): Promise<ZohoMappedItem | null> {
    try {
      const res = await this.zohoService.getItemInventory(itemId);
      return res?.item ?? null;
    } catch {
      return null;
    }
  }

  async getZohoLocationById(locationId: string) {
    const normalized = locationId?.trim();
    if (!normalized) return null;

    const locations = await this.zohoService.listLocations();
    return (
      locations.find(
        (location) => String(location.location_id) === normalized,
      ) ?? null
    );
  }

  private pickLocation(item: InventoryListItem) {
    const locations = Array.isArray(item.locations) ? item.locations : [];
    const preferred =
      locations.find((location) => location?.is_primary_location) ??
      locations.find((location) => location?.is_primary) ??
      locations[0];

    if (!preferred?.location_id) {
      throw new NotFoundException(
        `Zoho location not found for item ${item.item_name ?? item.name ?? item.item_id}`,
      );
    }

    return {
      location_id: String(preferred.location_id),
      location_name:
        preferred.location_name !== undefined
          ? String(preferred.location_name)
          : undefined,
    };
  }

  private pickAccountId(item: InventoryListItem) {
    const accountId =
      item.account_id !== undefined && item.account_id !== null
        ? String(item.account_id)
        : undefined;

    if (!accountId) {
      throw new NotFoundException(
        `Zoho sales account not found for item ${item.item_name ?? item.name ?? item.item_id}`,
      );
    }

    return accountId;
  }

  private parseNumeric(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  private parseOptionalNumeric(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  }

  private mergeAssemblyLineItem(
    lineItems: ZohoAssemblyLineItem[],
    nextItem: ZohoAssemblyLineItem,
  ) {
    const existing = lineItems.find(
      (item) => item.item_id === nextItem.item_id,
    );
    if (!existing) {
      lineItems.push(nextItem);
      return;
    }

    existing.quantity_consumed += nextItem.quantity_consumed;
  }

  private mergeCompositeMappedItem(
    mappedItems: ZohoCompositeMappedItemPayload[],
    nextItem: ZohoCompositeMappedItemPayload,
  ) {
    const existing = mappedItems.find(
      (item) => item.item_id === nextItem.item_id,
    );
    if (!existing) {
      mappedItems.push(nextItem);
      return;
    }

    existing.quantity += nextItem.quantity;
  }

  private inferLocalItemType(
    itemName: string,
    existingItemType?: string | null,
  ) {
    if (existingItemType && existingItemType.trim().length > 0) {
      return existingItemType;
    }

    const lowerName = itemName.toLowerCase();
    if (
      /paper|board|card|kraft|duplex|newsprint|ivory|chipboard|fbb|bond|sticker|gpp/.test(
        lowerName,
      )
    ) {
      return 'Paper';
    }

    return 'MATERIAL';
  }

  private inferLocalCategory(
    itemName: string,
    existingCategory?: string | null,
  ) {
    if (
      existingCategory &&
      existingCategory.trim().length > 0 &&
      existingCategory !== 'UNCATEGORIZED'
    ) {
      return existingCategory;
    }

    const lowerName = itemName.toLowerCase();

    if (lowerName.includes('kraft')) return 'Kraft Paper';
    if (lowerName.includes('duplex')) return 'Duplex Board';
    if (lowerName.includes('ivory')) return 'Ivory Board';
    if (lowerName.includes('newsprint')) return 'Newsprint';
    if (lowerName.includes('art')) return 'Art Card';
    if (lowerName.includes('board')) return 'Board';
    if (lowerName.includes('paper')) return 'Paper';

    return 'UNCATEGORIZED';
  }

  private async getDefaultServiceAccountTemplate() {
    const items = await this.zohoService.getItemsInventory(1, 200);

    for (const item of items.items) {
      if (!item.itemId) {
        continue;
      }

      const rawItem = await this.zohoService.getItemInventoryRaw(item.itemId);
      const accountId =
        rawItem.account_id !== undefined && rawItem.account_id !== null
          ? String(rawItem.account_id)
          : undefined;

      if (!accountId) {
        continue;
      }

      return {
        accountId,
        purchaseAccountId:
          rawItem.purchase_account_id !== undefined &&
          rawItem.purchase_account_id !== null
            ? String(rawItem.purchase_account_id)
            : undefined,
        inventoryAccountId:
          rawItem.inventory_account_id !== undefined &&
          rawItem.inventory_account_id !== null
            ? String(rawItem.inventory_account_id)
            : undefined,
      };
    }

    throw new NotFoundException(
      'No Zoho inventory item was available to copy GL accounts for operation services',
    );
  }

  async ensureOperationServiceItem(stage: string, defaultRate = 1) {
    if (!isOperationServiceStage(stage)) {
      return { stage, skipped: true };
    }

    const definition = getOperationServiceDefinition(stage);
    if (!definition) {
      return { stage, skipped: true };
    }

    let existing = await this.zohoService.findZohoItemBySku(definition.serviceSku);
    if (!existing) {
      existing = await this.zohoService.findZohoItemByName(definition.serviceName);
    }

    if (existing?.item_id) {
      return {
        stage,
        skipped: false,
        created: false,
        itemId: String(existing.item_id),
        sku: definition.serviceSku,
        name: definition.serviceName,
      };
    }

    const accounts = await this.getDefaultServiceAccountTemplate();
    const created = await this.zohoService.createItemInZoho({
      sku: definition.serviceSku,
      itemName: definition.serviceName,
      description: `Manufacturing service item for ${definition.stageLabel}`,
      price: defaultRate,
      averagePrice: defaultRate,
      itemType: 'service',
      productType: 'service',
      accountId: accounts.accountId,
      purchaseAccountId: accounts.purchaseAccountId,
      inventoryAccountId: accounts.inventoryAccountId,
      trackInventory: false,
    });

    return {
      stage,
      skipped: false,
      created: true,
      itemId: created.itemId ?? null,
      sku: definition.serviceSku,
      name: definition.serviceName,
    };
  }

  async syncOperationServiceCatalog(defaultRate = 1) {
    const items = [] as Array<{
      stage: string;
      skipped: boolean;
      created?: boolean;
      itemId?: string | null;
      sku?: string;
      name?: string;
    }>;

    for (const stage of operationServiceStages) {
      items.push(await this.ensureOperationServiceItem(stage, defaultRate));
    }

    return {
      synced: items.filter((item) => !item.skipped).length,
      created: items.filter((item) => item.created).length,
      items,
    };
  }

  async applyInventoryAdjustments(productOrderId: string, finishedQuantity?: number) {
    this.logger.log(
      `Starting Zoho sync for completed production order ${productOrderId}`,
    );
    await this.syncOperationServiceCatalog();

    const po = await this.prisma.productOrder.findUnique({
      where: { id: productOrderId },
      include: {
        materials: {
          include: { inventory: { select: { sku: true, itemName: true } } },
        },
        product: {
          select: { id: true, sku: true, itemName: true },
        },
        productOrderOperations: {
          select: {
            id: true,
            operationStage: true,
            operationName: true,
            stageStatus: true,
            cutQuantity: true,
            costPerCut: true,
            numberOfDesigns: true,
            ctpPlates: true,
            ctpCostPerColor: true,
            printImpressions: true,
            printCostPerColor: true,
            printCostPerImpression: true,
            costPerDiecut: true,
            laminationType: true,
            glossCost: true,
            matteCost: true,
            laminationSheetsCount: true,
            costPerFinish: true,
            quantityFinished: true,
            // bagBaseSize added by migration 20260606120000 — included after prisma generate runs on server
            twistedHandles: true,
            costPerPackaging: true,
            quantityItemFinished: true,
          },
        },
      },
    });

    if (!po) throw new NotFoundException('Production order not found');

    if (!po.zohoLocationId) {
      throw new NotFoundException(
        'Zoho location not set for this completed production order',
      );
    }

    this.logger.log(
      `Loaded production order ${productOrderId} with ${po.materials.length} material(s) and quantity ${po.quantity}`,
    );

    const productSku = po.product?.sku ?? po.sku;
    const productName = po.product?.itemName ?? po.productName;

    const lineItems: ZohoAssemblyLineItem[] = [];
    const compositeMappedItems: ZohoCompositeMappedItemPayload[] = [];
    let compositeDefaults:
      | {
          unit?: string;
          accountId?: string;
          purchaseAccountId?: string;
          inventoryAccountId?: string;
          rate?: number;
          purchaseRate?: number;
        }
      | undefined;

    for (const material of po.materials) {
      const plannedQuantity = parseFloat(material.quantity.toString());
      const usedQuantity =
        material.quantityUsed !== null && material.quantityUsed !== undefined
          ? parseFloat(material.quantityUsed.toString())
          : 0;
      const quantityConsumed =
        usedQuantity > 0 ? usedQuantity : plannedQuantity;

      if (!Number.isFinite(quantityConsumed) || quantityConsumed <= 0) {
        this.logger.warn(
          `Skipping material ${material.id} because quantity consumed resolved to ${quantityConsumed}`,
        );
        continue;
      }

      const sku = material.inventory?.sku;
      const name = material.inventory?.itemName;
      let zohoItem: InventoryListItem | null = null;

      if (sku) {
        zohoItem = await this.zohoService.findZohoItemBySku(sku);
      }
      if (!zohoItem && name) {
        zohoItem = await this.zohoService.findZohoItemByName(name);
      }

      if (!zohoItem?.item_id) {
        throw new NotFoundException(
          `Zoho item not found for material ${name ?? sku ?? material.id}`,
        );
      }

      this.logger.log(
        `Resolved material ${material.id} (${name ?? sku ?? 'unknown'}) to Zoho item ${zohoItem.item_id} with quantity ${quantityConsumed}`,
      );

      const rawItem = await this.zohoService.getItemInventoryRaw(
        zohoItem.item_id,
      );
      const location = this.pickLocation(rawItem);
      const accountId = this.pickAccountId(rawItem);
      const purchaseAccountId =
        rawItem.purchase_account_id !== undefined &&
        rawItem.purchase_account_id !== null
          ? String(rawItem.purchase_account_id)
          : undefined;
      const inventoryAccountId =
        rawItem.inventory_account_id !== undefined &&
        rawItem.inventory_account_id !== null
          ? String(rawItem.inventory_account_id)
          : undefined;

      if (!compositeDefaults) {
        compositeDefaults = {
          unit: rawItem.unit !== undefined ? String(rawItem.unit) : undefined,
          accountId,
          purchaseAccountId,
          inventoryAccountId,
          rate: this.parseNumeric(rawItem.rate, 0),
          purchaseRate: this.parseNumeric(rawItem.purchase_rate, 0),
        };
      }

      this.mergeAssemblyLineItem(lineItems, {
        item_id: String(rawItem.item_id),
        name: String(
          rawItem.item_name ?? rawItem.name ?? material.inventory?.itemName,
        ),
        quantity_consumed: quantityConsumed,
        account_id: accountId,
        location_id: location.location_id,
      });

      this.mergeCompositeMappedItem(compositeMappedItems, {
        item_id: String(rawItem.item_id),
        line_item_id:
          rawItem.line_item_id !== undefined && rawItem.line_item_id !== null
            ? String(rawItem.line_item_id)
            : undefined,
        name: String(
          rawItem.item_name ?? rawItem.name ?? material.inventory?.itemName,
        ),
        quantity: quantityConsumed,
        sku: rawItem.sku !== undefined ? String(rawItem.sku) : undefined,
        unit: rawItem.unit !== undefined ? String(rawItem.unit) : undefined,
        rate: this.parseOptionalNumeric(rawItem.rate),
        purchase_rate: this.parseOptionalNumeric(rawItem.purchase_rate),
        description:
          rawItem.description !== undefined
            ? String(rawItem.description)
            : undefined,
        is_combo_product:
          rawItem.is_combo_product !== undefined
            ? Boolean(rawItem.is_combo_product)
            : undefined,
      });
    }

    if (lineItems.length === 0) {
      throw new NotFoundException(
        'No material line items were available to create a Zoho assembly',
      );
    }

    if (lineItems.length < po.materials.length) {
      this.logger.warn(
        `Merged duplicate Zoho material components for production order ${productOrderId}; ${po.materials.length} source material row(s) became ${lineItems.length} unique Zoho item(s)`,
      );
    }

    this.logger.log(
      `Prepared ${lineItems.length} Zoho assembly line item(s) for production order ${productOrderId}`,
    );

    // ── Operation service items: add to composite BOM ──────────────────────
    // Compute per-stage service costs from saved operations, resolve each to a
    // Zoho service item, and add to the composite mapped_items (BOM) so that
    // every assembled unit reflects its full manufacturing cost in Zoho Books.
    const orderQty = (po.quantity ?? 0) > 0 ? po.quantity : 1;
    const operationServices = buildOperationServiceSummary(
      po.productOrderOperations ?? [],
      po.quantity ?? 0,
    );

    type ServiceRef = {
      itemId: string;
      name: string;
      sku: string;
      perUnitCost: number;
      accountId?: string;
    };
    const resolvedServices: ServiceRef[] = [];

    for (const svc of operationServices.items) {
      if (svc.totalCost <= 0) continue;
      try {
        const zohoSvcItem = await this.zohoService.findZohoItemBySku(
          svc.serviceSku,
        );
        if (!zohoSvcItem?.item_id) {
          this.logger.warn(
            `Zoho service item not found for SKU ${svc.serviceSku} — skipping from assembly`,
          );
          continue;
        }
        // Fetch the raw item so we use the SERVICE's own GL account on the
        // bundle line_item (services post to a P&L/COGS account, not the
        // inventory sales account of a paper component).
        const rawSvc = await this.zohoService.getItemInventoryRaw(
          String(zohoSvcItem.item_id),
        );
        const svcAccountId =
          rawSvc.purchase_account_id !== undefined &&
          rawSvc.purchase_account_id !== null
            ? String(rawSvc.purchase_account_id)
            : rawSvc.account_id !== undefined && rawSvc.account_id !== null
              ? String(rawSvc.account_id)
              : undefined;
        const perUnitCost = Number((svc.totalCost / orderQty).toFixed(2));
        resolvedServices.push({
          itemId: String(zohoSvcItem.item_id),
          name: svc.serviceName,
          sku: svc.serviceSku,
          perUnitCost,
          accountId: svcAccountId,
        });
        // Add to composite BOM: services on mapped_items only need item_id +
        // quantity. Zoho derives rate/unit from the item itself; passing rate
        // here is not part of the documented contract.
        this.mergeCompositeMappedItem(compositeMappedItems, {
          item_id: String(zohoSvcItem.item_id),
          name: svc.serviceName,
          sku: svc.serviceSku,
          quantity: 1,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to resolve Zoho service item ${svc.serviceSku}: ${
            err instanceof Error ? err.message : String(err)
          } — skipping`,
        );
      }
    }

    if (resolvedServices.length > 0) {
      this.logger.log(
        `Added ${resolvedServices.length} operation service item(s) to composite BOM for production order ${productOrderId}`,
      );
    }
    // ──────────────────────────────────────────────────────────────────────────

    let compositeItem: CompositeItemResponse | null = null;
    if (productSku) {
      compositeItem = await this.zohoService.findCompositeItemBySku(productSku);
    }
    if (!compositeItem && productName) {
      compositeItem =
        await this.zohoService.findCompositeItemByName(productName);
    }

    this.logger.log(
      compositeItem
        ? `Found existing Zoho composite item ${compositeItem.composite_item_id} for ${productName ?? productSku}`
        : `No existing Zoho composite item found for ${productName ?? productSku}. A new one will be created.`,
    );

    const compositeRate =
      po.quantity > 0
        ? this.parseNumeric(po.grandTotal?.toString?.() ?? po.subtotal, 0) /
          po.quantity
        : 0;
    const compositePurchaseRate =
      po.quantity > 0
        ? this.parseNumeric(po.subtotal?.toString?.() ?? 0, 0) / po.quantity
        : 0;

    const compositePayload = {
      name: productName ?? compositeItem?.name ?? productSku ?? productOrderId,
      description: po.notes ?? `Generated from production order ${po.id}`,
      sku: productSku ?? compositeItem?.sku ?? undefined,
      mapped_items: compositeMappedItems.map((item) => {
        const existing = compositeItem?.mapped_items?.find(
          (mapped) => String(mapped.item_id) === item.item_id,
        );
        return {
          ...item,
          line_item_id:
            existing?.line_item_id !== undefined
              ? String(existing.line_item_id)
              : item.line_item_id,
        };
      }),
      is_combo_product: true,
      item_type: 'inventory' as const,
      product_type: 'goods' as const,
      unit: compositeItem?.unit ?? compositeDefaults?.unit ?? undefined,
      rate: compositeItem?.rate ?? compositeRate,
      purchase_rate: compositeItem?.purchase_rate ?? compositePurchaseRate,
      purchase_description:
        po.notes ?? `Materials consumed for production order ${po.id}`,
      account_id:
        compositeItem?.account_id !== undefined &&
        compositeItem?.account_id !== null
          ? String(compositeItem.account_id)
          : compositeDefaults?.accountId,
      purchase_account_id:
        compositeItem?.purchase_account_id !== undefined &&
        compositeItem?.purchase_account_id !== null
          ? String(compositeItem.purchase_account_id)
          : compositeDefaults?.purchaseAccountId,
      inventory_account_id:
        compositeItem?.inventory_account_id !== undefined &&
        compositeItem?.inventory_account_id !== null
          ? String(compositeItem.inventory_account_id)
          : compositeDefaults?.inventoryAccountId,
    };

    compositeItem = compositeItem
      ? await this.zohoService.updateCompositeItemInZoho(
          String(compositeItem.composite_item_id),
          compositePayload,
        )
      : await this.zohoService.createCompositeItemInZoho(compositePayload);

    this.logger.log(
      `Composite item ready for production order ${productOrderId}: ${compositeItem.composite_item_id} (${compositeItem.name})`,
    );

    // Delta logic: only push what hasn't been pushed yet
    // finishedQuantity (from partial FINISHING saves) takes precedence over order quantity
    const alreadyPushed = po.quantityPushedToZoho ?? 0;
    const totalFinished = finishedQuantity ?? po.quantity ?? 0;
    const deltaToPush = totalFinished - alreadyPushed;

    if (deltaToPush <= 0) {
      this.logger.log(
        `No delta to push for production order ${productOrderId} (already pushed ${alreadyPushed}/${totalFinished})`,
      );
      return { adjusted: false, reason: 'nothing_to_push' };
    }

    // Add service items to assembly line_items so Zoho captures the full
    // production cost for this specific delta batch. Each service uses its
    // own GL account (resolved above) — do NOT borrow the paper component's
    // account, and do NOT pass a warehouse location_id (services aren't
    // stocked per location).
    for (const svc of resolvedServices) {
      const accountForSvc = svc.accountId ?? compositeDefaults?.accountId;
      if (!accountForSvc) {
        this.logger.warn(
          `Skipping service ${svc.sku} from assembly — no GL account available`,
        );
        continue;
      }
      this.mergeAssemblyLineItem(lineItems, {
        item_id: svc.itemId,
        name: svc.name,
        quantity_consumed: deltaToPush,
        account_id: accountForSvc,
        rate: svc.perUnitCost,
      });
    }

    const assembly = await this.zohoService.createAssemblyInZoho({
      date: po.updatedAt.toISOString().slice(0, 10),
      description: `Production order ${po.id} completed for ${productName ?? compositeItem.name} (delta: ${deltaToPush})`,
      location_id: po.zohoLocationId,
      composite_item_id: String(compositeItem.composite_item_id),
      composite_item_name: compositeItem.name,
      composite_item_sku: compositeItem.sku ?? undefined,
      quantity_to_bundle: deltaToPush,
      line_items: lineItems,
      is_completed: true,
    });

    this.logger.log(
      `Assembly created for production order ${productOrderId}: ${assembly.bundle_id} (pushed ${deltaToPush} units)`,
    );

    await this.prisma.productOrder.update({
      where: { id: po.id },
      data: {
        zohoSyncedAt: new Date(),
        quantityPushedToZoho: alreadyPushed + deltaToPush,
      },
    });

    return {
      adjusted: true,
      assembly,
      compositeItem: {
        compositeItemId: String(compositeItem.composite_item_id),
        name: compositeItem.name,
        sku: compositeItem.sku ?? null,
      },
    };
  }

  /**
   * Push a delta of finished items to Zoho Books when a FINISHING operation is saved.
   * Only pushes the difference between current quantityFinished and what was previously pushed.
   */
  async pushFinishingDelta(
    productOrderId: string,
    currentQuantityFinished: number,
  ): Promise<{ pushed: boolean; delta?: number; error?: string }> {
    const po = await this.prisma.productOrder.findUnique({
      where: { id: productOrderId },
      select: {
        id: true,
        quantityPushedToZoho: true,
        zohoLocationId: true,
        status: true,
      },
    });

    if (!po) return { pushed: false, error: 'Production order not found' };
    if (!po.zohoLocationId) {
      return { pushed: false, error: 'Zoho location not set' };
    }

    const alreadyPushed = po.quantityPushedToZoho ?? 0;
    const delta = currentQuantityFinished - alreadyPushed;

    if (delta <= 0) {
      this.logger.log(
        `No finishing delta to push for ${productOrderId} (finished=${currentQuantityFinished}, alreadyPushed=${alreadyPushed})`,
      );
      return { pushed: false, delta: 0 };
    }

    this.logger.log(
      `Pushing finishing delta of ${delta} units to Zoho for production order ${productOrderId}`,
    );

    try {
      const result = await this.applyInventoryAdjustments(
        productOrderId,
        currentQuantityFinished,
      );
      return { pushed: true, delta, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to push finishing delta for ${productOrderId}: ${message}`,
      );
      return { pushed: false, delta, error: message };
    }
  }

  async syncAllItemsToLocal(fetchPerPage = 200) {
    const items = await this.zohoService.loadAllZohoItems(fetchPerPage);
    let synced = 0;
    const errors: string[] = [];

    for (const it of items) {
      try {
        const sku = (it.sku ?? '').toString().trim();
        const resolvedSku = sku.length > 0 ? sku : `ZOHO-${it.itemId ?? ''}`;
        const itemName = it.itemName ?? it.name ?? 'Unknown';
        const quantityInStock = Math.round(Number(it.stockOnHand ?? 0));
        const averagePrice = it.purchaseRate ?? 0;
        const price = it.rate ?? 0;
        const now = new Date();
        const existing = await this.prisma.inventory.findUnique({
          where: { sku: resolvedSku },
          select: { itemType: true, category: true },
        });
        const itemType = this.inferLocalItemType(itemName, existing?.itemType);
        const category = this.inferLocalCategory(itemName, existing?.category);

        await this.prisma.inventory.upsert({
          where: { sku: resolvedSku },
          update: {
            itemName,
            itemType,
            category,
            quantityInStock,
            averagePrice,
            price,
            lastRestockDate: now,
            updatedAt: now,
          },
          create: {
            sku: resolvedSku,
            itemName,
            itemType,
            category,
            quantityInStock,
            averagePrice,
            price,
            receivedDate: now,
            lastRestockDate: now,
          },
        });

        synced++;
      } catch (err) {
        errors.push(String(err));
      }
    }

    return { synced, errorsCount: errors.length };
  }

  /**
   * Compare the app's hardcoded materials (papers) and operation services
   * against what currently exists in the connected Zoho Books org.
   * Used by the Zoho Gap Analysis page so users can see which items need to be
   * created in Zoho before assemblies can succeed.
   */
  async getMaterialGapAnalysis() {
    const [zohoItems, compositeItems, rules] = await Promise.all([
      this.zohoService.loadAllZohoItems(),
      this.zohoService.loadAllZohoCompositeItems(),
      Promise.resolve(getProductionRules()),
    ]);

    const norm = (s?: string | null) =>
      (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const compact = (s?: string | null) =>
      norm(s).replace(/[^a-z0-9]/g, '');

    type MatchResult = {
      found: boolean;
      matchType: 'exact' | 'case-insensitive' | 'partial' | 'sku' | 'none';
      zohoItemId?: string;
      zohoItemName?: string;
      zohoSku?: string;
      stockOnHand?: number | null;
      availableStock?: number | null;
    };

    const findByNameOrSku = (
      expectedName: string,
      expectedSku?: string,
    ): MatchResult => {
      const targetName = norm(expectedName);
      const targetCompact = compact(expectedName);
      const targetSku = norm(expectedSku);

      const stockFor = (it: { stockOnHand?: number; availableStock?: number }) => ({
        stockOnHand:
          typeof it.stockOnHand === 'number' ? it.stockOnHand : null,
        availableStock:
          typeof it.availableStock === 'number' ? it.availableStock : null,
      });

      if (targetSku) {
        const skuHit = zohoItems.find((it) => norm(it.sku) === targetSku);
        if (skuHit) {
          return {
            found: true,
            matchType: 'sku',
            zohoItemId: String(skuHit.itemId ?? ''),
            zohoItemName: skuHit.itemName ?? skuHit.name ?? '',
            zohoSku: skuHit.sku ?? undefined,
            ...stockFor(skuHit),
          };
        }
      }

      const exact = zohoItems.find(
        (it) => (it.itemName ?? it.name) === expectedName,
      );
      if (exact) {
        return {
          found: true,
          matchType: 'exact',
          zohoItemId: String(exact.itemId ?? ''),
          zohoItemName: exact.itemName ?? exact.name ?? '',
          zohoSku: exact.sku ?? undefined,
          ...stockFor(exact),
        };
      }

      const ci = zohoItems.find(
        (it) => norm(it.itemName ?? it.name) === targetName,
      );
      if (ci) {
        return {
          found: true,
          matchType: 'case-insensitive',
          zohoItemId: String(ci.itemId ?? ''),
          zohoItemName: ci.itemName ?? ci.name ?? '',
          zohoSku: ci.sku ?? undefined,
          ...stockFor(ci),
        };
      }

      const partial = zohoItems.find((it) => {
        const cand = compact(it.itemName ?? it.name);
        return (
          cand.length > 0 &&
          (cand.includes(targetCompact) || targetCompact.includes(cand))
        );
      });
      if (partial) {
        return {
          found: false,
          matchType: 'partial',
          zohoItemId: String(partial.itemId ?? ''),
          zohoItemName: partial.itemName ?? partial.name ?? '',
          zohoSku: partial.sku ?? undefined,
          ...stockFor(partial),
        };
      }

      return { found: false, matchType: 'none' };
    };

    const papers = rules.paperItems.map((p) => {
      const expectedName = p.itemName ?? p.paperType;
      const match = findByNameOrSku(expectedName, p.sku ?? undefined);
      return {
        paperType: p.paperType,
        expectedName,
        expectedSku: p.sku ?? null,
        sourceSheetSize: p.sourceSheetSizeLabel,
        costPerSheet: p.costPerSheet,
        ...match,
      };
    });

    const services = operationServiceStages.map((stage) => {
      const def = getOperationServiceDefinition(stage)!;
      const match = findByNameOrSku(def.serviceName, def.serviceSku);
      return {
        stage,
        stageLabel: def.stageLabel,
        expectedName: def.serviceName,
        expectedSku: def.serviceSku,
        ...match,
      };
    });

    return {
      summary: {
        zohoItemCount: zohoItems.length,
        compositeItemCount: compositeItems.length,
        papersTotal: papers.length,
        papersFound: papers.filter((p) => p.found).length,
        papersMissing: papers.filter((p) => !p.found).length,
        servicesTotal: services.length,
        servicesFound: services.filter((s) => s.found).length,
        servicesMissing: services.filter((s) => !s.found).length,
      },
      papers,
      services,
      compositeItems: compositeItems.map((c) => ({
        compositeItemId: String(c.composite_item_id ?? ''),
        name: c.name ?? '',
        sku: c.sku ?? null,
        rate: c.rate ?? null,
        stockOnHand:
          typeof c.stock_on_hand === 'number' ? c.stock_on_hand : null,
        availableStock:
          typeof c.available_stock === 'number' ? c.available_stock : null,
        actualAvailableStock:
          typeof c.actual_available_stock === 'number'
            ? c.actual_available_stock
            : null,
      })),
    };
  }
}
