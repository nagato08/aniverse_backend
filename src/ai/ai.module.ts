import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AnimeModule } from '../anime/anime.module';

@Module({
  imports: [ConfigModule, AnimeModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
