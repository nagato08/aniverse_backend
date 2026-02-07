import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Genre, Mood } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CloudinaryService } from './cloudinary.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Vérifie si un username est disponible (non utilisé par un autre utilisateur).
   * Route publique, utilisée pour la validation en temps réel dans le formulaire d'inscription.
   *
   * @param username - Le pseudo à vérifier
   * @returns { available: boolean } - true si le pseudo est libre, false sinon
   */
  async checkUsernameAvailability(
    username: string,
  ): Promise<{ available: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return { available: !existing };
  }

  /**
   * Récupère la liste des avatars disponibles depuis Cloudinary.
   * Route publique, utilisée à l'étape 4 de l'inscription.
   *
   * @param folder - Sous-dossier optionnel pour filtrer (ex: "action", "horror")
   * @returns Liste d'avatars (id, name, url, folder)
   *
   * Fonctionnement DYNAMIQUE :
   * - Lit directement le dossier aniverse/avatars/ sur Cloudinary
   * - Tu uploades une image → elle apparaît automatiquement ici
   * - Pas besoin de modifier le code pour ajouter un avatar
   */
  async getAvatars(folder?: string) {
    return this.cloudinary.getAvatars(folder);
  }

  /**
   * Récupère les sous-dossiers disponibles pour les avatars.
   * Utile pour afficher des catégories dans le frontend.
   */
  async getAvatarFolders() {
    return this.cloudinary.getFolders();
  }

  /**
   * Upload un avatar dans le dossier Cloudinary.
   *
   * @param file - Fichier image uploadé
   * @param name - Nom optionnel pour l'avatar
   */
  async uploadAvatar(file: Express.Multer.File, name?: string) {
    return this.cloudinary.uploadAvatar(file, name);
  }

  /**
   * Supprime un avatar par son public_id.
   */
  async deleteAvatar(publicId: string) {
    return this.cloudinary.deleteAvatar(publicId);
  }

  /**
   * Récupère la liste des genres disponibles.
   * Route publique, utilisée à l'étape 3 de l'inscription.
   *
   * @returns Liste des genres avec leur valeur et un label lisible
   *
   * Le frontend peut ainsi afficher des chips/boutons sans coder en dur les valeurs.
   */
  getGenres(): { value: Genre; label: string }[] {
    // Mapping des valeurs enum vers des labels lisibles
    const genreLabels: Record<Genre, string> = {
      [Genre.ACTION]: 'Action',
      [Genre.ADVENTURE]: 'Aventure',
      [Genre.COMEDY]: 'Comédie',
      [Genre.DRAMA]: 'Drame',
      [Genre.FANTASY]: 'Fantasy',
      [Genre.HORROR]: 'Horreur',
      [Genre.MYSTERY]: 'Mystère',
      [Genre.ROMANCE]: 'Romance',
      [Genre.SCI_FI]: 'Science-Fiction',
      [Genre.SLICE_OF_LIFE]: 'Tranche de vie',
    };

    return Object.values(Genre).map((genre) => ({
      value: genre,
      label: genreLabels[genre],
    }));
  }

  /**
   * Récupère la liste des moods disponibles.
   * Route publique, utilisée à l'étape 3 de l'inscription.
   *
   * @returns Liste des moods avec leur valeur, un label et une description/emoji
   */
  getMoods(): { value: Mood; label: string; description: string }[] {
    const moodData: Record<Mood, { label: string; description: string }> = {
      [Mood.CHILL]: {
        label: 'Chill',
        description: '🌙 Détente et ambiance calme',
      },
      [Mood.DARK]: {
        label: 'Dark',
        description: '🖤 Sombre et intense',
      },
      [Mood.HYPE]: {
        label: 'Hype',
        description: '⚡ Action et adrénaline',
      },
      [Mood.EMOTIONAL]: {
        label: 'Emotional',
        description: '💧 Émouvant et touchant',
      },
    };

    return Object.values(Mood).map((mood) => ({
      value: mood,
      label: moodData[mood].label,
      description: moodData[mood].description,
    }));
  }

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
