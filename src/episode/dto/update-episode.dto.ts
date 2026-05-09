import { IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEpisodeDto {
  @ApiPropertyOptional({ example: "Le debut de l'aventure" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'https://moo265724.moovbob.fr/files/aa/exemple.m3u8',
  })
  @IsOptional()
  @IsUrl()
  streamUrl?: string;
}
