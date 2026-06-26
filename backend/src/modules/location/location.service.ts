import { PrismaService } from 'src/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async createLocation(input: CreateLocationDto) {
    return this.prisma.location.create({
      data: {
        name: input.name,
        country: 'NIGERIA',
        state: input.state,
        addressLine: input.addressLine,
      },
    });
  }

  async updateLocation(id: string, input: UpdateLocationDto) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');

    return this.prisma.location.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.addressLine !== undefined && {
          addressLine: input.addressLine,
        }),
      },
    });
  }

  async deleteLocation(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');
    return this.prisma.location.delete({ where: { id } });
  }

  async getLocation(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async getLocations() {
    return this.prisma.location.findMany({ orderBy: { name: 'asc' } });
  }
}
