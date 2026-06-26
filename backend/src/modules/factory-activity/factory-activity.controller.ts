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
import { FactoryActivityService } from './factory-activity.service';
import { CreateFactoryActivityDto } from './dto/create-factory-activity.dto';
import { UpdateFactoryActivityDto } from './dto/update-factory-activity.dto';
import { Roles } from 'src/common/decorators/roles.decorator';

const MANAGEMENT_ROLES: any[] = ['ADMINISTRATOR', 'GENERAL_MANAGER', 'PRODUCTION_MANAGER', 'HEAD_OF_OPERATIONS', 'SUPERVISOR'];

@Controller('factory-activity')
export class FactoryActivityController {
  constructor(private readonly service: FactoryActivityService) {}

  @Roles(...MANAGEMENT_ROLES)
  @Post()
  create(@Body() dto: CreateFactoryActivityDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('locationId') locationId?: string,
    @Query('supervisorId') supervisorId?: string,
    @Query('productOrderId') productOrderId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.findAll(
      locationId,
      supervisorId,
      productOrderId,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFactoryActivityDto) {
    return this.service.update(id, dto);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
