import { Module } from '@nestjs/common';
import { EpisodeController } from './episode.controller';
import { EpisodeService } from './episode.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EpisodeController],
  providers: [EpisodeService, PrismaService],
  exports: [EpisodeService],
})
export class EpisodeModule {}
