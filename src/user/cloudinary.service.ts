/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Service pour interagir avec l'API Cloudinary.
 *
 * Permet de lister dynamiquement les images uploadées dans un dossier,
 * sans avoir à les déclarer manuellement dans le code.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { v2 as cloudinary, ResourceApiResponse } from 'cloudinary';

export interface CloudinaryAvatar {
  id: string; // Public ID (ex: "aniverse/avatars/goku")
  name: string; // Nom affiché (ex: "goku")
  url: string; // URL avec transformations
  folder: string; // Sous-dossier (ex: "action" ou "")
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  /**
   * Transformations appliquées aux avatars :
   * - w_200,h_200 : taille 200x200
   * - c_fill : recadrage pour remplir
   * - f_auto : format automatique (WebP si supporté)
   * - q_auto : qualité optimisée
   */
  private readonly AVATAR_TRANSFORM = 'w_200,h_200,c_fill,f_auto,q_auto';

  /**
   * Dossier racine des avatars sur Cloudinary.
   * Correspond au dossier créé dans la Media Library.
   */
  private readonly AVATARS_FOLDER = 'aniverse/avatars';

  /**
   * Configuration de Cloudinary au démarrage du module.
   * Lit automatiquement CLOUDINARY_URL depuis .env
   */
  onModuleInit() {
    // Cloudinary lit automatiquement CLOUDINARY_URL depuis process.env
    // Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
    if (!process.env.CLOUDINARY_URL) {
      console.warn('⚠️ CLOUDINARY_URL non définie dans .env');
      return;
    }

    // La config est automatique avec CLOUDINARY_URL, mais on peut vérifier
    const config = cloudinary.config();
    console.log(`✅ Cloudinary configuré pour le cloud: ${config.cloud_name}`);
  }

  /**
   * Récupère tous les avatars du dossier aniverse/avatars/ sur Cloudinary.
   *
   * @param subfolder - Sous-dossier optionnel (ex: "action" pour aniverse/avatars/action/)
   * @returns Liste des avatars avec leurs URLs transformées
   *
   * Comment ça marche :
   * 1. On appelle l'API Cloudinary pour lister les ressources (images)
   * 2. Pour chaque image, on construit l'URL avec les transformations
   * 3. On retourne un tableau d'avatars prêts à l'emploi
   */
  async getAvatars(subfolder?: string): Promise<CloudinaryAvatar[]> {
    try {
      const folder = subfolder
        ? `${this.AVATARS_FOLDER}/${subfolder}`
        : this.AVATARS_FOLDER;

      // Lister toutes les images dans le dossier (et sous-dossiers)
      const result: ResourceApiResponse = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        resource_type: 'image',
        max_results: 500, // Max d'images à récupérer
      });

      // Transformer les résultats en avatars utilisables
      return result.resources.map((resource) => {
        // Extraire le nom du fichier depuis le public_id
        // Ex: "aniverse/avatars/action/goku" → "goku"
        const parts = resource.public_id.split('/');
        const filename = parts[parts.length - 1];

        // Extraire le sous-dossier s'il existe
        // Ex: "aniverse/avatars/action/goku" → "action"
        const folderParts = resource.public_id
          .replace(`${this.AVATARS_FOLDER}/`, '')
          .split('/');
        const subfolderName = folderParts.length > 1 ? folderParts[0] : '';

        // Construire l'URL avec transformations
        const url = cloudinary.url(resource.public_id, {
          transformation: [
            { width: 200, height: 200, crop: 'fill' },
            { fetch_format: 'auto', quality: 'auto' },
          ],
          secure: true, // HTTPS
        });

        return {
          id: resource.public_id,
          name: this.formatName(filename),
          url,
          folder: subfolderName,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Formate le nom du fichier pour l'affichage.
   * Ex: "ken_kaneki" → "Ken Kaneki"
   */
  private formatName(filename: string): string {
    return filename
      .replace(/[-_]/g, ' ') // Remplacer - et _ par des espaces
      .replace(/\b\w/g, (char) => char.toUpperCase()); // Majuscule à chaque mot
  }

  /**
   * Récupère les sous-dossiers disponibles dans aniverse/avatars/
   * Utile pour créer des catégories (action, horror, romance, etc.)
   */
  async getFolders(): Promise<string[]> {
    try {
      const result = await cloudinary.api.sub_folders(this.AVATARS_FOLDER);
      return result.folders.map((f: { name: string; path: string }) => f.name);
    } catch {
      // Si le dossier n'a pas de sous-dossiers, retourner un tableau vide
      return [];
    }
  }

  /**
   * Upload un avatar depuis un fichier (buffer).
   *
   * @param file - Fichier image uploadé via multer
   * @param name - Nom optionnel pour l'avatar (sinon timestamp)
   * @returns Informations sur l'image uploadée
   */
  async uploadAvatar(
    file: Express.Multer.File,
    name?: string,
  ): Promise<{ success: boolean; public_id?: string; url?: string; error?: string }> {
    try {
      // Convertir le buffer en base64 data URI
      const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      // Générer un public_id unique
      const publicId = name
        ? name.toLowerCase().replace(/\s+/g, '_')
        : `avatar_${Date.now()}`;

      const result = await cloudinary.uploader.upload(base64, {
        folder: this.AVATARS_FOLDER,
        public_id: publicId,
        resource_type: 'image',
        overwrite: true, // Remplace si le nom existe déjà
      });

      return {
        success: true,
        public_id: result.public_id,
        url: result.secure_url,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Supprime un avatar par son public_id.
   */
  async deleteAvatar(publicId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await cloudinary.uploader.destroy(publicId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
