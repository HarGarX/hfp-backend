import { Module } from '@nestjs/common';
import { SecurityTestController } from './security-test.controller';

@Module({
  controllers: [SecurityTestController],
})
export class SecurityTestModule {}