import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'http://102.223.38.207',
    'https://tppc.exxforce.com',
  ];
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}
void bootstrap();
