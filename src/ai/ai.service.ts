import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnimeService } from '../anime/anime.service';
import { GENRE_TO_ANILIST } from '../anime/anime.constants';

/** Filtres extraits par l'IA à partir du message utilisateur. */
export interface ExtractedFilters {
  title?: string | null;
  genre?: string | null;
  year?: number | null;
  /** Résumé court de ce que l'IA a compris (pour affichage à l'utilisateur). */
  summary?: string | null;
}

/** Réponse de l'endpoint /ai/search. */
export interface AiSearchResponse {
  /** Filtres extraits par l'IA. */
  filters: ExtractedFilters;
  /** Résultats anime (même structure que GET /anime/search). */
  pageInfo: {
    hasNextPage: boolean;
    total: number;
    currentPage: number;
    lastPage: number;
    perPage: number;
  };
  media: unknown[];
}

const VALID_GENRES = Object.values(GENRE_TO_ANILIST);
const GENRES_STRING = VALID_GENRES.join(', ');

const SYSTEM_PROMPT = `Tu es un assistant qui convertit une demande utilisateur en filtres de recherche pour une base d'animés (AniList).

Règles:
- Extrais UNIQUEMENT les informations suivantes depuis le message: titre (anime ou mot-clé), genre, année de sortie.
- Le genre doit être EXACTEMENT un de: ${GENRES_STRING}. Si l'utilisateur parle d'ambiance (ex: "chill", "dark", "action") mappe vers le genre AniList le plus proche.
- Si l'utilisateur dit "comme X" ou "similaire à X", tu peux mettre X (ou un mot-clé) dans "title" et/ou choisir un "genre" adapté.
- "year" doit être un nombre (année) ou null.
- Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour. Format:
{"title": string | null, "genre": string | null, "year": number | null, "summary": string}
- "summary" est une courte phrase en français résumant ce que tu as compris (ex: "Action, style samouraï, fin heureuse").`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly animeService: AnimeService,
  ) {}

  /**
   * Envoie la requête à l'API OpenAI pour extraire les filtres.
   * Utilise fetch pour éviter une dépendance lourde ; fonctionne avec OPENAI_API_KEY.
   */
  private async extractFiltersWithOpenAI(
    userMessage: string,
  ): Promise<ExtractedFilters> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey?.trim()) {
      throw new ServiceUnavailableException(
        'Recherche IA non configurée: OPENAI_API_KEY manquant dans .env',
      );
    }

    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' as const },
      max_tokens: 300,
      temperature: 0.2,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.warn(`OpenAI API error ${res.status}: ${errText}`);
      throw new ServiceUnavailableException(
        'Service IA temporairement indisponible. Réessaie plus tard.',
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException('Réponse IA invalide.');
    }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const genre =
        typeof parsed.genre === 'string' && VALID_GENRES.includes(parsed.genre)
          ? parsed.genre
          : null;
      const year =
        typeof parsed.year === 'number' &&
        parsed.year >= 1900 &&
        parsed.year <= 2100
          ? parsed.year
          : null;
      const title =
        typeof parsed.title === 'string' && parsed.title.trim().length > 0
          ? parsed.title.trim()
          : null;
      const summary =
        typeof parsed.summary === 'string' ? parsed.summary.trim() : null;

      return {
        title: title ?? undefined,
        genre: genre ?? undefined,
        year: year ?? undefined,
        summary: summary ?? undefined,
      };
    } catch {
      this.logger.warn(
        'OpenAI response was not valid JSON, using empty filters',
      );
      return {};
    }
  }

  /**
   * Recherche par langage naturel : extrait les filtres via l'IA puis appelle la recherche anime.
   */
  async searchByNaturalLanguage(
    query: string,
    page = 1,
    perPage = 20,
  ): Promise<AiSearchResponse> {
    const filters = await this.extractFiltersWithOpenAI(query);

    const title = filters.title ?? undefined;
    const genre = filters.genre ?? undefined;
    const year = filters.year ?? undefined;

    const result = (await this.animeService.search(
      title,
      genre,
      year,
      page,
      perPage,
    )) as {
      pageInfo: AiSearchResponse['pageInfo'];
      media: unknown[];
    };

    return {
      filters: {
        title: filters.title ?? null,
        genre: filters.genre ?? null,
        year: filters.year ?? null,
        summary: filters.summary ?? null,
      },
      pageInfo: result.pageInfo,
      media: result.media,
    };
  }
}
