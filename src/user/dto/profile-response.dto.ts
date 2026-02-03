import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Genre, Mood } from '@prisma/client';

/**
 * Réponse du profil utilisateur (sans champs sensibles).
 */
export class ProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  username: string | null;

  @ApiPropertyOptional({ nullable: true })
  firstName: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastName: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio: string | null;

  @ApiProperty({ type: [String], enum: Genre })
  favoriteGenres: Genre[];

  @ApiPropertyOptional({ enum: Mood, nullable: true })
  preferredMood: Mood | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
