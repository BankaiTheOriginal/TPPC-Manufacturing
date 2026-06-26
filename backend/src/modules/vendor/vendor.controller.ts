import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OperationStage } from 'generated/prisma/enums';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorService } from './vendor.service';

@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  getVendors(@Query('operationStage') operationStage?: OperationStage) {
    return this.vendorService.getVendors(operationStage);
  }

  @Get(':id')
  getVendor(@Param('id') id: string) {
    return this.vendorService.getVendor(id);
  }

  @Roles('ADMINISTRATOR', 'HEAD_OF_OPERATIONS')
  @Post()
  createVendor(@Body() body: CreateVendorDto) {
    return this.vendorService.createVendor(body);
  }

  @Roles('ADMINISTRATOR', 'HEAD_OF_OPERATIONS')
  @Patch(':id')
  updateVendor(@Param('id') id: string, @Body() body: UpdateVendorDto) {
    return this.vendorService.updateVendor(id, body);
  }

  @Roles('ADMINISTRATOR')
  @Delete(':id')
  deleteVendor(@Param('id') id: string) {
    return this.vendorService.deleteVendor(id);
  }
}