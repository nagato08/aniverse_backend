import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WatchStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

/**
 * DTO pour créer ou mettre à jour une entrée de watchlist.
 * - Utilisé pour POST (création / upsert) et PATCH (mise à jour partielle).
 */
export class UpsertWatchlistDto {
  @ApiProperty({
    example: 15125,
    description:
      "ID de l'anime (ID AniList) à ajouter/mettre à jour dans la watchlist",
  })
  @IsInt()
  @Min(1)
  animeId: number;

  @ApiPropertyOptional({
    enum: WatchStatus,
    description:
      'Statut de visionnage dans la watchlist (PLANNING, WATCHING, COMPLETED, DROPPED)',
  })
  @IsOptional()
  @IsEnum(WatchStatus)
  status?: WatchStatus;

  @ApiPropertyOptional({
    example: 3,
    description: 'Progression (épisode actuel ou dernier épisode vu)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  progress?: number;
}

/**
 * DTO pour mettre à jour une entrée de watchlist sans exiger l'animeId dans le body
 * (on le récupère dans l'URL).
 */
export class UpdateWatchlistDto {
  @ApiPropertyOptional({
    enum: WatchStatus,
    description:
      'Nouveau statut de visionnage (PLANNING, WATCHING, COMPLETED, DROPPED)',
  })
  @IsOptional()
  @IsEnum(WatchStatus)
  status?: WatchStatus;

  @ApiPropertyOptional({
    example: 10,
    description: 'Nouvelle progression (épisode actuel ou dernier épisode vu)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  progress?: number;
}
