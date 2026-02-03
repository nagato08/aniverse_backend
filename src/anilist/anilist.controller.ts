import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AnilistService } from './anilist.service';
import { PaginationQueryDto } from './dto/search-query.dto';

@ApiTags('anilist')
@Controller('anilist')
export class AnilistController {
  constructor(private readonly anilist: AnilistService) {}

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des anime par titre' })
  @ApiQuery({ name: 'search', required: true, example: 'Cowboy Bebop' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, example: 20 })
  @ApiOkResponse({ description: 'Liste paginée de résultats AniList' })
  searchAnime(
    @Query('search') search: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    if (!search?.trim()) {
      return { pageInfo: null, media: [] };
    }
    return this.anilist.searchAnime(search.trim(), page, perPage);
  }

  @Get('anime/:id')
  @ApiOperation({ summary: 'Récupérer un anime par ID AniList' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ description: "Détail de l'anime ou null si non trouvé" })
  getAnimeById(@Param('id', ParseIntPipe) id: number) {
    return this.anilist.getAnimeById(id);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Anime tendance (tri TRENDING_DESC)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiOkResponse({ description: "Liste paginée d'anime tendance" })
  getTrendingAnime(@Query() pagination: PaginationQueryDto) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    return this.anilist.getTrendingAnime(page, perPage);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Anime populaires (tri POPULARITY_DESC)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiOkResponse({ description: "Liste paginée d'anime populaires" })
  getPopularAnime(@Query() pagination: PaginationQueryDto) {
    const page = pagination.page ?? 1;
    const perPage = pagination.perPage ?? 20;
    return this.anilist.getPopularAnime(page, perPage);
  }
}
