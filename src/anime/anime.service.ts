import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from 'src/prisma.service';
import { AnilistService } from 'src/anilist/anilist.service';
import type { AnilistMedia } from 'src/anilist/anilist.types';
import { GENRE_TO_ANILIST, MOOD_TO_GENRES } from './anime.constants';
import { Mood } from '@prisma/client';

/** Structure de la réponse /anime/home (BFF personnalisée). */
export interface HomeResponse {
  forYou: AnilistMedia[];
  trending: AnilistMedia[];
  continueWatching: (AnilistMedia & { progress?: number })[];
  dailySimulcast: AnilistMedia[];
}

/** Entrée Mood avec liste d'animés. */
export interface MoodWithAnime {
  mood: Mood;
  anime: AnilistMedia[];
}

@Injectable()
export class AnimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anilist: AnilistService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Page d'accueil personnalisée selon le profil (favoriteGenres, preferredMood).
   * - forYou: animés basés sur ses genres préférés
   * - trending: tendances
   * - continueWatching: watchlist (WATCHING) + historique avec progression
   * - dailySimulcast: animés en cours de diffusion (prochaines sorties)
   */
  async getHome(userId: string): Promise<HomeResponse> {
    const cacheKey = `home_user_${userId}`;
    const cached = await this.cache.get<HomeResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteGenres: true, preferredMood: true },
    });

    const genresAnilist =
      user?.favoriteGenres?.length &&
      user.favoriteGenres.every((g) => GENRE_TO_ANILIST[g])
        ? user.favoriteGenres.map((g) => GENRE_TO_ANILIST[g])
        : ['Action', 'Comedy', 'Drama']; // fallback

    const [forYouResult, trendingResult, airingResult] = await Promise.all([
      this.anilist.getAnimeByGenres(genresAnilist, 1, 15),
      this.anilist.getTrendingAnime(1, 15),
      this.anilist.getAiringAnime(1, 15),
    ]);

    const continueWatching = await this.getContinueWatching(userId);

    const response: HomeResponse = {
      forYou: forYouResult.media,
      trending: trendingResult.media,
      continueWatching,
      dailySimulcast: airingResult.media,
    };

    // Cache la home personnalisée pour cet utilisateur (TTL ~1h)
    await this.cache.set(cacheKey, response, 60 * 60);

    return response;
  }

  /**
   * Animés "en cours de visionnage" : Watchlist (WATCHING) + Historique.
   * On fusionne les animeIds avec la progression (HistoryItem.episode ou WatchlistItem.progress).
   */
  private async getContinueWatching(
    userId: string,
  ): Promise<(AnilistMedia & { progress?: number })[]> {
    const [watchlist, history] = await Promise.all([
      this.prisma.watchlistItem.findMany({
        where: { userId, status: 'WATCHING' },
        select: { animeId: true, progress: true },
      }),
      this.prisma.historyItem.findMany({
        where: { userId },
        select: { animeId: true, episode: true },
      }),
    ]);

    const progressByAnimeId = new Map<number, number>();
    for (const h of history) progressByAnimeId.set(h.animeId, h.episode);
    for (const w of watchlist) {
      if (!progressByAnimeId.has(w.animeId))
        progressByAnimeId.set(w.animeId, w.progress);
    }

    const animeIds = [
      ...new Set([
        ...watchlist.map((w) => w.animeId),
        ...history.map((h) => h.animeId),
      ]),
    ];
    if (animeIds.length === 0) return [];

    const media = await this.anilist.getAnimeByIds(animeIds);
    return media.map((m) => ({
      ...m,
      progress: progressByAnimeId.get(m.id),
    }));
  }

  /**
   * Catégories Mood avec une sélection d'animés pour chacune.
   */
  async getMoods(perMood = 10): Promise<MoodWithAnime[]> {
    const cacheKey = `moods_per_${perMood}`;
    const cached = await this.cache.get<MoodWithAnime[]>(cacheKey);
    if (cached) return cached;

    const moods = Object.keys(MOOD_TO_GENRES) as Mood[];
    const results: MoodWithAnime[] = [];

    for (const mood of moods) {
      const genres = MOOD_TO_GENRES[mood];
      const { media } = await this.anilist.getAnimeByGenres(genres, 1, perMood);
      results.push({ mood, anime: media });
    }

    // Cache 6h : les moods ne changent pas souvent
    await this.cache.set(cacheKey, results, 60 * 60 * 6);
    return results;
  }

  /**
   * Recherche "Naviguer" avec filtres optionnels (title, genre, year).
   * Résultats cachés pour que les recherches répétées soient instantanées.
   */
  async search(
    title?: string,
    genre?: string,
    year?: number,
    page = 1,
    perPage = 20,
  ) {
    // Clé de cache basée sur tous les paramètres de recherche
    const cacheKey = `search_${title ?? ''}_${genre ?? ''}_${year ?? ''}_${page}_${perPage}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const genreIn = genre ? [genre] : undefined;
    const data = await this.anilist.searchAnimeWithFilters(
      title,
      genreIn?.[0],
      year,
      page,
      perPage,
    );

    // Cache 2h : les résultats de recherche peuvent évoluer mais pas trop vite
    await this.cache.set(cacheKey, data, 60 * 60 * 2);
    return data;
  }

  /**
   * Détails complets d'un anime (synopsis, trailer, staff, characters).
   */
  async getAnimeDetails(id: number): Promise<AnilistMedia | null> {
    const cacheKey = `anime_detail_${id}`;
    const cached = await this.cache.get<AnilistMedia>(cacheKey);
    if (cached) return cached;

    const media = await this.anilist.getAnimeDetails(id);
    if (!media) throw new NotFoundException('Anime non trouvé');

    // Cache 24h : synopsis, staff, etc. ne changent presque jamais
    await this.cache.set(cacheKey, media, 60 * 60 * 24);
    return media;
  }

  /**
   * Calendrier simulcast : animés en cours de diffusion avec prochaine sortie.
   */
  async getSimulcast(page = 1, perPage = 50) {
    const cacheKey = `simulcast_${page}_${perPage}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.anilist.getAiringAnime(page, perPage);

    // Cache 6h : simulcast mis à jour régulièrement mais pas chaque seconde
    await this.cache.set(cacheKey, data, 60 * 60 * 6);
    return data;
  }
}
