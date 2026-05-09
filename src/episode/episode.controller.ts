/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { EpisodeService } from './episode.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';

@ApiTags('Episodes')
@Controller('episodes')
export class EpisodeController {
  constructor(private readonly episodeService: EpisodeService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un episode' })
  create(@Body() dto: CreateEpisodeDto) {
    return this.episodeService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Ajouter plusieurs episodes en une fois' })
  createMany(@Body() episodes: CreateEpisodeDto[]) {
    return this.episodeService.createMany(episodes);
  }

  @Get(':animeId')
  @ApiOperation({ summary: "Lister les episodes d'un anime" })
  @ApiParam({ name: 'animeId', example: 21 })
  findByAnime(@Param('animeId', ParseIntPipe) animeId: number) {
    return this.episodeService.findByAnime(animeId);
  }

  @Get(':animeId/:episodeNumber/stream')
  @ApiOperation({
    summary: "Obtenir l'URL de streaming proxifiee d'un episode",
  })
  @ApiParam({ name: 'animeId', example: 21 })
  @ApiParam({ name: 'episodeNumber', example: 1 })
  getStreamUrl(
    @Param('animeId', ParseIntPipe) animeId: number,
    @Param('episodeNumber', ParseIntPipe) episodeNumber: number,
    @Req() req: any,
  ) {
    const protocol =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.secure ? 'https' : 'http');
    const host = req.get('host') as string;
    return this.episodeService.getStreamUrl(
      animeId,
      episodeNumber,
      host,
      protocol,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un episode' })
  update(@Param('id') id: string, @Body() dto: UpdateEpisodeDto) {
    return this.episodeService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un episode' })
  remove(@Param('id') id: string) {
    return this.episodeService.remove(id);
  }

  @Delete('anime/:animeId')
  @ApiOperation({ summary: "Supprimer tous les episodes d'un anime" })
  removeAllByAnime(@Param('animeId', ParseIntPipe) animeId: number) {
    return this.episodeService.removeAllByAnime(animeId);
  }
}
