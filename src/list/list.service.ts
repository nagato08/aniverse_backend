import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WatchStatus } from '@prisma/client';
import { AnilistService } from '../anilist/anilist.service';
import type { AnilistMedia } from '../anilist/anilist.types';

@Injectable()
export class ListService {
  private readonly logger = new Logger(ListService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anilist: AnilistService,
  ) {}

  // ---------- FAVORIS ----------

  async getFavorites(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        animeId: true,
        createdAt: true,
      },
    });

    // Enrichir avec les détails AniList
    if (favorites.length === 0) return [];

    const animeIds = favorites.map((f) => f.animeId);
    let animeDetails: AnilistMedia[] = [];

    try {
      animeDetails = await this.anilist.getAnimeByIds(animeIds);
    } catch (error) {
      // Si AniList est inaccessible, on retourne quand même les favoris sans détails
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          `AniList inaccessible pour getFavorites, retour des favoris sans détails`,
        );
        return favorites.map((fav) => ({
          ...fav,
          anime: null,
        }));
      }
      // Sinon, on relance l'erreur
      throw error;
    }

    // Créer un Map pour accès rapide par ID
    const animeMap = new Map<number, AnilistMedia>();
    for (const anime of animeDetails) {
      animeMap.set(anime.id, anime);
    }

    // Fusionner les données
    return favorites.map((fav) => ({
      ...fav,
      anime: animeMap.get(fav.animeId) ?? null,
    }));
  }

  async addFavorite(userId: string, animeId: number) {
    try {
      return await this.prisma.favorite.create({
        data: {
          userId,
          animeId,
        },
      });
    } catch (error) {
      // Contrainte d'unicité déjà satisfaite (userId + animeId)
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Cet anime est déjà dans tes favoris pour cet utilisateur.',
        );
      }
      throw error;
    }
  }

  async removeFavorite(userId: string, animeId: number) {
    await this.prisma.favorite.deleteMany({
      where: { userId, animeId },
    });
    // deleteMany est idempotent → pas d'erreur si rien n'était enregistré.
    return { success: true };
  }

  // ---------- WATCHLIST ----------

  async getWatchlist(userId: string, status?: WatchStatus) {
    const watchlistItems = await this.prisma.watchlistItem.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        animeId: true,
        status: true,
        progress: true,
        updatedAt: true,
      },
    });

    // Enrichir avec les détails AniList
    if (watchlistItems.length === 0) return [];

    const animeIds = watchlistItems.map((item) => item.animeId);
    let animeDetails: AnilistMedia[] = [];

    try {
      animeDetails = await this.anilist.getAnimeByIds(animeIds);
    } catch (error) {
      // Si AniList est inaccessible, on retourne quand même la watchlist sans détails
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          `AniList inaccessible pour getWatchlist, retour de la watchlist sans détails`,
        );
        return watchlistItems.map((item) => ({
          ...item,
          anime: null,
        }));
      }
      // Sinon, on relance l'erreur
      throw error;
    }

    // Créer un Map pour accès rapide par ID
    const animeMap = new Map<number, AnilistMedia>();
    for (const anime of animeDetails) {
      animeMap.set(anime.id, anime);
    }

    // Fusionner les données
    return watchlistItems.map((item) => ({
      ...item,
      anime: animeMap.get(item.animeId) ?? null,
    }));
  }

  /**
   * Upsert (création ou mise à jour) d'un élément de watchlist.
   * - Si aucune entrée n'existe pour (userId, animeId) → création.
   * - Sinon → mise à jour des champs fournis.
   */
  async upsertWatchlistItem(
    userId: string,
    animeId: number,
    status?: WatchStatus,
    progress?: number,
  ) {
    return this.prisma.watchlistItem.upsert({
      where: {
        userId_animeId: {
          userId,
          animeId,
        },
      },
      create: {
        userId,
        animeId,
        status: status ?? WatchStatus.PLANNING,
        progress: progress ?? 0,
      },
      update: {
        ...(status !== undefined ? { status } : {}),
        ...(progress !== undefined ? { progress } : {}),
      },
    });
  }

  async updateWatchlistItem(
    userId: string,
    animeId: number,
    status?: WatchStatus,
    progress?: number,
  ) {
    const existing = await this.prisma.watchlistItem.findUnique({
      where: {
        userId_animeId: {
          userId,
          animeId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        "Cet anime n'existe pas dans la watchlist de cet utilisateur.",
      );
    }

    return this.prisma.watchlistItem.update({
      where: {
        userId_animeId: {
          userId,
          animeId,
        },
      },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(progress !== undefined ? { progress } : {}),
      },
    });
  }

  async removeWatchlistItem(userId: string, animeId: number) {
    await this.prisma.watchlistItem.deleteMany({
      where: { userId, animeId },
    });
    return { success: true };
  }

  // ---------- HISTORIQUE ----------

  async getHistory(userId: string) {
    const historyItems = await this.prisma.historyItem.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        animeId: true,
        episode: true,
        updatedAt: true,
      },
    });

    // Enrichir avec les détails AniList
    if (historyItems.length === 0) return [];

    const animeIds = historyItems.map((item) => item.animeId);
    let animeDetails: AnilistMedia[] = [];

    try {
      animeDetails = await this.anilist.getAnimeByIds(animeIds);
    } catch (error) {
      // Si AniList est inaccessible, on retourne quand même l'historique sans détails
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          `AniList inaccessible pour getHistory, retour de l'historique sans détails`,
        );
        return historyItems.map((item) => ({
          ...item,
          anime: null,
        }));
      }
      // Sinon, on relance l'erreur
      throw error;
    }

    // Créer un Map pour accès rapide par ID
    const animeMap = new Map<number, AnilistMedia>();
    for (const anime of animeDetails) {
      animeMap.set(anime.id, anime);
    }

    // Fusionner les données
    return historyItems.map((item) => ({
      ...item,
      anime: animeMap.get(item.animeId) ?? null,
    }));
  }

  async upsertHistoryItem(userId: string, animeId: number, episode: number) {
    return this.prisma.historyItem.upsert({
      where: {
        userId_animeId: {
          userId,
          animeId,
        },
      },
      create: {
        userId,
        animeId,
        episode,
      },
      update: {
        episode,
      },
    });
  }

  async removeHistoryItem(userId: string, animeId: number) {
    await this.prisma.historyItem.deleteMany({
      where: { userId, animeId },
    });
    return { success: true };
  }

  async clearHistory(userId: string) {
    await this.prisma.historyItem.deleteMany({
      where: { userId },
    });
    return { success: true };
  }
}
