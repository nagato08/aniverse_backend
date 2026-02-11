import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Genre, Mood } from '@prisma/client';

/**
 * DTO pour récupérer le profil Google sans créer de compte.
 * Utilisé à l'étape 1 de l'inscription "Continuer avec Google" pour pré-remplir
 * prénom, nom, email. Le frontend garde l'idToken pour l'appel final à /auth/google/register.
 */
export class GoogleProfilePrefillDto {
  @ApiProperty({
    description: 'idToken Google obtenu après Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  idToken: string;
}

/**
 * DTO pour "Continuer avec Google" (inscription multi-étapes)
 *
 * Appelé à la fin du parcours : username, phone, bio (étape 2),
 * genres/moods (étape 3), avatar (étape 4) sont envoyés avec l'idToken.
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
  @MaxLength(50)
  username?: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: "Fan d'anime depuis 2010" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ isArray: true, enum: Genre })
  @IsOptional()
  @IsArray()
  favoriteGenres?: Genre[];

  @ApiPropertyOptional({ enum: Mood })
  @IsOptional()
  preferredMood?: Mood;

  /** URL de l'avatar choisi (ex: issu de GET /user/avatars) ou photo Google si non fourni */
  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../avatar.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: [15125, 20583], isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  favoriteAnimeIds?: number[];
}

/**
 * DTO pour login avec Google (connexion ou inscription en un seul appel)
 *
 * Le client envoie l'idToken Google. Si un compte existe → connexion.
 * Si aucun compte n'existe → création automatique (comme /auth/google/register)
 * avec les champs optionnels ci-dessous, puis connexion. Plus besoin d'erreur 401.
 */
export class LoginWithGoogleDto {
  @ApiProperty({
    description:
      'idToken Google obtenu côté mobile après authentification Google',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  idToken: string;

  /** Utilisé uniquement si un nouveau compte est créé (pas encore inscrit). */
  @ApiPropertyOptional({ example: 'Nagato' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ isArray: true, enum: Genre })
  @IsOptional()
  @IsArray()
  favoriteGenres?: Genre[];

  @ApiPropertyOptional({ enum: Mood })
  @IsOptional()
  preferredMood?: Mood;

  @ApiPropertyOptional({ example: [15125, 20583], isArray: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  favoriteAnimeIds?: number[];
}
