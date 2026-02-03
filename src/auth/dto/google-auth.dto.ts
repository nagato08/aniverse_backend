import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Genre, Mood } from '@prisma/client';

/**
 * DTO pour "Continuer avec Google" (inscription)
 *
 * Le client mobile envoie l'idToken Google qu'il a récupéré côté frontend.
 * On vérifie ce token côté backend, on extrait email/nom/prénom/avatar,
 * puis l'utilisateur complète juste les préférences anime.
 */
export class RegisterWithGoogleDto {
  @ApiProperty({
    description:
      'idToken Google obtenu côté mobile après authentification Google',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ example: 'Nagato' })
  @IsOptional()
  @IsString()
  username?: string;

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

/**
 * DTO pour login avec Google
 *
 * Le client mobile envoie l'idToken Google.
 * On vérifie le token, on trouve l'user via googleId, on retourne tokens.
 */
export class LoginWithGoogleDto {
  @ApiProperty({
    description:
      'idToken Google obtenu côté mobile après authentification Google',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  idToken: string;
}
