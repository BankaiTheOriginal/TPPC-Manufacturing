import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(private config: ConfigService) {
    const database_url = config.getOrThrow<string>('database_url');
    const adapter = new PrismaPg({
      connectionString: database_url,
    });

    super({ adapter });
  }
}
