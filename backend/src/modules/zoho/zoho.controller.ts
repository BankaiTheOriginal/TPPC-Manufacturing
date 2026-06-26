import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  Post,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ZohoService } from './zoho.service';
import { ZohoSyncService } from './zoho-sync.service';
import type { CompositeItemResponse, ZohoAssembly } from './zoho.service';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Public } from 'src/common/decorators/public.decorator';
import {
  CacheInterceptor,
  CacheTTL,
  CACHE_MANAGER,
  Cache,
} from '@nestjs/cache-manager';

@Controller('zoho')
export class ZohoController {
  constructor(
    private readonly zohoService: ZohoService,
    private readonly config: ConfigService,
    private readonly zohoSyncService: ZohoSyncService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Get('status')
  async getConnectionStatus() {
    return this.zohoService.getConnectionStatus();
  }

  /**
   * Diagnostic endpoint — call this when inventory/sales-order fetches return 500.
   * Returns which Zoho org IDs the current token has access to vs. the configured
   * ZOHO_ORGANIZATION_ID env var. Tells you exactly what needs updating.
   */
  @UseGuards(JwtGuard)
  @Get('diagnose')
  async diagnose() {
    return this.zohoService.diagnose();
  }

  @UseGuards(JwtGuard)
  @Get('oauth')
  getOauthCode() {
    return this.zohoService.getOauthCode();
  }

  @Public()
  @Get('callback')
  async handleCallback(@Query('code') code: string, @Res() res: Response) {
    const frontendUrl = this.config.getOrThrow<string>('frontend_url');
    try {
      await this.zohoService.getZohoTokens(code);
      res.redirect(`${frontendUrl}/zoho/success`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth failed';
      res.redirect(
        `${frontendUrl}/zoho/error?message=${encodeURIComponent(message)}`,
      );
    }
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('sales-orders')
  async listSalesOrders(
    @Query('page') page = 1,
    @Query('per_page') perPage = 50,
    @Query('status') status = 'draft',
  ) {
    return this.zohoService.listSalesOrders(
      Number(page),
      Number(perPage),
      status,
    );
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('items')
  async listItems(@Query('page') page = 1, @Query('per_page') perPage = 200) {
    return this.zohoService.getItemsInventory(Number(page), Number(perPage));
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('composite-items')
  async listCompositeItems(
    @Query('page') page = 1,
    @Query('per_page') perPage = 200,
  ) {
    return this.zohoService.getCompositeItemInventory(
      Number(page),
      Number(perPage),
    );
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('assemblies')
  async listAssemblies(
    @Query('composite_item_id') compositeItemId: string,
    @Query('page') page = 1,
    @Query('per_page') perPage = 200,
  ) {
    return this.zohoService.listAssemblies(
      compositeItemId,
      Number(page),
      Number(perPage),
    );
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('locations')
  async listLocations() {
    return this.zohoService.listLocations();
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('assemblies/by-product')
  async listAssembliesByProduct(
    @Query('sku') sku?: string,
    @Query('name') name?: string,
    @Query('page') page = 1,
    @Query('per_page') perPage = 200,
  ) {
    return this.zohoService.listAssembliesByProduct(
      sku,
      name,
      Number(page),
      Number(perPage),
    );
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('sales-orders/:id')
  async getSalesOrder(@Param('id') id: string) {
    return this.zohoService.getSalesOrder(id);
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('items/:id')
  async getItem(
    @Param('id') id: string,
    @Query('sync_local') syncLocal?: string,
  ) {
    const sync = syncLocal === '1' || syncLocal === 'true';
    return this.zohoService.getItemInventory(id, sync);
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('composite-items/:id')
  async getCompositeItem(
    @Param('id') id: string,
  ): Promise<CompositeItemResponse | null> {
    return await this.zohoService.getCompositeItem(String(id));
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180000)
  @Get('assemblies/:id')
  async getAssembly(@Param('id') id: string): Promise<ZohoAssembly | null> {
    return await this.zohoService.getAssembly(String(id));
  }

  @UseGuards(JwtGuard)
  @Post('items/sync-local')
  async syncItemsToLocal() {
    const result = await this.zohoSyncService.syncAllItemsToLocal();
    try {
      await Promise.resolve(this.cacheManager.clear());
    } catch {
      // ignore cache clear errors
    }
    return result;
  }

  @UseGuards(JwtGuard)
  @Post('items/sync-operation-services')
  async syncOperationServices() {
    const result = await this.zohoSyncService.syncOperationServiceCatalog();
    try {
      await Promise.resolve(this.cacheManager.clear());
    } catch {
      // ignore cache clear errors
    }
    return result;
  }

  /**
   * Compare the app's hardcoded papers and operation-service items against
   * what currently exists in the connected Zoho Books org. Used by the
   * Zoho Gap Analysis page so users can see what needs to be created in Zoho
   * before assemblies can succeed.
   */
  @UseGuards(JwtGuard)
  @Get('gap-analysis')
  async getGapAnalysis() {
    return this.zohoSyncService.getMaterialGapAnalysis();
  }
}
