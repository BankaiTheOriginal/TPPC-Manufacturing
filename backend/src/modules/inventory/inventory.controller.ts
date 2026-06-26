import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import {
  Cache,
  CACHE_MANAGER,
  CacheInterceptor,
  CacheTTL,
} from '@nestjs/cache-manager';
import { Roles } from 'src/common/decorators/roles.decorator';

const INV_MGMT_ROLES: any[] = ['ADMINISTRATOR', 'GENERAL_MANAGER', 'PRODUCTION_MANAGER', 'HEAD_OF_OPERATIONS', 'SUPERVISOR'];

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  @Roles(...INV_MGMT_ROLES)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Get('')
  async getItems(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
  ) {
    return this.inventoryService.listItems(Number(page), Number(limit), q);
  }

  @Roles(...INV_MGMT_ROLES)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @Get('/:id')
  async getItem(@Param('id') id: string) {
    return this.inventoryService.listItem(id);
  }

  @Roles(...INV_MGMT_ROLES)
  @Post('')
  async createItem(@Body() data: CreateInventoryDto) {
    const result = await this.inventoryService.createItem(data);
    await this.cacheManager.clear();
    return result;
  }

  @Roles(...INV_MGMT_ROLES)
  @Patch('/:id')
  async updateItem(@Param('id') id: string, @Body() data: UpdateInventoryDto) {
    const result = await this.inventoryService.updateItem(id, data);
    await this.cacheManager.del(`/inventory/${id}`);
    await this.cacheManager.clear();
    return result;
  }

  @Roles(...INV_MGMT_ROLES)
  @Delete('/:id')
  async deleteItem(@Param('id') id: string) {
    const result = await this.inventoryService.deleteItem(id);
    await this.cacheManager.del(`/inventory/${id}`);
    await this.cacheManager.clear();
    return result;
  }

  @Roles(...INV_MGMT_ROLES)
  @Post('bulk-delete')
  async bulkDeleteItems(@Body('ids') ids: string[]) {
    const result = await this.inventoryService.bulkDeleteItems(ids);
    await this.cacheManager.clear();
    return result;
  }
}
