import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEpisodeDto {
  @ApiProperty({ example: 21, description: "ID AniList de l'anime" })
  @IsInt()
  @Min(1)
  animeId!: number;

  @ApiProperty({ example: 1, description: "Numero de l'episode" })
  @IsInt()
  @Min(1)
  episodeNumber!: number;

  @ApiPropertyOptional({ example: "Le debut de l'aventure" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    example: 'https://moo265724.moovbob.fr/files/aa/exemple.m3u8',
  })
  @IsNotEmpty()
  @IsUrl()
  streamUrl!: string;
}
