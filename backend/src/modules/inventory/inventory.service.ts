import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { ZohoService, InventoryListItem } from 'src/modules/zoho/zoho.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zohoService: ZohoService,
  ) {}

  async listItems(page: number, limit: number, q?: string) {
    // If a search query is provided, perform a Zoho-wide search
    if (q && String(q).trim().length > 0) {
      return this.zohoService.searchItems(String(q).trim(), page, limit);
    }

    // Return Zoho items as the authoritative source
    const result = await this.zohoService.getItemsInventory(page, limit);
    return result;
  }

  async listItem(id: string) {
    const local = await this.prisma.inventory.findUnique({ where: { id } });
    if (local) {
      try {
        if (local.sku) {
          const zoho = await this.zohoService.findZohoItemBySku(local.sku);
          if (zoho && typeof zoho.item_id === 'string')
            return await this.zohoService.getItemInventory(zoho.item_id);
        }
      } catch {
        // ignore Zoho lookup errors and return local record
      }
      return local;
    }

    // Fallback: treat id as Zoho item id
    try {
      return await this.zohoService.getItemInventory(id);
    } catch {
      throw new NotFoundException('Item not found');
    }
  }

  async createItem(data: CreateInventoryDto) {
    // Create item in Zoho and then create a local pointer record
    const zohoItem = await this.zohoService.createItemInZoho({
      sku: data.sku,
      itemName: data.itemName,
      price: data.price,
      averagePrice: data.averagePrice,
      quantityInStock: data.quantityInStock,
    });

    const created = await this.prisma.inventory.create({
      data: {
        sku: data.sku,
        itemName: data.itemName,
        itemType: data.itemType,
        category: data.category,
        quantityInStock: Math.round(
          zohoItem.stockOnHand ?? data.quantityInStock,
        ),
        averagePrice: data.averagePrice,
        price: data.price,
        receivedDate: new Date(data.receivedDate),
        lastRestockDate: data.lastRestockDate
          ? new Date(data.lastRestockDate)
          : undefined,
      },
    });

    return { local: created, zoho: zohoItem };
  }

  async updateItem(id: string, data: UpdateInventoryDto) {
    const item = await this.prisma.inventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    // Try to update Zoho item if we can locate it by SKU or name
    try {
      let zoho: InventoryListItem | null = null;
      if (item.sku) zoho = await this.zohoService.findZohoItemBySku(item.sku);
      if (!zoho && item.itemName)
        zoho = await this.zohoService.findZohoItemByName(item.itemName);

      if (zoho) {
        const payload: Record<string, unknown> = {};
        if (data.itemName) payload.name = data.itemName;
        if (data.sku) payload.sku = data.sku;
        if (data.price !== undefined) payload.rate = data.price;
        if (data.quantityInStock !== undefined)
          payload.stock_on_hand = Math.round(data.quantityInStock);

        if (Object.keys(payload).length > 0) {
          await this.zohoService.updateItemInZoho(zoho.item_id, payload);
        }
      }
    } catch {
      // Ignore Zoho update failures and proceed with local update
    }

    return this.prisma.inventory.update({
      where: { id: item.id },
      data: {
        sku: data.sku,
        itemName: data.itemName,
        itemType: data.itemType,
        category: data.category,
        quantityInStock: data.quantityInStock,
        averagePrice: data.averagePrice,
        price: data.price,
        receivedDate: data.receivedDate
          ? new Date(data.receivedDate)
          : undefined,
        lastRestockDate: data.lastRestockDate
          ? new Date(data.lastRestockDate)
          : undefined,
      },
    });
  }

  async deleteItem(id: string) {
    // If local item exists, try delete in Zoho (by SKU) then remove local record
    const local = await this.prisma.inventory.findUnique({ where: { id } });
    if (local) {
      try {
        if (local.sku) {
          const zoho = await this.zohoService.findZohoItemBySku(local.sku);
          if (zoho && typeof zoho.item_id === 'string')
            await this.zohoService.deleteItemInZoho(zoho.item_id);
        }
      } catch {
        // ignore Zoho delete errors
      }

      return this.prisma.inventory.delete({ where: { id: local.id } });
    }

    // Otherwise treat id as Zoho item id
    try {
      await this.zohoService.deleteItemInZoho(id);
      return { deleted: true };
    } catch {
      throw new NotFoundException('Item not found');
    }
  }

  async bulkDeleteItems(ids: string[]) {
    if (!Array.isArray(ids))
      throw new BadRequestException('ids must be an array');
    if (ids.length === 0) return { deleted: 0 };

    try {
      const results: any[] = [];
      for (const id of ids) {
        const local = await this.prisma.inventory.findUnique({ where: { id } });
        if (local) {
          try {
            if (local.sku) {
              const zoho = await this.zohoService.findZohoItemBySku(local.sku);
              if (zoho && typeof zoho.item_id === 'string')
                await this.zohoService.deleteItemInZoho(zoho.item_id);
            }
          } catch {
            // ignore
          }
          const deleted = await this.prisma.inventory.delete({
            where: { id: local.id },
          });
          results.push(deleted);
        } else {
          try {
            await this.zohoService.deleteItemInZoho(id);
            results.push({ deleted: true, id });
          } catch {
            // not found
          }
        }
      }
      return { deleted: results.length };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error bulk deleting inventory items',
      );
    }
  }
}
