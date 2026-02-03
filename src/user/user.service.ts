import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Champs du profil exposés (sans données sensibles). */
const PROFILE_SELECT = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  bio: true,
  favoriteGenres: true,
  preferredMood: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le profil de l'utilisateur connecté.
   * Retourne tous les champs du profil (sans passwordHash, refreshTokenHash, etc.).
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  /**
   * Met à jour le profil de l'utilisateur connecté.
   * Seuls les champs envoyés dans le body sont modifiés (PATCH partiel).
   * Vérifie l'unicité du username si fourni.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Vérifie que l'utilisateur existe
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!existing) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Si username est modifié, vérifier qu'il n'est pas déjà pris par un autre user
    if (dto.username !== undefined && dto.username !== existing.username) {
      const taken = await this.prisma.user.findUnique({
        where: { username: dto.username },
        select: { id: true },
      });
      if (taken) {
        throw new BadRequestException('Ce pseudo est déjà utilisé');
      }
    }

    // Construit l'objet de mise à jour : uniquement les champs définis
    const data: Record<string, unknown> = {};
    if (dto.username !== undefined) data.username = dto.username || null;
    if (dto.firstName !== undefined) data.firstName = dto.firstName || null;
    if (dto.lastName !== undefined) data.lastName = dto.lastName || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl || null;
    if (dto.bio !== undefined) data.bio = dto.bio || null;
    if (dto.favoriteGenres !== undefined)
      data.favoriteGenres = dto.favoriteGenres;
    if (dto.preferredMood !== undefined) data.preferredMood = dto.preferredMood;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: PROFILE_SELECT,
    });

    return updated;
  }
}
