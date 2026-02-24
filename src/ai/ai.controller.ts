import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiSearchDto } from './dto/ai-search.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('search')
  @ApiOperation({
    summary: "Aniverse Genius – Recherche en langage naturel",
    description:
      "Envoie une phrase décrivant ce que tu cherches (ex: « un anime comme Attack on Titan avec des samouraïs »). " +
      "L'IA extrait les filtres et retourne les animés correspondants avec un résumé de ce qui a été compris.",
  })
  @ApiBody({ type: AiSearchDto })
  @ApiOkResponse({
    description: '{ filters: { title, genre, year, summary }, pageInfo, media }',
  })
  searchByNaturalLanguage(
    @Body() dto: AiSearchDto,
  ) {
    return this.ai.searchByNaturalLanguage(
      dto.query,
      dto.page ?? 1,
      dto.perPage ?? 20,
    );
  }
}
