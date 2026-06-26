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
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';
import { BulkDeleteDto } from '../production-orders/dto/bulk-delete.dto';
import {
  Cache,
  CACHE_MANAGER,
  CacheInterceptor,
  CacheTTL,
} from '@nestjs/cache-manager';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES', 'PRODUCTION_MANAGER', 'SUPERVISOR')
  @Get()
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('role') role?: string,
  ) {
    return this.userService.getUsers(Number(page), Number(limit), role);
  }
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @Get('/:id')
  @Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES')
  async getUser(@Param('id') id: string) {
    return this.userService.getUser(id);
  }

  @Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES')
  @Patch('/:id')
  async updateUser(@Body() data: UpdateUserDto, @Param('id') id: string) {
    const result = await this.userService.updateUser(id, data);
    await this.cacheManager.del(`/users/${id}`);
    await this.cacheManager.clear();
    return result;
  }

  @Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES')
  @Delete('/:id')
  async deleteUser(@Param('id') id: string) {
    const result = await this.userService.deleteUser(id);
    await this.cacheManager.del(`/users/${id}`);
    await this.cacheManager.clear();
    return result;
  }

  @Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES')
  @Post('bulk-delete')
  async bulkDeleteUsers(@Body() body: BulkDeleteDto) {
    const result = await this.userService.bulkDeleteUsers(body.ids);
    await this.cacheManager.clear();
    return result;
  }

  @Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES')
  @Post('import')
  async importUsers(@Body() body: ImportUsersDto) {
    const result = await this.userService.importUsers(body);
    await this.cacheManager.clear();
    return result;
  }
}
