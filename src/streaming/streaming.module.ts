import { Module } from '@nestjs/common';
import { SibnetResolver } from './sibnet.resolver';

@Module({
  providers: [SibnetResolver],
  exports: [SibnetResolver],
})
export class StreamingModule {}
