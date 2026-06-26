import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get()
  getLocations() {
    return this.locationService.getLocations();
  }

  @Get(':id')
  getLocation(@Param('id') id: string) {
    return this.locationService.getLocation(id);
  }

  @Roles('ADMINISTRATOR', 'HEAD_OF_OPERATIONS')
  @Post()
  createLocation(@Body() body: CreateLocationDto) {
    return this.locationService.createLocation(body);
  }

  @Roles('ADMINISTRATOR', 'HEAD_OF_OPERATIONS')
  @Patch(':id')
  updateLocation(@Param('id') id: string, @Body() body: UpdateLocationDto) {
    return this.locationService.updateLocation(id, body);
  }

  @Roles('ADMINISTRATOR')
  @Delete(':id')
  deleteLocation(@Param('id') id: string) {
    return this.locationService.deleteLocation(id);
  }
}
