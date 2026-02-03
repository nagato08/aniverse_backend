import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * DTO pour créer ou mettre à jour une entrée d'historique.
 */
export class UpsertHistoryDto {
  @ApiProperty({
    example: 15125,
    description: "ID de l'anime (ID AniList) à enregistrer dans l'historique",
  })
  @IsInt()
  @Min(1)
  animeId: number;

  @ApiProperty({
    example: 7,
    description: 'Dernier épisode vu pour cet anime',
  })
  @IsInt()
  @Min(1)
  episode: number;
}
