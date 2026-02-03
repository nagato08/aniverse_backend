/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AnimeService } from './anime.service';
import {
  AnimeSearchQueryDto,
  PaginationQueryDto,
} from './dto/search-query.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly anime: AnimeService) {}

  @Get('home')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Page d'accueil personnalisée",
    description:
      "For You (genres préférés), Tendances, Continue à regarder (watchlist/historique), Simulcast du jour. Filtré selon le profil (formulaire d'inscription).",
  })
  @ApiOkResponse({
    description: '{ forYou, trending, continueWatching, dailySimulcast }',
  })
  getHome(@GetUser() user: { userId: string }) {
    return this.anime.getHome(user.userId);
  }

  @Get('moods')
  @ApiOperation({
    summary: 'Catégories Mood avec animés',
    description:
      "CHILL, DARK, HYPE, EMOTIONAL avec une sélection d'animés pour chacune.",
  })
  @ApiOkResponse({ description: 'Liste { mood, anime }[]' })
  getMoods(@Query('perMood') perMood?: number) {
    return this.anime.getMoods(perMood ? Number(perMood) : 10);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Recherche / Naviguer',
    description: 'Query params: title, genre, year (optionnels).',
  })
  @ApiOkResponse({ description: 'Liste paginée avec pageInfo et media' })
  search(@Query() query: AnimeSearchQueryDto) {
    return this.anime.search(
      query.title,
      query.genre,
      query.year,
      query.page ?? 1,
      query.perPage ?? 20,
    );
  }

  @Get('simulcast')
  @ApiOperation({
    summary: 'Calendrier simulcast',
    description:
      'Animés en cours de diffusion avec prochaine sortie (nextAiringEpisode).',
  })
  @ApiOkResponse({ description: 'Liste paginée avec pageInfo et media' })
  getSimulcast(@Query() pagination: PaginationQueryDto) {
    return this.anime.getSimulcast(
      pagination.page ?? 1,
      pagination.perPage ?? 50,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détails complets d'un anime",
    description: 'Synopsis, Trailer, Staff, Characters.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ description: 'Détail Media AniList' })
  getAnimeDetails(@Param('id', ParseIntPipe) id: number) {
    return this.anime.getAnimeDetails(id);
  }
}
