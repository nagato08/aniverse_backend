import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WatchStatus } from '@prisma/client';

@Injectable()
export class ListService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- FAVORIS ----------

  async getFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        animeId: true,
        createdAt: true,
      },
    });
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
    return this.prisma.watchlistItem.findMany({
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
    return this.prisma.historyItem.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        animeId: true,
        episode: true,
        updatedAt: true,
      },
    });
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
