import { Module } from '@nestjs/common';
import { AnimeController } from './anime.controller';
import { AnimeService } from './anime.service';
import { AnilistModule } from 'src/anilist/anilist.module';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [AnilistModule],
  controllers: [AnimeController],
  providers: [AnimeService, PrismaService],
})
export class AnimeModule {}
