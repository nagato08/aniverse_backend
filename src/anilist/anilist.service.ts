import { Injectable, Logger } from '@nestjs/common';
import type {
  AnilistGraphQLResponse,
  AnilistMedia,
  AnilistPageMedia,
} from './anilist.types';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

/** Champs Media utilisés dans les réponses (évite de surcharger l'API). */
const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large medium extraLarge }
  description
  genres
  averageScore
  popularity
  episodes
  status
  format
  seasonYear
  season
`;

@Injectable()
export class AnilistService {
  private readonly logger = new Logger(AnilistService.name);

  /**
   * Envoie une requête GraphQL à AniList.
   * Pas d'auth requise pour les requêtes publiques.
   */
  private async graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      this.logger.warn(`AniList HTTP ${res.status}: ${res.statusText}`);
      throw new Error(`AniList API error: ${res.status}`);
    }

    const json = (await res.json()) as AnilistGraphQLResponse<T>;
    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join('; ');
      this.logger.warn(`AniList GraphQL errors: ${msg}`);
      throw new Error(`AniList: ${msg}`);
    }

    if (json.data == null) {
      throw new Error('AniList: no data in response');
    }

    return json.data;
  }

  /**
   * Recherche des anime par titre (ou terme de recherche).
   * Utilise Page.media avec search et type: ANIME.
   */
  async searchAnime(
    search: string,
    page = 1,
    perPage = 20,
  ): Promise<{
    pageInfo: AnilistPageMedia['pageInfo'];
    media: AnilistMedia[];
  }> {
    const query = `
      query($search: String!, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage total currentPage lastPage perPage }
          media(search: $search, type: ANIME) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await this.graphql<{ Page: AnilistPageMedia }>(query, {
      search: search.trim(),
      page,
      perPage,
    });
    return {
      pageInfo: data.Page.pageInfo,
      media: data.Page.media ?? [],
    };
  }

  /**
   * Récupère un anime par son ID AniList.
   * Retourne null si l'ID ne correspond pas à un anime (ex. manga).
   */
  async getAnimeById(id: number): Promise<AnilistMedia | null> {
    const query = `
      query($id: Int!) {
        Media(id: $id, type: ANIME) {
          ${MEDIA_FIELDS}
        }
      }
    `;
    const data = await this.graphql<{ Media: AnilistMedia | null }>(query, {
      id,
    });
    return data.Media ?? null;
  }

  /**
   * Récupère plusieurs anime par leurs IDs AniList (ex. pour continueWatching).
   */
  async getAnimeByIds(ids: number[]): Promise<AnilistMedia[]> {
    if (!ids.length) return [];
    const query = `
      query($ids: [Int]) {
        Page(page: 1, perPage: ${ids.length}) {
          media(id_in: $ids, type: ANIME) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await this.graphql<{ Page: AnilistPageMedia }>(query, {
      ids,
    });
    return data.Page.media ?? [];
  }

  /**
   * Anime tendance (tri par popularité récente / trending).
   * Utilise Page.media avec sort: TRENDING_DESC.
   */
  async getTrendingAnime(
    page = 1,
    perPage = 20,
  ): Promise<{
    pageInfo: AnilistPageMedia['pageInfo'];
    media: AnilistMedia[];
  }> {
    const query = `
      query($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage total currentPage lastPage perPage }
          media(type: ANIME, sort: TRENDING_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await this.graphql<{ Page: AnilistPageMedia }>(query, {
      page,
      perPage,
    });
    return {
      pageInfo: data.Page.pageInfo,
      media: data.Page.media ?? [],
    };
  }

  /**
   * Anime populaires (tri par popularité).
   * Utilise Page.media avec sort: POPULARITY_DESC.
   */
  async getPopularAnime(
    page = 1,
    perPage = 20,
  ): Promise<{
    pageInfo: AnilistPageMedia['pageInfo'];
    media: AnilistMedia[];
  }> {
    const query = `
      query($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage total currentPage lastPage perPage }
          media(type: ANIME, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await this.graphql<{ Page: AnilistPageMedia }>(query, {
      page,
      perPage,
    });
    return {
      pageInfo: data.Page.pageInfo,
      media: data.Page.media ?? [],
    };
  }

  /**
   * Anime filtrés par genres (ex. pour "For You" selon favoriteGenres).
   * Utilise Page.media avec genre_in et type: ANIME.
   */
  async getAnimeByGenres(
    genres: string[],
    page = 1,
    perPage = 20,
  ): Promise<{
    pageInfo: AnilistPageMedia['pageInfo'];
    media: AnilistMedia[];
  }> {
    if (!genres?.length) {
      return { pageInfo: null, media: [] };
    }
    const query = `
      query($genreIn: [String], $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage total currentPage lastPage perPage }
          media(type: ANIME, genre_in: $genreIn, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const data = await this.graphql<{ Page: AnilistPageMedia }>(query, {
      genreIn: genres,
      page,
      perPage,
    });
    return {
      pageInfo: data.Page.pageInfo,
      media: data.Page.media ?? [],
    };
  }

  /** Champs Media pour la page Détails (synopsis, trailer, staff, characters). */
  private static get MEDIA_DETAIL_FIELDS(): string {
    return `
      id
      title { romaji english native }
      coverImage { large medium extraLarge }
      bannerImage
      description
      genres
      averageScore
      popularity
      episodes
      status
      format
      seasonYear
      season
      trailer { id site thumbnail }
      staff(page: 1, perPage: 10) { edges { role node { name { full } } } }
      characters(page: 1, perPage: 10) { edges { role node { name { full } image { medium } } } }
    `;
  }

  /**
   * Détails complets d'un anime (synopsis, trailer, staff, characters).
   */
  async getAnimeDetails(id: number): Promise<AnilistMedia | null> {
    const query = `
      query($id: Int!) {
        Media(id: $id, type: ANIME) {
          ${AnilistService.MEDIA_DETAIL_FIELDS}
        }
      }
    `;
    const data = await this.graphql<{ Media: AnilistMedia | null }>(query, {
      id,
    });
    return data.Media ?? null;
  }

  /**
   * Anime en cours de diffusion (RELEASING) avec leur prochain épisode (simulcast).
   * Tri par date de prochaine diffusion.
   */
  async getAiringAnime(
    page = 1,
    perPage = 50,
  ): Promise<{
    pageInfo: AnilistPageMedia['pageInfo'];
    media: AnilistMedia[];
  }> {
    const mediaFieldsWithAiring = `
      id
      title { romaji english native }
      coverImage { large medium extraLarge }
      description
      genres
      averageScore
      popularity
      episodes
      status
      format
      seasonYear
      season
      nextAiringEpisode { airingAt episode timeUntilAiring }
    `;
    const query = `
      query($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage total currentPage lastPage perPage }
          media(type: ANIME, status: RELEASING, sort: [TRENDING_DESC]) {
            ${mediaFieldsWithAiring}
          }
        }
      }
    `;
    const data = await this.graphql<{ Page: AnilistPageMedia }>(query, {
      page,
      perPage,
    });
    return {
      pageInfo: data.Page.pageInfo,
      media: data.Page.media ?? [],
    };
  }

  /**
   * Recherche avec filtres optionnels (titre, genre, année).
   */
  async searchAnimeWithFilters(
    search?: string,
    genre?: string,
    year?: number,
    page = 1,
    perPage = 20,
  ): Promise<{
    pageInfo: AnilistPageMedia['pageInfo'];
    media: AnilistMedia[];
  }> {
    const query = `
      query($page: Int, $perPage: Int, $search: String, $genreIn: [String], $seasonYear: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage total currentPage lastPage perPage }
          media(type: ANIME, search: $search, genre_in: $genreIn, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const variables: Record<string, unknown> = { page, perPage };
    if (search?.trim()) variables.search = search.trim();
    if (genre?.trim()) variables.genreIn = [genre.trim()];
    if (year) variables.seasonYear = year;
    const data = await this.graphql<{ Page: AnilistPageMedia }>(
      query,
      variables,
    );
    return {
      pageInfo: data.Page.pageInfo,
      media: data.Page.media ?? [],
    };
  }
}
