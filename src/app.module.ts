import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AnilistModule } from './anilist/anilist.module';
import { AnimeModule } from './anime/anime.module';
import { UserModule } from './user/user.module';
import { ListModule } from './list/list.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
    }),
    AuthModule,
    AnilistModule,
    AnimeModule,
    UserModule,
    ListModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
