import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Genre, Mood } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'user@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MyStrongPassword123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'Nagato' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'Jean' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @IsOptional()
  @IsString()
  lastName?: string;

  // Préférences (pour personnaliser la home)
  @ApiPropertyOptional({ isArray: true, enum: Genre })
  @IsOptional()
  @IsArray()
  favoriteGenres?: Genre[];

  @ApiPropertyOptional({ enum: Mood })
  @IsOptional()
  preferredMood?: Mood;

  // Favoris "anime" (IDs AniList). On les crée dans la table Favorite.
  @ApiPropertyOptional({ example: [15125, 20583], isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  favoriteAnimeIds?: number[];
}
