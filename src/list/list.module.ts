import { Module } from '@nestjs/common';
import { ListController } from './list.controller';
import { ListService } from './list.service';
import { PrismaService } from '../prisma.service';
import { AnilistModule } from '../anilist/anilist.module';

@Module({
  imports: [AnilistModule],
  controllers: [ListController],
  providers: [ListService, PrismaService],
})
export class ListModule {}
