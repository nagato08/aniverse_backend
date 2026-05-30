/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-require-imports */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Sécurité HTTP : headers contre XSS, clickjacking, etc.
  app.use(helmet());

  // Proxy HLS/M3U monté directement sur Express (bypass NestJS, pas de validation/guards)
  // Routes disponibles :
  //   GET /api/proxy/stream?url=...   → manifestes .m3u8 (URLs réécrites automatiquement)
  //   GET /api/proxy/segment?url=...  → segments .ts/.m4s
  //   GET /api/proxy/m3u?url=...      → playlists M3U
  const expressApp = app.getHttpAdapter().getInstance();
  const proxyRouter = require('./proxy.routes');
  expressApp.use('/api/proxy', proxyRouter);

  const config = new DocumentBuilder()
    .setTitle('API Aniverse')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  // Validation des entrées : ne jamais faire confiance au client
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
