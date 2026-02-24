import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, MaxLength, MinLength, IsInt, Min, Max } from 'class-validator';

/**
 * Body pour la recherche IA (Aniverse Genius).
 * L'utilisateur décrit en langage naturel ce qu'il cherche.
 */
export class AiSearchDto {
  @ApiProperty({
    example: 'Un anime comme Attack on Titan mais avec des samouraïs et une fin heureuse',
    description: 'Phrase en langage naturel décrivant ce que l\'utilisateur cherche',
  })
  @IsString()
  @MinLength(3, { message: 'La requête doit contenir au moins 3 caractères' })
  @MaxLength(500, { message: 'La requête ne peut pas dépasser 500 caractères' })
  query: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  perPage?: number = 20;
}
