import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Route PUBLIQUE (pas de JwtAuthGuard) pour vérifier si un username est disponible.
   * Utilisée lors de l'inscription pour valider le pseudo en temps réel.
   */
  @Get('check-username')
  @ApiOperation({
    summary: 'Vérifier si un username est disponible',
    description:
      "Route publique pour valider en temps réel si un pseudo est déjà pris. Utile dans le formulaire d'inscription.",
  })
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'Le pseudo à vérifier',
    example: 'Nagato',
  })
  @ApiOkResponse({
    description: 'Retourne { available: true } si le pseudo est libre',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean', example: true },
      },
    },
  })
  checkUsername(@Query('username') username: string) {
    return this.userService.checkUsernameAvailability(username);
  }

  /**
   * Route PUBLIQUE pour récupérer la liste des avatars disponibles.
   * Lit DYNAMIQUEMENT le dossier aniverse/avatars/ sur Cloudinary.
   *
   * Tu uploades une image sur Cloudinary → elle apparaît automatiquement ici.
   */
  @Get('avatars')
  @ApiOperation({
    summary: 'Récupérer les avatars disponibles (dynamique depuis Cloudinary)',
    description:
      "Route publique pour l'étape 4 de l'inscription. " +
      'Lit dynamiquement le dossier aniverse/avatars/ sur Cloudinary. ' +
      'Tu peux filtrer par sous-dossier (ex: action, horror).',
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    description:
      'Sous-dossier pour filtrer (ex: action, horror). Sans ce param, retourne tous les avatars.',
    example: 'action',
  })
  @ApiOkResponse({
    description: 'Liste des avatars disponibles',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'aniverse/avatars/goku' },
          name: { type: 'string', example: 'Goku' },
          url: {
            type: 'string',
            example:
              'https://res.cloudinary.com/xxx/image/upload/w_200,h_200,c_fill/aniverse/avatars/goku.png',
          },
          folder: { type: 'string', example: 'action' },
        },
      },
    },
  })
  async getAvatars(@Query('folder') folder?: string) {
    return await this.userService.getAvatars(folder);
  }

  /**
   * Route PUBLIQUE pour récupérer les catégories (sous-dossiers) d'avatars.
   * Utile pour afficher des onglets/filtres dans le frontend.
   */
  /**
   * Upload un avatar dans Cloudinary.
   *
   * Envoie un fichier image (multipart/form-data) avec :
   * - file: le fichier image (jpg, png, webp)
   * - name: (optionnel) nom de l'avatar
   */
  @Post('avatars/upload')
  @ApiOperation({ summary: 'Upload un avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file' },
        name: { type: 'string', description: 'Nom de l\'avatar (optionnel)' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.userService.uploadAvatar(file, name);
  }

  /**
   * Supprime un avatar par son public_id.
   */
  @Delete('avatars/:publicId')
  @ApiOperation({ summary: 'Supprime un avatar' })
  async deleteAvatar(@Param('publicId') publicId: string) {
    // Le publicId contient des / donc on doit le décoder
    const decodedId = decodeURIComponent(publicId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.userService.deleteAvatar(decodedId);
  }

  @Get('avatars/folders')
  @ApiOperation({
    summary: "Récupérer les catégories d'avatars disponibles",
    description:
      'Retourne la liste des sous-dossiers dans aniverse/avatars/ sur Cloudinary. ' +
      'Ex: ["action", "horror", "romance"]',
  })
  @ApiOkResponse({
    description: 'Liste des sous-dossiers',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['action', 'horror', 'romance'],
    },
  })
  async getAvatarFolders() {
    return await this.userService.getAvatarFolders();
  }

  /**
   * Route PUBLIQUE pour récupérer la liste des genres disponibles.
   * Utilisée à l'étape 3 de l'inscription pour afficher les chips de genres.
   */
  @Get('genres')
  @ApiOperation({
    summary: 'Récupérer les genres disponibles',
    description:
      "Route publique pour l'étape 3 de l'inscription. " +
      'Retourne la liste des genres avec leurs labels en français.',
  })
  @ApiOkResponse({
    description: 'Liste des genres',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', example: 'ACTION' },
          label: { type: 'string', example: 'Action' },
        },
      },
    },
  })
  getGenres() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return this.userService.getGenres();
  }

  /**
   * Route PUBLIQUE pour récupérer la liste des moods disponibles.
   * Utilisée à l'étape 3 de l'inscription pour afficher les cartes de moods.
   */
  @Get('moods')
  @ApiOperation({
    summary: 'Récupérer les moods disponibles',
    description:
      "Route publique pour l'étape 3 de l'inscription. " +
      'Retourne la liste des moods avec leurs labels et descriptions.',
  })
  @ApiOkResponse({
    description: 'Liste des moods',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', example: 'CHILL' },
          label: { type: 'string', example: 'Chill' },
          description: {
            type: 'string',
            example: '🌙 Détente et ambiance calme',
          },
        },
      },
    },
  })
  getMoods() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return this.userService.getMoods();
  }

  // ============ ROUTES PROTÉGÉES (JWT) ============

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer mon profil' })
  @ApiOkResponse({ type: ProfileResponseDto })
  getProfile(@GetUser() user: { userId: string }) {
    return this.userService.getProfile(user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mettre à jour mon profil',
    description:
      'Mise à jour partielle (PATCH). Seuls les champs envoyés sont modifiés.',
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  updateProfile(
    @GetUser() user: { userId: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.userId, dto);
  }
}
