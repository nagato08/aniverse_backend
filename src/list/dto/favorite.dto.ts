import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * DTO pour ajouter un anime aux favoris.
 */
export class AddFavoriteDto {
  @ApiProperty({
    example: 15125,
    description: "ID de l'anime (ID AniList) à ajouter aux favoris",
  })
  @IsInt()
  @Min(1)
  animeId: number;
}
