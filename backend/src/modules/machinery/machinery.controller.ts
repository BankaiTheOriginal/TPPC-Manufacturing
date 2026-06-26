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
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { MachineryService } from './machinery.service';

@Controller('machinery')
export class MachineryController {
  constructor(private readonly machineryService: MachineryService) {}

  @Get()
  getMachinery(@Query('operationStage') operationStage?: OperationStage) {
    return this.machineryService.getMachinery(operationStage);
  }

  @Get(':id')
  getMachine(@Param('id') id: string) {
    return this.machineryService.getMachine(id);
  }

  @Roles('ADMINISTRATOR', 'HEAD_OF_OPERATIONS')
  @Post()
  createMachine(@Body() body: CreateMachineDto) {
    return this.machineryService.createMachine(body);
  }

  @Roles('ADMINISTRATOR', 'HEAD_OF_OPERATIONS')
  @Patch(':id')
  updateMachine(@Param('id') id: string, @Body() body: UpdateMachineDto) {
    return this.machineryService.updateMachine(id, body);
  }

  @Roles('ADMINISTRATOR')
  @Delete(':id')
  deleteMachine(@Param('id') id: string) {
    return this.machineryService.deleteMachine(id);
  }
}