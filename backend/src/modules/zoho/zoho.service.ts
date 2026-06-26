import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Cache } from 'cache-manager';
import {
  decryptToken,
  encryptToken,
} from 'src/common/encryption/token-encryptor.service';
import { PrismaService } from 'src/prisma.service';

export interface PriceBracket {
  start_quantity: number;
  end_quantity: number;
  pricebook_rate: number;
}

export interface Tag {
  tag_option_id: string;
  is_tag_mandatory: boolean;
  tag_name: string;
  tag_id: string;
  tag_option_name: string;
}

export interface LockDetails {
  can_lock: boolean;
}

export interface CustomLock {
  locked_fields: Record<string, any>;
  locked_actions: any[];
  lock_details: LockDetails;
}

export interface CustomField {
  field_id: string;
  customfield_id: string;
  show_in_store: boolean;
  show_in_portal: boolean;
  is_active: boolean;
  index: number;
  label: string;
  show_on_pdf: boolean;
  edit_on_portal: boolean;
  edit_on_store: boolean;
  api_name: string;
  show_in_all_pdf: boolean;
  value_formatted: string;
  search_entity: string;
  data_type: string;
  placeholder: string;
  value: string;
  is_dependent_field: boolean;
}

export interface Location {
  location_id: string;
  location_name: string;
  status: string;
  is_primary: boolean;
  is_primary_location: boolean;
  is_item_mapped: boolean;
  location_asset_value: number;
  location_stock_on_hand: number;
  initial_stock: number;
  initial_stock_rate: number;
  location_available_stock: number;
  location_actual_available_stock: number;
  location_committed_stock: number;
  location_actual_committed_stock: number;
  location_available_for_sale_stock: number;
  location_actual_available_for_sale_stock: number;
  location_quantity_in_transit: number;
  serial_numbers: any[];
  serial_number_details: any[];
  batches: any[];
  storages: any[];
  is_storage_location_enabled: boolean;
  default_storage: string;
  is_general_location: boolean;
  sales_channels: any[];
}

export interface PackageDetails {
  length: string;
  width: string;
  height: string;
  weight: string;
  weight_unit: string;
  dimension_unit: string;
}

export interface InventoryItemsResponse {
  code: number;
  message: string;
  items: InventoryListItem[];
  page_context: PageContext;
}

export interface InventorySearchResponse {
  code?: number;
  message?: string;
  items?: InventoryListItem[];
}

export interface ZohoLocationsResponse {
  code?: number;
  message?: string;
  locations?: Location[];
}

export interface ZohoItemsResult {
  items: ZohoMappedItem[];
  page: number;
  perPage: number;
}
export interface ZohoCompositeItemsResult {
  items: CompositeItemResponse[];
  page: number;
  perPage: number;
}
export interface ZohoAssembliesResult {
  items: ZohoAssembly[];
  page: number;
  perPage: number;
  compositeItemId: string;
}

export interface InventoryListItem {
  item_id: string;
  name: string;
  item_name: string;
  sku: string;
  rate: number;
  stock_on_hand?: number;
  available_stock?: number;
  actual_available_stock?: number;
  locations?: Location[];
  created_time?: string;
  last_modified_time?: string;
  // dynamic
  [key: string]: any;
}

export interface PageContext {
  page: number;
  per_page: number;
  has_more_page: boolean;
  report_name: string;
  applied_filter: string;
  custom_fields: any[];
  sort_column: string;
  sort_order: string;
}

export interface SalesOrderSummary {
  salesorder_id: string;
  salesorder_number: string;
  customer_name?: string;
  customer_id?: string;
  status?: string;
  date?: string;
  shipment_date?: string | null;
  reference_number?: string;
  currency_code?: string;
  sub_total?: number;
  total?: number;
}

export interface SalesOrderListResponse {
  code?: number;
  salesorders: SalesOrderSummary[];
}

export interface SalesOrderLineItem {
  line_item_id: string;
  item_id: string;
  name: string;
  sku?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  total?: number;
  unit?: string;
}

export interface SalesOrderDetailResponse {
  code?: number;
  salesorder: {
    salesorder_id: string;
    salesorder_number: string;
    customer_name?: string;
    customer_id?: string;
    status?: string;
    date?: string;
    shipment_date?: string | null;
    reference_number?: string;
    currency_code?: string;
    sub_total?: number;
    total?: number;
    notes?: string | null;
    line_items?: SalesOrderLineItem[];
  };
}

export interface InventoryItemResponse {
  code?: number;
  message?: string;
  item: InventoryListItem;
}

export interface ZohoAssemblyLineItem {
  item_id: string;
  line_item_id?: string;
  name: string;
  description?: string;
  quantity_consumed: number;
  unit?: string;
  account_id: string;
  account_name?: string;
  location_id?: string;
  location_name?: string;
  rate?: number;
}

export interface ZohoAssembly {
  bundle_id: string;
  reference_number?: string;
  date: string;
  description?: string;
  location_id?: string;
  composite_item_id: string;
  composite_item_name: string;
  composite_item_sku?: string;
  quantity_to_bundle: number;
  line_items: ZohoAssemblyLineItem[];
  is_completed: boolean;
}

export interface ZohoAssemblyListResponse {
  code?: number;
  message?: string;
  bundles?: ZohoAssembly[];
}

export interface ZohoAssemblyFetchResponse {
  code?: number;
  message?: string;
  bundle?: ZohoAssembly;
}

export interface ZohoCreateAssemblyPayload {
  reference_number?: string;
  date: string;
  description?: string;
  location_id?: string;
  composite_item_id: string;
  composite_item_name: string;
  composite_item_sku?: string;
  quantity_to_bundle: number;
  line_items: ZohoAssemblyLineItem[];
  is_completed: boolean;
}

export interface ZohoCompositeMappedItemPayload {
  item_id: string;
  quantity: number;
  line_item_id?: string;
  name?: string;
  rate?: number;
  purchase_rate?: number;
  sku?: string;
  unit?: string;
  description?: string;
  is_combo_product?: boolean;
}

export interface ZohoCreateCompositeItemPayload {
  name: string;
  mapped_items: ZohoCompositeMappedItemPayload[];
  description?: string;
  is_combo_product?: boolean;
  purchase_rate?: number;
  purchase_description?: string;
  sku?: string;
  unit?: string;
  item_type?: 'inventory' | 'service' | 'non-inventory';
  rate?: number;
  account_id?: string;
  purchase_account_id?: string;
  inventory_account_id?: string;
  product_type?: 'goods' | 'service';
}

export interface ZohoMappedItem {
  itemId?: string;
  name?: string;
  itemName?: string;
  sku?: string;
  description?: string;
  rate?: number;
  purchaseRate?: number;
  stockOnHand?: number;
  availableStock?: number;
  actualAvailableStock?: number;
  locations?: unknown[];
  createdTime?: string;
  lastModifiedTime?: string;
}
export interface ZohoCompositeItemFetchResponse {
  code: number;
  message: string;
  composite_items: CompositeItemResponse[];
}

export interface CompositeItem {
  composite_item_id: number;
  name: string;
  status: 'active' | 'inactive'; // Adjusted based on standard API patterns
  source: string;
  description: string;
  rate: number;
  tax_id: number;
  tax_name: string;
  tax_percentage: number;
  purchase_description: string;
  purchase_rate: number;
  is_combo_product: boolean;
  item_type: 'inventory' | 'service' | 'non-inventory';
  product_type: 'goods' | 'service';
  is_taxable: boolean;
  stock_on_hand: number;
  available_stock: number;
  actual_available_stock: number;
  sku: string;
  upc: number;
  ean: number;
  isbn: number;
  part_number: string;
  reorder_level: number;
  image_id: number;
  image_name: string;
  created_time: string; // Typically ISO date strings
  last_modified_time: string;
}

export interface CompositeItemResponse {
  code: number;
  message: string;
  composite_item_id: number;
  name: string;
  status: 'active' | 'inactive';
  source: string;
  unit: string;
  tax_id: number;
  description: string;
  tax_name: string;
  tax_percentage: number;
  tax_type: string;
  purchase_account_id: number;
  purchase_account_name: string;
  account_id: number;
  account_name: string;
  inventory_account_id: number;
  inventory_account_name: string;
  is_combo_product: boolean;
  item_type: 'inventory' | 'service' | 'non-inventory';
  rate: number;
  pricebook_rate: number;
  purchase_rate: number;
  reorder_level: number;
  initial_stock: number;
  initial_stock_rate: number;
  vendor_id: number;
  vendor_name: string;
  stock_on_hand: number;
  asset_value: number;
  available_stock: number;
  actual_available_stock: number;
  sku: string;
  upc: number;
  ean: number;
  isbn: number;
  part_number: string;
  image_id: number;
  image_name: string;
  purchase_description: string;
  hsn_or_sac: number;
  custom_fields: CompostiteCustomField[];
  mapped_items: MappedItem[];
  item_tax_preferences: ItemTaxPreference[];
}

export interface CompostiteCustomField {
  custom_field_id: number;
  value: string | number;
  index: number;
  label: string;
}

export interface MappedItem {
  line_item_id: number;
  item_id: number;
  name: string;
  rate: number;
  purchase_rate: number;
  sku: string;
  image_id: number;
  image_name: string;
  purchase_description: string;
  image_type: string;
  unit: string;
  is_combo_product: boolean;
  description: string;
  quantity: number;
  stock_on_hand: number;
  available_stock: number;
  actual_available_stock: number;
}

export interface ItemTaxPreference {
  tax_id: number;
  tax_specification: string;
}
export interface ZohoItemFetchResponse {
  item: ZohoMappedItem;
  synced?: { updated: boolean; inventoryId?: string };
}

type CacheClient = {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(
    key: string,
    value: T,
    options?: { ttl: number } | number,
  ): Promise<void> | void;
  del(key: string): Promise<void> | void;
};

@Injectable()
export class ZohoService {
  private readonly baseUrl = 'https://accounts.zoho.com/oauth/v2';
  private readonly booksApiUrl = 'https://www.zohoapis.com/books/v3';
  private readonly inventoryApiUrl = 'https://www.zohoapis.com/inventory/v1';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUrl: string;
  private readonly scope: string;
  private readonly organizationId: string;
  private readonly logger = new Logger(ZohoService.name);
  private readonly ALL_ITEMS_CACHE_KEY = 'zoho:all_items_v1';
  private readonly ALL_COMPOSITE_ITEMS_CACHE_KEY =
    'zoho:all_composite_items_v1';

  private cacheClient(): CacheClient {
    return this.cacheManager as unknown as CacheClient;
  }

  private formatError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data: unknown = err.response?.data;
      const url = err.config?.url;
      const method = err.config?.method?.toUpperCase();
      const base = err.message || 'Axios request failed';

      if (data !== undefined) {
        try {
          return `${base}${status ? ` (status ${status})` : ''}${method || url ? ` [${method ?? 'REQUEST'} ${url ?? ''}]` : ''}: ${JSON.stringify(data)}`;
        } catch {
          return `${base}${status ? ` (status ${status})` : ''}`;
        }
      }

      return `${base}${status ? ` (status ${status})` : ''}`;
    }

    if (err instanceof Error) {
      return err.message + (err.stack ? `\n${err.stack}` : '');
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  /**
   * Extracts the Zoho error code and message from an axios error and throws
   * a meaningful BadRequestException instead of a generic 500.
   *
   * Common Zoho error codes:
   *   6041 – user not associated with the organization (wrong ZOHO_ORGANIZATION_ID)
   *   57   – authentication failure (stale/wrong token)
   *   1003 – access denied / insufficient scope
   */
  private throwZohoError(err: unknown, context: string): never {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data as
        | Record<string, unknown>
        | undefined;
      const zohoCode = data?.code;
      const zohoMessage = String(data?.message ?? err.message ?? 'Unknown error');

      if (zohoCode === 6041) {
        throw new BadRequestException(
          `[Zoho ${context}] Organization mismatch (code 6041): The connected account does not belong to ` +
            `organization ID "${this.organizationId}". ` +
            `Your ZOHO_ORGANIZATION_ID env var must be updated to the LIVE account\'s org ID. ` +
            `Call GET /api/zoho/diagnose to see which org IDs your token has access to, then ` +
            `update ZOHO_ORGANIZATION_ID and restart the backend.`,
        );
      }

      if (zohoCode === 57 || status === 401) {
        throw new BadRequestException(
          `[Zoho ${context}] Authentication failed (code ${String(zohoCode ?? 401)}): ` +
            `The access token may belong to a different Zoho account. ` +
            `Go to Settings → Zoho Integration and reconnect.`,
        );
      }

      if (zohoCode === 1003 || status === 403) {
        throw new BadRequestException(
          `[Zoho ${context}] Access denied (code ${String(zohoCode ?? 403)}): ${zohoMessage}. ` +
            `Ensure the OAuth scope includes ZohoBooks.fullaccess.all.`,
        );
      }

      throw new BadRequestException(
        `[Zoho ${context}] API error: code=${String(zohoCode ?? 'unknown')}, ` +
          `message="${zohoMessage}"` +
          (status ? `, httpStatus=${status}` : ''),
      );
    }

    if (err instanceof HttpException) throw err;
    throw new BadRequestException(
      `[Zoho ${context}] Unexpected error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.clientId = this.config.getOrThrow<string>('zoho.client_id');
    this.clientSecret = this.config.getOrThrow<string>('zoho.client_secret');
    this.redirectUrl = this.config.getOrThrow<string>('zoho.redirect_url');
    this.scope = this.config.getOrThrow<string>('zoho.scope');
    this.organizationId = this.config.getOrThrow<string>(
      'zoho.organization_id',
    );
  }

  getOauthCode() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUrl,
      scope: this.scope,
      access_type: 'offline',
      prompt: 'consent',
    });
    return { authUrl: `${this.baseUrl}/auth?${params.toString()}` };
  }

  async getConnectionStatus() {
    const record = await this.prisma.zohoOauth.findUnique({
      where: { id: 'singleton' },
      select: { expiresAt: true },
    });
    if (!record) return { connected: false };
    return { connected: true, expiresAt: record.expiresAt };
  }

  /**
   * Diagnostic endpoint: calls Zoho /organizations to return which org IDs
   * the current token has access to, and compares against the configured
   * ZOHO_ORGANIZATION_ID. Use this when you get 500s after switching accounts.
   */
  async diagnose() {
    const accessToken = await this.getValidAccessToken();

    type ZohoOrg = {
      organization_id: string;
      name: string;
      is_default_org?: boolean;
      country?: string;
      currency_code?: string;
    };

    let organizations: ZohoOrg[] = [];
    let orgFetchError: string | null = null;

    try {
      const orgResponse = await axios.get<{ organizations: ZohoOrg[] }>(
        `${this.booksApiUrl}/organizations`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
      );
      organizations = orgResponse.data.organizations ?? [];
    } catch (err) {
      orgFetchError = this.formatError(err);
    }

    const configured = this.organizationId;
    const match = organizations.find((o) => o.organization_id === configured);

    return {
      configuredOrganizationId: configured,
      configuredOrgFound: !!match,
      configuredOrgName: match?.name ?? null,
      availableOrganizations: organizations.map((o) => ({
        organization_id: o.organization_id,
        name: o.name,
        country: o.country ?? null,
        currency_code: o.currency_code ?? null,
        is_default: o.is_default_org ?? false,
        isCurrentlyConfigured: o.organization_id === configured,
      })),
      orgFetchError,
      diagnosis: match
        ? `✅ ZOHO_ORGANIZATION_ID "${configured}" matches the connected account ("${match.name}").`
        : organizations.length > 0
          ? `❌ ZOHO_ORGANIZATION_ID "${configured}" does NOT match any available organization. ` +
            `Update the env var to one of the organization_id values listed in availableOrganizations, ` +
            `then restart the backend.`
          : `⚠️  Could not retrieve organizations. Check that the token is valid and the scope includes ZohoBooks.fullaccess.all. Error: ${orgFetchError ?? 'none'}`,
    };
  }

  async getZohoTokens(code: string) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUrl,
    });
    try {
      const response = await axios.post<{
        access_token?: string;
        refresh_token?: string;
        api_domain?: string;
        token_type?: string;
        expires_in?: number;
        error?: string;
      }>(`${this.baseUrl}/token`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = response.data;

      if (data.error || !data.access_token) {
        throw new BadRequestException(
          `Zoho token exchange failed: ${data.error ?? 'missing access token in response'}`,
        );
      }

      const encryptedAccessToken = encryptToken(data.access_token);
      const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

      if (data.refresh_token) {
        const encryptedRefreshToken = encryptToken(data.refresh_token);
        await this.prisma.zohoOauth.upsert({
          where: { id: 'singleton' },
          update: {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
          },
          create: {
            id: 'singleton',
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
          },
        });
      } else {
        const existing = await this.prisma.zohoOauth.findUnique({
          where: { id: 'singleton' },
        });
        if (!existing?.refreshToken) {
          throw new BadRequestException(
            'Zoho did not return a refresh token and none is stored. Please revoke app access in Zoho and reconnect.',
          );
        }
        await this.prisma.zohoOauth.update({
          where: { id: 'singleton' },
          data: { accessToken: encryptedAccessToken, expiresAt },
        });
      }

      return { access_token: data.access_token, expires_in: data.expires_in };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(error);
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const zohoOauth = await this.prisma.zohoOauth.findUnique({
      where: { id: 'singleton' },
    });

    if (!zohoOauth) throw new BadRequestException('Token not found');
    if (!zohoOauth.refreshToken)
      throw new BadRequestException('Token not found');
    const decryptedToken = decryptToken(zohoOauth.refreshToken);

    if (refreshToken !== decryptedToken)
      throw new UnauthorizedException('Unauthorized');

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: decryptedToken,
    });

    const response = await axios.post<{
      access_token?: string;
      api_domain?: string;
      token_type?: string;
      expires_in?: number;
      error?: string;
    }>(`${this.baseUrl}/token`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // Zoho returns 200 even on failure (e.g. invalid_grant when the refresh
    // token belongs to a different account or has been revoked). Guard before
    // passing undefined into AES encryption.
    if (response.data.error || !response.data.access_token) {
      throw new BadRequestException(
        `Zoho token refresh failed: "${
          response.data.error ?? 'no access_token in response'
        }". The stored refresh token is invalid or belongs to a different ` +
          `Zoho account. Go to Settings \u2192 Zoho Integration and click ` +
          `"Connect to Zoho Books" to obtain a fresh token pair.`,
      );
    }

    const encryptedAccessToken = encryptToken(response.data.access_token);
    const expiresAt = new Date(Date.now() + (response.data.expires_in ?? 3600) * 1000);

    await this.prisma.zohoOauth.update({
      where: { id: 'singleton' },
      data: { accessToken: encryptedAccessToken, expiresAt },
    });

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in ?? 3600,
    };
  }

  async getValidAccessToken(): Promise<string> {
    const zohoOauth = await this.prisma.zohoOauth.findUnique({
      where: { id: 'singleton' },
    });

    if (!zohoOauth) throw new BadRequestException('Zoho OAuth not configured');

    // Guard against a missing refresh token (e.g. DB was seeded without one)
    if (!zohoOauth.refreshToken) {
      throw new BadRequestException(
        'No Zoho refresh token stored. Go to Settings \u2192 Zoho Integration ' +
          'and click "Connect to Zoho Books" to authenticate.',
      );
    }

    const isExpired = new Date() >= zohoOauth.expiresAt;

    if (!isExpired) {
      return decryptToken(zohoOauth.accessToken);
    }

    const decryptedRefreshToken = decryptToken(zohoOauth.refreshToken);
    const result = await this.refreshAccessToken(decryptedRefreshToken);
    return result.access_token;
  }

  async listSalesOrders(page = 1, perPage = 50, status?: string) {
    const accessToken = await this.getValidAccessToken();

    const params = new URLSearchParams({
      organization_id: this.organizationId,
      page: String(page),
      per_page: String(perPage),
    });
    if (status) params.set('status', status);

    let response: Awaited<ReturnType<typeof axios.get<SalesOrderListResponse>>>;
    try {
      response = await axios.get<SalesOrderListResponse>(
        `${this.booksApiUrl}/salesorders?${params.toString()}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
      );
    } catch (err) {
      this.throwZohoError(err, 'listSalesOrders');
    }

    return (response.data.salesorders ?? []).map((so: SalesOrderSummary) => ({
      salesorderId: so.salesorder_id,
      salesorderNumber: so.salesorder_number,
      customerName: so.customer_name ?? undefined,
      customerId: so.customer_id ?? undefined,
      status: so.status ?? undefined,
      date: so.date ?? undefined,
      shipmentDate: so.shipment_date ?? undefined,
      referenceNumber: so.reference_number ?? undefined,
      currencyCode: so.currency_code ?? undefined,
      subtotal: so.sub_total ?? undefined,
      total: so.total ?? undefined,
    }));
  }

  async getSalesOrder(salesorderId: string) {
    const accessToken = await this.getValidAccessToken();

    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    let response: Awaited<ReturnType<typeof axios.get<SalesOrderDetailResponse>>>;
    try {
      response = await axios.get<SalesOrderDetailResponse>(
        `${this.booksApiUrl}/salesorders/${salesorderId}?${params.toString()}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
      );
    } catch (err) {
      this.throwZohoError(err, 'getSalesOrder');
    }

    const so = response.data.salesorder;
    if (!so)
      return {
        salesorderId: '',
        salesorderNumber: '',
        customerName: undefined,
        customerId: undefined,
        status: undefined,
        date: undefined,
        shipmentDate: undefined,
        referenceNumber: undefined,
        currencyCode: undefined,
        subtotal: undefined,
        total: undefined,
        notes: undefined,
        lineItems: [],
      };

    return {
      salesorderId: so.salesorder_id,
      salesorderNumber: so.salesorder_number,
      customerName: so.customer_name ?? undefined,
      customerId: so.customer_id ?? undefined,
      status: so.status ?? undefined,
      date: so.date ?? undefined,
      shipmentDate: so.shipment_date ?? undefined,
      referenceNumber: so.reference_number ?? undefined,
      currencyCode: so.currency_code ?? undefined,
      subtotal: so.sub_total ?? undefined,
      total: so.total ?? undefined,
      notes: so.notes ?? undefined,
      lineItems:
        so.line_items?.map((item: SalesOrderLineItem) => ({
          lineItemId: item.line_item_id,
          itemId: item.item_id,
          name: item.name,
          sku: item.sku ?? undefined,
          description: item.description ?? undefined,
          quantity: item.quantity ?? undefined,
          rate: item.rate ?? undefined,
          total: item.total ?? undefined,
          unit: item.unit ?? undefined,
        })) ?? [],
    };
  }

  async getCompositeItemInventory(
    page = 1,
    perPage = 200,
  ): Promise<ZohoCompositeItemsResult> {
    const accessToken = await this.getValidAccessToken();

    const params = new URLSearchParams({
      organization_id: this.organizationId,
      page: String(page),
      per_page: String(perPage),
    });

    let response: Awaited<ReturnType<typeof axios.get<ZohoCompositeItemFetchResponse>>>;
    try {
      response = await axios.get<ZohoCompositeItemFetchResponse>(
        `${this.inventoryApiUrl}/compositeitems?${params.toString()}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
      );
    } catch (err) {
      this.throwZohoError(err, 'getCompositeItemInventory');
    }

    const payload = response.data as unknown as ZohoCompositeItemFetchResponse;
    const zohoItems = payload.composite_items ?? [];

    return { items: zohoItems, page: Number(page), perPage: Number(perPage) };
  }

  async getCompositeItem(
    compositeItemId: string,
  ): Promise<CompositeItemResponse | null> {
    const accessToken = await this.getValidAccessToken();

    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    let response: Awaited<ReturnType<typeof axios.get<Record<string, any>>>>;
    try {
      response = await axios.get<Record<string, any>>(
        `${this.inventoryApiUrl}/compositeitems/${compositeItemId}?${params.toString()}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
      );
    } catch (err) {
      this.throwZohoError(err, 'getCompositeItem');
    }
    const payload = response.data;
    // Zoho may return the item under `composite_item` or return the object itself.
    const item = (payload.composite_item ?? payload) as CompositeItemResponse;
    if (!item) return null;
    return item;
  }

  async createCompositeItemInZoho(
    payload: ZohoCreateCompositeItemPayload,
  ): Promise<CompositeItemResponse> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    let response: { data: Record<string, any> };
    try {
      response = await axios.post<Record<string, any>>(
        `${this.inventoryApiUrl}/compositeitems?${params.toString()}`,
        payload,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      this.logger.error(
        'Zoho composite item create failed. Payload: ' +
          JSON.stringify(payload),
      );
      throw new BadRequestException(
        'Zoho composite item create failed: ' + this.formatError(err),
      );
    }

    try {
      await this.invalidateAllItemsCache();
    } catch (err) {
      this.logger.warn(
        'Failed to invalidate Zoho items cache after composite create: ' +
          this.formatError(err),
      );
    }

    const created = (response.data.composite_item ?? response.data) as
      | CompositeItemResponse
      | undefined;
    if (!created?.composite_item_id) {
      throw new BadRequestException(
        'Zoho did not return the created composite item',
      );
    }

    return created;
  }

  async updateCompositeItemInZoho(
    compositeItemId: string,
    payload: ZohoCreateCompositeItemPayload,
  ): Promise<CompositeItemResponse> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    let response: { data: Record<string, any> };
    try {
      response = await axios.put<Record<string, any>>(
        `${this.inventoryApiUrl}/compositeitems/${compositeItemId}?${params.toString()}`,
        payload,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      this.logger.error(
        `Zoho composite item update failed for ${compositeItemId}. Payload: ` +
          JSON.stringify(payload),
      );
      throw new BadRequestException(
        'Zoho composite item update failed: ' + this.formatError(err),
      );
    }

    try {
      await this.invalidateAllItemsCache();
    } catch (err) {
      this.logger.warn(
        'Failed to invalidate Zoho items cache after composite update: ' +
          this.formatError(err),
      );
    }

    const updated = (response.data.composite_item ?? response.data) as
      | CompositeItemResponse
      | undefined;
    if (!updated?.composite_item_id) {
      throw new BadRequestException(
        'Zoho did not return the updated composite item',
      );
    }

    return updated;
  }
  async getItemsInventory(page = 1, perPage = 200): Promise<ZohoItemsResult> {
    const accessToken = await this.getValidAccessToken();

    const params = new URLSearchParams({
      organization_id: this.organizationId,
      page: String(page),
      per_page: String(perPage),
    });

    let response: Awaited<ReturnType<typeof axios.get<InventoryItemsResponse>>>;
    try {
      response = await axios.get<InventoryItemsResponse>(
        `${this.booksApiUrl}/items?${params.toString()}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
      );
    } catch (err) {
      this.throwZohoError(err, 'getItemsInventory');
    }

    const payload = response.data as unknown as InventoryItemsResponse;
    const zohoItems = payload.items ?? [];

    const items: ZohoMappedItem[] = zohoItems.map(
      (it: InventoryListItem): ZohoMappedItem => {
        const locations = Array.isArray(it.locations) ? it.locations : [];

        const itemId =
          it.item_id !== undefined ? String(it.item_id) : undefined;
        const name = it.name !== undefined ? String(it.name) : undefined;
        const itemName =
          it.item_name !== undefined ? String(it.item_name) : name;
        const sku = it.sku !== undefined ? String(it.sku) : undefined;
        const description =
          it.description !== undefined ? String(it.description) : undefined;
        const rate =
          typeof it.rate === 'number'
            ? it.rate
            : typeof it.rate === 'string' && !Number.isNaN(Number(it.rate))
              ? Number(it.rate)
              : undefined;
        const purchaseRate =
          typeof it.purchase_rate === 'number'
            ? it.purchase_rate
            : typeof it.purchase_rate === 'string' &&
                !Number.isNaN(Number(it.purchase_rate))
              ? Number(it.purchase_rate)
              : undefined;
        const stockOnHand =
          typeof it.stock_on_hand === 'number'
            ? it.stock_on_hand
            : typeof it.stock_on_hand === 'string' &&
                !Number.isNaN(Number(it.stock_on_hand))
              ? Number(it.stock_on_hand)
              : undefined;
        const availableStock =
          typeof it.available_stock === 'number'
            ? it.available_stock
            : typeof it.available_stock === 'string' &&
                !Number.isNaN(Number(it.available_stock))
              ? Number(it.available_stock)
              : undefined;
        const actualAvailableStock =
          typeof it.actual_available_stock === 'number'
            ? it.actual_available_stock
            : typeof it.actual_available_stock === 'string' &&
                !Number.isNaN(Number(it.actual_available_stock))
              ? Number(it.actual_available_stock)
              : undefined;
        const createdTime =
          it.created_time !== undefined ? String(it.created_time) : undefined;
        const lastModifiedTime =
          it.last_modified_time !== undefined
            ? String(it.last_modified_time)
            : undefined;

        return {
          itemId,
          name,
          itemName,
          sku,
          description,
          rate,
          purchaseRate,
          stockOnHand,
          availableStock,
          actualAvailableStock,
          locations,
          createdTime,
          lastModifiedTime,
        };
      },
    );

    return { items, page: Number(page), perPage: Number(perPage) };
  }

  async getItemInventory(
    itemId: string,
    syncLocal = false,
  ): Promise<ZohoItemFetchResponse> {
    const accessToken = await this.getValidAccessToken();

    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    let response: Awaited<ReturnType<typeof axios.get<InventoryItemResponse>>>;
    try {
      response = await axios.get<InventoryItemResponse>(
        `${this.booksApiUrl}/items/${itemId}?${params.toString()}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
      );
    } catch (err) {
      this.throwZohoError(err, 'getItemInventory');
    }

    const payload = response.data as unknown as InventoryItemResponse;
    const it = payload.item;

    const mapped: ZohoMappedItem = {
      itemId: it.item_id !== undefined ? String(it.item_id) : undefined,
      name: it.name !== undefined ? String(it.name) : undefined,
      itemName:
        it.item_name !== undefined
          ? String(it.item_name)
          : it.name !== undefined
            ? String(it.name)
            : undefined,
      sku: it.sku !== undefined ? String(it.sku) : undefined,
      description:
        it.description !== undefined ? String(it.description) : undefined,
      rate:
        typeof it.rate === 'number'
          ? it.rate
          : typeof it.rate === 'string' && !Number.isNaN(Number(it.rate))
            ? Number(it.rate)
            : undefined,
      purchaseRate:
        typeof it.purchase_rate === 'number'
          ? it.purchase_rate
          : typeof it.purchase_rate === 'string' &&
              !Number.isNaN(Number(it.purchase_rate))
            ? Number(it.purchase_rate)
            : undefined,
      stockOnHand:
        typeof it.stock_on_hand === 'number'
          ? it.stock_on_hand
          : typeof it.stock_on_hand === 'string' &&
              !Number.isNaN(Number(it.stock_on_hand))
            ? Number(it.stock_on_hand)
            : undefined,
      availableStock:
        typeof it.available_stock === 'number'
          ? it.available_stock
          : typeof it.available_stock === 'string' &&
              !Number.isNaN(Number(it.available_stock))
            ? Number(it.available_stock)
            : undefined,
      actualAvailableStock:
        typeof it.actual_available_stock === 'number'
          ? it.actual_available_stock
          : typeof it.actual_available_stock === 'string' &&
              !Number.isNaN(Number(it.actual_available_stock))
            ? Number(it.actual_available_stock)
            : undefined,
      locations: Array.isArray(it.locations) ? it.locations : [],
      createdTime:
        it.created_time !== undefined ? String(it.created_time) : undefined,
      lastModifiedTime:
        it.last_modified_time !== undefined
          ? String(it.last_modified_time)
          : undefined,
    };

    let synced: { updated: boolean; inventoryId?: string } | undefined =
      undefined;

    if (syncLocal) {
      try {
        type LocalInventoryRecord = { id: string; quantityInStock: number };
        let inventoryRecord: LocalInventoryRecord | null = null;
        if (mapped.sku) {
          const rec = await this.prisma.inventory.findUnique({
            where: { sku: mapped.sku },
            select: { id: true, quantityInStock: true },
          });
          if (rec) inventoryRecord = rec as LocalInventoryRecord;
        }
        if (!inventoryRecord) {
          const rec = await this.prisma.inventory.findFirst({
            where: { itemName: mapped.itemName },
            select: { id: true, quantityInStock: true },
          });
          if (rec) inventoryRecord = rec as LocalInventoryRecord;
        }

        if (inventoryRecord) {
          // Sync local quantity if differs
          if (
            typeof mapped.stockOnHand === 'number' &&
            inventoryRecord.quantityInStock !== mapped.stockOnHand
          ) {
            await this.prisma.inventory.update({
              where: { id: inventoryRecord.id },
              data: { quantityInStock: mapped.stockOnHand },
            });
            synced = { updated: true, inventoryId: inventoryRecord.id };
          }
        }
      } catch (err) {
        this.logger.debug(
          'Sync local inventory failed: ' + this.formatError(err),
        );
      }
    }

    return { item: mapped, synced };
  }

  async getItemInventoryRaw(itemId: string): Promise<InventoryListItem> {
    const accessToken = await this.getValidAccessToken();

    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    const response = await axios.get<InventoryItemResponse>(
      `${this.booksApiUrl}/items/${itemId}?${params.toString()}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
    );

    const payload = response.data as unknown as InventoryItemResponse;
    return payload.item;
  }

  async findZohoItemBySku(sku: string): Promise<InventoryListItem | null> {
    if (!sku) return null;
    const q = String(sku).trim().toLowerCase();
    let page = 1;
    const pageSize = 200;
    const maxPages = 200;

    while (page <= maxPages) {
      const batch = await this.getItemsInventory(page, pageSize);
      if (!batch || !Array.isArray(batch.items) || batch.items.length === 0)
        break;

      for (const it of batch.items) {
        if ((it.sku ?? '').toString().toLowerCase() === q) {
          // Reconstruct InventoryListItem shape from ZohoMappedItem
          return {
            item_id: it.itemId ?? '',
            name: it.name ?? it.itemName ?? '',
            item_name: it.itemName ?? it.name ?? undefined,
            sku: it.sku ?? undefined,
            rate: it.rate ?? undefined,
            stock_on_hand: it.stockOnHand ?? undefined,
            available_stock: it.availableStock ?? undefined,
            actual_available_stock: it.actualAvailableStock ?? undefined,
            locations: Array.isArray(it.locations) ? it.locations : [],
            created_time: it.createdTime ?? undefined,
            last_modified_time: it.lastModifiedTime ?? undefined,
          } as InventoryListItem;
        }
      }

      if (batch.items.length < pageSize) break;
      page++;
    }

    return null;
  }

  async findZohoItemByName(name: string): Promise<InventoryListItem | null> {
    if (!name) return null;
    const q = String(name).trim().toLowerCase();
    let page = 1;
    const pageSize = 200;
    const maxPages = 200;

    while (page <= maxPages) {
      const batch = await this.getItemsInventory(page, pageSize);
      if (!batch || !Array.isArray(batch.items) || batch.items.length === 0)
        break;

      for (const it of batch.items) {
        const candidate = (it.itemName ?? it.name ?? '')
          .toString()
          .toLowerCase();
        if (candidate === q || candidate.includes(q)) {
          return {
            item_id: it.itemId ?? '',
            name: it.name ?? it.itemName ?? '',
            item_name: it.itemName ?? it.name ?? undefined,
            sku: it.sku ?? undefined,
            rate: it.rate ?? undefined,
            stock_on_hand: it.stockOnHand ?? undefined,
            available_stock: it.availableStock ?? undefined,
            actual_available_stock: it.actualAvailableStock ?? undefined,
            locations: Array.isArray(it.locations) ? it.locations : [],
            created_time: it.createdTime ?? undefined,
            last_modified_time: it.lastModifiedTime ?? undefined,
          } as InventoryListItem;
        }
      }

      if (batch.items.length < pageSize) break;
      page++;
    }

    return null;
  }

  async loadAllZohoItems(fetchPerPage = 200): Promise<ZohoMappedItem[]> {
    try {
      const cached = await this.cacheClient().get<ZohoMappedItem[]>(
        this.ALL_ITEMS_CACHE_KEY,
      );
      if (Array.isArray(cached) && cached.length > 0) return cached;
    } catch (err) {
      this.logger.debug('Zoho cache read failed: ' + this.formatError(err));
    }

    const items: ZohoMappedItem[] = [];
    let p = 1;
    const maxPages = 1000;
    while (p <= maxPages) {
      const batch = await this.getItemsInventory(p, fetchPerPage);
      if (!batch || !Array.isArray(batch.items) || batch.items.length === 0)
        break;
      items.push(...batch.items);
      if (batch.items.length < fetchPerPage) break;
      p++;
    }

    const ttl = Number(this.config.get<number>('zoho.items_cache_ttl') ?? 600);
    try {
      const cm = this.cacheClient();
      await Promise.resolve(cm.set(this.ALL_ITEMS_CACHE_KEY, items, { ttl }));
    } catch (err) {
      this.logger.warn(
        'Failed to set Zoho items cache: ' + this.formatError(err),
      );
    }

    return items;
  }
  async loadAllZohoCompositeItems(
    fetchPerPage = 200,
  ): Promise<CompositeItemResponse[]> {
    try {
      const cached = await this.cacheClient().get<CompositeItemResponse[]>(
        this.ALL_COMPOSITE_ITEMS_CACHE_KEY,
      );
      if (Array.isArray(cached) && cached.length > 0) return cached;
    } catch (err) {
      this.logger.debug('Zoho cache read failed: ' + this.formatError(err));
    }

    const items: CompositeItemResponse[] = [];
    let p = 1;
    const maxPages = 1000;
    while (p <= maxPages) {
      const batch = await this.getCompositeItemInventory(p, fetchPerPage);
      if (!batch || !Array.isArray(batch.items) || batch.items.length === 0)
        break;
      items.push(...batch.items);
      if (batch.items.length < fetchPerPage) break;
      p++;
    }

    const ttl = Number(this.config.get<number>('zoho.items_cache_ttl') ?? 600);
    try {
      const cm = this.cacheClient();
      await Promise.resolve(
        cm.set(this.ALL_COMPOSITE_ITEMS_CACHE_KEY, items, { ttl }),
      );
    } catch (err) {
      this.logger.warn(
        'Failed to set Zoho items cache: ' + this.formatError(err),
      );
    }

    return items;
  }

  async findCompositeItemBySku(
    sku: string,
  ): Promise<CompositeItemResponse | null> {
    if (!sku) return null;

    const query = String(sku).trim().toLowerCase();
    const items = await this.loadAllZohoCompositeItems();
    return (
      items.find(
        (item) =>
          String(item.sku ?? '')
            .trim()
            .toLowerCase() === query,
      ) ?? null
    );
  }

  async findCompositeItemByName(
    name: string,
  ): Promise<CompositeItemResponse | null> {
    if (!name) return null;

    const query = String(name).trim().toLowerCase();
    const items = await this.loadAllZohoCompositeItems();
    return (
      items.find((item) => {
        const candidate = String(item.name ?? '')
          .trim()
          .toLowerCase();
        return candidate === query || candidate.includes(query);
      }) ?? null
    );
  }

  async invalidateAllItemsCache(): Promise<void> {
    try {
      await Promise.resolve(this.cacheClient().del(this.ALL_ITEMS_CACHE_KEY));
      await Promise.resolve(
        this.cacheClient().del(this.ALL_COMPOSITE_ITEMS_CACHE_KEY),
      );
    } catch (err) {
      this.logger.warn(
        'Failed to delete Zoho items cache: ' + this.formatError(err),
      );
    }
  }

  async searchItems(
    query: string,
    page = 1,
    perPage = 50,
  ): Promise<ZohoItemsResult> {
    const q = String(query || '')
      .trim()
      .toLowerCase();
    if (!q) return { items: [], page: Number(page), perPage: Number(perPage) };

    // Fast path: use cached full list
    try {
      const all = await this.loadAllZohoItems();

      // exact SKU match
      const exactSku = all.find(
        (it) => (it.sku ?? '').toString().toLowerCase() === q,
      );
      if (exactSku)
        return {
          items: [exactSku],
          page: Number(page),
          perPage: Number(perPage),
        };

      const matches = all.filter((it) => {
        const name = (it.itemName ?? it.name ?? '').toString().toLowerCase();
        const sku = (it.sku ?? '').toString().toLowerCase();
        return name.includes(q) || sku.includes(q);
      });

      const start = (page - 1) * perPage;
      const resultItems = matches.slice(start, start + perPage);
      return {
        items: resultItems,
        page: Number(page),
        perPage: Number(perPage),
      };
    } catch (err) {
      this.logger.debug('loadAllZohoItems failed: ' + this.formatError(err));
    }

    // Fallback: incremental page scan (slower)
    try {
      const skuMatch = await this.findZohoItemBySku(query);
      if (skuMatch) {
        const single = await this.getItemInventory(skuMatch.item_id);
        return {
          items: [single.item],
          page: Number(page),
          perPage: Number(perPage),
        };
      }
    } catch (err) {
      this.logger.debug('findZohoItemBySku failed: ' + this.formatError(err));
    }

    const matches: ZohoMappedItem[] = [];
    let p = 1;
    const fetchPerPage = 200;
    const maxPages = 200;
    while (p <= maxPages) {
      const batch = await this.getItemsInventory(p, fetchPerPage);
      if (!batch || !Array.isArray(batch.items) || batch.items.length === 0)
        break;

      for (const it of batch.items) {
        const name = (it.itemName ?? it.name ?? '').toString().toLowerCase();
        const sku = (it.sku ?? '').toString().toLowerCase();
        if (name.includes(q) || sku.includes(q)) matches.push(it);
      }

      if (matches.length >= page * perPage) break;
      if (batch.items.length < fetchPerPage) break;
      p++;
    }

    const start = (page - 1) * perPage;
    const resultItems = matches.slice(start, start + perPage);
    return { items: resultItems, page: Number(page), perPage: Number(perPage) };
  }

  async listAssemblies(
    compositeItemId: string,
    page = 1,
    perPage = 200,
  ): Promise<ZohoAssembliesResult> {
    if (!compositeItemId) {
      throw new BadRequestException('composite_item_id is required');
    }

    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
      composite_item_id: compositeItemId,
      page: String(page),
      per_page: String(perPage),
    });

    const response = await axios.get<ZohoAssemblyListResponse>(
      `${this.inventoryApiUrl}/bundles?${params.toString()}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      },
    );

    const payload = response.data as unknown as ZohoAssemblyListResponse;
    return {
      items: payload.bundles ?? [],
      page: Number(page),
      perPage: Number(perPage),
      compositeItemId: String(compositeItemId),
    };
  }

  async listAssembliesByProduct(
    sku?: string,
    name?: string,
    page = 1,
    perPage = 200,
  ): Promise<ZohoAssembliesResult> {
    let compositeItem: CompositeItemResponse | null = null;

    if (sku) {
      compositeItem = await this.findCompositeItemBySku(sku);
    }
    if (!compositeItem && name) {
      compositeItem = await this.findCompositeItemByName(name);
    }

    if (!compositeItem) {
      throw new NotFoundException(
        `Zoho composite item not found for ${name ?? sku ?? 'product'}`,
      );
    }

    return this.listAssemblies(
      String(compositeItem.composite_item_id),
      page,
      perPage,
    );
  }

  async listLocations(): Promise<Location[]> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    const response = await axios.get<ZohoLocationsResponse>(
      `${this.inventoryApiUrl}/locations?${params.toString()}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      },
    );

    return Array.isArray(response.data.locations)
      ? response.data.locations
      : [];
  }

  async getAssembly(bundleId: string): Promise<ZohoAssembly | null> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    const response = await axios.get<ZohoAssemblyFetchResponse>(
      `${this.inventoryApiUrl}/bundles/${bundleId}?${params.toString()}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      },
    );

    const payload = response.data as unknown as ZohoAssemblyFetchResponse;
    return payload.bundle ?? null;
  }

  async createAssemblyInZoho(
    payload: ZohoCreateAssemblyPayload,
  ): Promise<ZohoAssembly> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    let response: { data: ZohoAssemblyFetchResponse };
    try {
      response = await axios.post<ZohoAssemblyFetchResponse>(
        `${this.inventoryApiUrl}/bundles?${params.toString()}`,
        payload,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          `[ZOHO ASSEMBLY] HTTP ${err.response?.status ?? 'no-response'} from Zoho Inventory API` +
            ` | org_id=${this.organizationId}` +
            ` | url=${err.config?.url ?? 'unknown'}` +
            ` | response_body=${JSON.stringify(err.response?.data ?? null)}`,
        );
      } else {
        this.logger.error(
          '[ZOHO ASSEMBLY] Non-HTTP error creating assembly: ' +
            (err instanceof Error ? err.message : String(err)),
        );
      }
      this.logger.error(
        '[ZOHO ASSEMBLY] Payload that was sent: ' + JSON.stringify(payload),
      );
      throw new BadRequestException(
        'Zoho assembly create failed: ' + this.formatError(err),
      );
    }

    try {
      await this.invalidateAllItemsCache();
    } catch (err) {
      this.logger.warn(
        'Failed to invalidate Zoho items cache after assembly create: ' +
          this.formatError(err),
      );
    }

    const created =
      response.data.bundle ??
      ((response.data as unknown as Partial<ZohoAssembly>).bundle_id
        ? (response.data as unknown as ZohoAssembly)
        : null);
    if (!created) {
      throw new BadRequestException('Zoho did not return the created assembly');
    }

    return created;
  }

  async updateItemStock(
    itemId: string,
    stockOnHand: number,
  ): Promise<Record<string, unknown>> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    const body = { stock_on_hand: stockOnHand } as Record<string, unknown>;

    const response = await axios.put<Record<string, unknown>>(
      `${this.booksApiUrl}/items/${itemId}?${params.toString()}`,
      body,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
    );

    // invalidate cache — stock changed
    try {
      await this.invalidateAllItemsCache();
    } catch (err) {
      this.logger.warn(
        'Failed to invalidate Zoho items cache after stock update: ' +
          this.formatError(err),
      );
    }

    return response.data;
  }

  async createItemInZoho(payload: {
    sku: string;
    itemName: string;
    price?: number;
    averagePrice?: number;
    quantityInStock?: number;
    description?: string;
    itemType?: 'inventory' | 'service' | 'non-inventory';
    productType?: 'goods' | 'service';
    accountId?: string;
    purchaseAccountId?: string;
    inventoryAccountId?: string;
    trackInventory?: boolean;
  }): Promise<ZohoMappedItem> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });

    const body: Record<string, unknown> = {
      name: payload.itemName,
      sku: payload.sku,
      description: payload.description ?? undefined,
      rate: payload.price ?? undefined,
      purchase_rate: payload.averagePrice ?? undefined,
      item_type: payload.itemType ?? 'inventory',
      product_type: payload.productType ?? 'goods',
      account_id: payload.accountId ?? undefined,
      purchase_account_id: payload.purchaseAccountId ?? undefined,
      inventory_account_id: payload.inventoryAccountId ?? undefined,
      initial_stock:
        (payload.trackInventory ?? payload.itemType !== 'service') &&
        payload.quantityInStock !== undefined
          ? Math.round(payload.quantityInStock)
          : undefined,
      initial_stock_rate: payload.averagePrice ?? undefined,
      track_inventory: payload.trackInventory ?? payload.itemType !== 'service',
    };

    const response = await axios.post<InventoryItemResponse>(
      `${this.booksApiUrl}/items?${params.toString()}`,
      body,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
    );

    const respPayload = response.data as unknown as InventoryItemResponse;
    const created = respPayload.item;
    const mapped: ZohoMappedItem = {
      itemId: created?.item_id ?? undefined,
      name: created?.name ?? created?.item_name ?? payload.itemName,
      itemName: created?.item_name ?? created?.name ?? payload.itemName,
      sku: created?.sku ?? payload.sku,
      rate: typeof created?.rate === 'number' ? created.rate : payload.price,
      stockOnHand:
        typeof created?.stock_on_hand === 'number'
          ? created.stock_on_hand
          : payload.quantityInStock,
    } as ZohoMappedItem;

    try {
      await this.invalidateAllItemsCache();
    } catch (err) {
      this.logger.warn(
        'Failed to invalidate Zoho items cache after create: ' +
          this.formatError(err),
      );
    }

    return mapped;
  }

  async updateItemInZoho(
    itemId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });
    const response = await axios.put<Record<string, unknown>>(
      `${this.booksApiUrl}/items/${itemId}?${params.toString()}`,
      data,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
    );

    try {
      await this.invalidateAllItemsCache();
    } catch (err) {
      this.logger.warn(
        'Failed to invalidate Zoho items cache after update: ' +
          this.formatError(err),
      );
    }

    return response.data;
  }

  async deleteItemInZoho(itemId: string): Promise<Record<string, unknown>> {
    const accessToken = await this.getValidAccessToken();
    const params = new URLSearchParams({
      organization_id: this.organizationId,
    });
    const response = await axios.delete<Record<string, unknown>>(
      `${this.booksApiUrl}/items/${itemId}?${params.toString()}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
    );

    try {
      await this.invalidateAllItemsCache();
    } catch (err) {
      this.logger.warn(
        'Failed to invalidate Zoho items cache after delete: ' +
          this.formatError(err),
      );
    }

    return response.data;
  }
}
