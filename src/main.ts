import './polyfills';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable validation pipes globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Remove unknown properties
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties
    transform: true, // Auto transform payloads
  }));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('HFP API')
    .setDescription('Household Financial Platform - Multi-tenant financial management platform with local JWT authentication')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token (obtained from /auth/login or /auth/register)',
        in: 'header',
      },
    )
    .addTag('Authentication', 'User authentication - login, register, and profile management')
    .addTag('Users', 'User management and profiles')
    .addTag('Households', 'Household management and member operations')
    .addTag('Accounts', 'Financial account management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
