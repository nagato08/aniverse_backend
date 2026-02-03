import { Module } from '@nestjs/common';
import { AnilistService } from './anilist.service';
import { AnilistController } from './anilist.controller';

@Module({
  controllers: [AnilistController],
  providers: [AnilistService],
  exports: [AnilistService],
})
export class AnilistModule {}
