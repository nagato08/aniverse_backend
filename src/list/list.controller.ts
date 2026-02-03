/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ListService } from './list.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AddFavoriteDto } from './dto/favorite.dto';
import { UpsertWatchlistDto, UpdateWatchlistDto } from './dto/watchlist.dto';
import { UpsertHistoryDto } from './dto/history.dto';
import { WatchStatus } from '@prisma/client';

@ApiTags('List')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('list')
export class ListController {
  constructor(private readonly listService: ListService) {}

  // ---------- FAVORIS ----------

  @Get('favorites')
  @ApiOperation({
    summary: 'Lister les favoris de l’utilisateur connecté',
    description:
      'Retourne tous les animes marqués comme favoris par cet utilisateur (basé sur son JWT).',
  })
  async getFavorites(@GetUser() user: { userId: string }) {
    return await this.listService.getFavorites(user.userId);
  }

  @Post('favorites')
  @ApiOperation({
    summary: 'Ajouter un anime aux favoris',
    description:
      'Ajoute un anime à la liste de favoris de l’utilisateur. Renvoie une erreur 409 si déjà présent.',
  })
  async addFavorite(
    @GetUser() user: { userId: string },
    @Body() dto: AddFavoriteDto,
  ) {
    return await this.listService.addFavorite(user.userId, dto.animeId);
  }

  @Delete('favorites/:animeId')
  @ApiOperation({
    summary: 'Retirer un anime des favoris',
    description:
      'Supprime un anime des favoris de l’utilisateur. Idempotent : ne renvoie pas d’erreur si rien à supprimer.',
  })
  @ApiParam({
    name: 'animeId',
    type: Number,
    description: "ID AniList de l'anime à retirer des favoris",
  })
  async removeFavorite(
    @GetUser() user: { userId: string },
    @Param('animeId', ParseIntPipe) animeId: number,
  ) {
    return await this.listService.removeFavorite(user.userId, animeId);
  }

  // ---------- WATCHLIST ----------

  @Get('watchlist')
  @ApiOperation({
    summary: 'Lister la watchlist de l’utilisateur',
    description:
      'Retourne les animes de la watchlist, optionnellement filtrés par statut (PLANNING, WATCHING, COMPLETED, DROPPED).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WatchStatus,
    description:
      'Filtrer par statut de visionnage (PLANNING, WATCHING, COMPLETED, DROPPED)',
  })
  async getWatchlist(
    @GetUser() user: { userId: string },
    @Query('status') status?: WatchStatus,
  ) {
    return await this.listService.getWatchlist(user.userId, status);
  }

  @Post('watchlist')
  @ApiOperation({
    summary: 'Ajouter ou mettre à jour un anime dans la watchlist',
    description:
      "Crée ou met à jour une entrée de watchlist pour l'utilisateur. Si elle n'existe pas, elle est créée avec un statut par défaut PLANNING.",
  })
  async upsertWatchlist(
    @GetUser() user: { userId: string },
    @Body() dto: UpsertWatchlistDto,
  ) {
    return await this.listService.upsertWatchlistItem(
      user.userId,
      dto.animeId,
      dto.status,
      dto.progress,
    );
  }

  @Patch('watchlist/:animeId')
  @ApiOperation({
    summary: 'Mettre à jour une entrée existante de la watchlist',
    description:
      "Modifie le statut et/ou la progression d'un anime déjà présent dans la watchlist. Renvoie 404 si l'entrée n'existe pas.",
  })
  @ApiParam({
    name: 'animeId',
    type: Number,
    description: "ID AniList de l'anime à mettre à jour dans la watchlist",
  })
  async updateWatchlist(
    @GetUser() user: { userId: string },
    @Param('animeId', ParseIntPipe) animeId: number,
    @Body() dto: UpdateWatchlistDto,
  ) {
    return await this.listService.updateWatchlistItem(
      user.userId,
      animeId,
      dto.status,
      dto.progress,
    );
  }

  @Delete('watchlist/:animeId')
  @ApiOperation({
    summary: 'Retirer un anime de la watchlist',
    description:
      "Supprime une entrée de watchlist pour l'utilisateur connecté. Idempotent.",
  })
  @ApiParam({
    name: 'animeId',
    type: Number,
    description: "ID AniList de l'anime à retirer de la watchlist",
  })
  async removeWatchlist(
    @GetUser() user: { userId: string },
    @Param('animeId', ParseIntPipe) animeId: number,
  ) {
    return await this.listService.removeWatchlistItem(user.userId, animeId);
  }

  // ---------- HISTORIQUE ----------

  @Get('history')
  @ApiOperation({
    summary: "Lister l'historique de visionnage",
    description:
      "Retourne la liste des derniers épisodes vus par l'utilisateur (1 ligne par anime).",
  })
  async getHistory(@GetUser() user: { userId: string }) {
    return await this.listService.getHistory(user.userId);
  }

  @Post('history')
  @ApiOperation({
    summary: "Créer ou mettre à jour l'historique pour un anime",
    description:
      'Enregistre le dernier épisode vu pour un anime. Si une entrée existe déjà, elle est mise à jour.',
  })
  async upsertHistory(
    @GetUser() user: { userId: string },
    @Body() dto: UpsertHistoryDto,
  ) {
    return await this.listService.upsertHistoryItem(
      user.userId,
      dto.animeId,
      dto.episode,
    );
  }

  @Delete('history/:animeId')
  @ApiOperation({
    summary: "Supprimer l'historique d'un anime",
    description:
      "Efface l'entrée d'historique pour un anime spécifique de l'utilisateur.",
  })
  @ApiParam({
    name: 'animeId',
    type: Number,
    description: "ID AniList de l'anime dont on veut effacer l'historique",
  })
  async removeHistory(
    @GetUser() user: { userId: string },
    @Param('animeId', ParseIntPipe) animeId: number,
  ) {
    return await this.listService.removeHistoryItem(user.userId, animeId);
  }

  @Delete('history')
  @ApiOperation({
    summary: "Vider tout l'historique",
    description:
      "Supprime toutes les entrées d'historique de l'utilisateur connecté.",
  })
  async clearHistory(@GetUser() user: { userId: string }) {
    return await this.listService.clearHistory(user.userId);
  }
}
