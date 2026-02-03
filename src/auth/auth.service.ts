import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { MailerService } from 'src/mailer.service';
import { OAuth2Client } from 'google-auth-library';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  RegisterWithGoogleDto,
  LoginWithGoogleDto,
} from './dto/google-auth.dto';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '90d'; // 1–3 mois

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

type JwtTokenType = 'access' | 'refresh';
type JwtPayload = {
  sub: string;
  email: string;
  type: JwtTokenType;
  iat: number;
  exp: number;
};

function isJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sub === 'string' &&
    typeof v.email === 'string' &&
    (v.type === 'access' || v.type === 'refresh')
  );
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailer: MailerService,
  ) {
    // Initialise le client Google OAuth2 pour vérifier les idTokens
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new Error(
        "GOOGLE_CLIENT_ID manquant dans les variables d'environnement",
      );
    }
    this.googleClient = new OAuth2Client(googleClientId);
  }

  /**
   * Vérifie un idToken Google et retourne les infos de l'utilisateur.
   *
   * Retourne: { googleId, email, firstName, lastName, avatarUrl }
   * Lance une exception si le token est invalide.
   *
   * Le token doit être obtenu côté mobile via Google Sign-In SDK.
   * Voir: https://developers.google.com/identity/sign-in/web/sign-in
   */
  private async verifyGoogleToken(idToken: string): Promise<{
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  }> {
    if (!idToken || !idToken.trim()) {
      throw new BadRequestException('idToken Google requis');
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new Error(
        "GOOGLE_CLIENT_ID manquant dans les variables d'environnement",
      );
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Token Google invalide');
      }

      // Vérifie que l'email est présent (obligatoire pour notre app)
      if (!payload.email) {
        throw new BadRequestException(
          'Le compte Google doit avoir un email associé',
        );
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        avatarUrl: payload.picture,
      };
    } catch (error) {
      // Si c'est déjà une exception HTTP, on la relance
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      // Sinon, c'est une erreur de vérification Google
      throw new UnauthorizedException(
        'Token Google invalide ou expiré. Vérifiez que le token provient bien de Google Sign-In.',
      );
    }
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  }) {
    // Access token (court) utilisé sur chaque requête
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, type: 'access' },
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    );

    // Refresh token (long) -> sert uniquement à obtenir un nouvel access token
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, type: 'refresh' },
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
    );

    // Cas A: on stocke un hash du refresh token en DB (pour pouvoir le révoquer/rotater)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: sha256(refreshToken) },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Register (email + password):
   * - crée l'user (email + passwordHash)
   * - enregistre préférences (favoriteGenres, preferredMood)
   * - crée les favoris "anime" (favoriteAnimeIds) dans la table Favorite
   * - retourne tokens + user public
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Email déjà utilisé');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          username: dto.username,
          firstName: dto.firstName,
          lastName: dto.lastName,
          favoriteGenres: dto.favoriteGenres ?? [],
          preferredMood: dto.preferredMood,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      });

      if (dto.favoriteAnimeIds?.length) {
        await tx.favorite.createMany({
          data: dto.favoriteAnimeIds.map((animeId) => ({
            userId: user.id,
            animeId,
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });

    // Mail de bienvenue (optionnel). S'il manque firstName, on met un fallback.
    await this.mailer.sendEmailFromRegister({
      recipient: created.email,
      firstName: created.firstName ?? undefined,
    });

    return this.buildAuthResponse(created);
  }

  /**
   * Register avec Google ("Continuer avec Google"):
   * - vérifie l'idToken Google
   * - extrait email, nom, prénom, avatar depuis Google
   * - crée l'user avec googleId (PAS de passwordHash)
   * - enregistre préférences anime (favoriteGenres, preferredMood, favoriteAnimeIds)
   * - retourne tokens + user public
   */
  async registerWithGoogle(dto: RegisterWithGoogleDto) {
    const googleData = await this.verifyGoogleToken(dto.idToken);

    // Vérifie si l'email existe déjà
    const existing = await this.prisma.user.findUnique({
      where: { email: googleData.email },
      select: { id: true, googleId: true },
    });

    if (existing) {
      // Si l'user existe mais n'a pas de googleId, on le lie
      if (!existing.googleId) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { googleId: googleData.googleId },
        });
        // On retourne un login plutôt qu'un register
        const user = await this.prisma.user.findUniqueOrThrow({
          where: { id: existing.id },
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        });
        return this.buildAuthResponse(user);
      }
      throw new BadRequestException('Compte Google déjà utilisé');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: googleData.email,
          googleId: googleData.googleId,
          // Pas de passwordHash pour les comptes Google
          username: dto.username,
          firstName: googleData.firstName ?? dto.username,
          lastName: googleData.lastName,
          avatarUrl: googleData.avatarUrl,
          favoriteGenres: dto.favoriteGenres ?? [],
          preferredMood: dto.preferredMood,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      });

      if (dto.favoriteAnimeIds?.length) {
        await tx.favorite.createMany({
          data: dto.favoriteAnimeIds.map((animeId) => ({
            userId: user.id,
            animeId,
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });

    return this.buildAuthResponse(created);
  }

  /**
   * Login (email + password):
   * - vérifie email + password
   * - retourne tokens + user public
   *
   * Note: Si l'user n'a pas de passwordHash (compte Google uniquement),
   * on refuse la connexion par email/password.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        googleId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    if (!user) throw new UnauthorizedException('Identifiants invalides');

    // Si l'user n'a pas de passwordHash, c'est un compte Google uniquement
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Ce compte utilise Google. Connectez-vous avec Google.',
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Identifiants invalides');

    return this.buildAuthResponse(user);
  }

  /**
   * Login avec Google:
   * - vérifie l'idToken Google
   * - trouve l'user via googleId
   * - retourne tokens + user public
   *
   * Si l'utilisateur n'existe pas, il doit utiliser /auth/google/register
   */
  async loginWithGoogle(dto: LoginWithGoogleDto) {
    const googleData = await this.verifyGoogleToken(dto.idToken);

    const user = await this.prisma.user.findUnique({
      where: { googleId: googleData.googleId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Aucun compte trouvé avec ce compte Google. Utilisez /auth/google/register pour créer un compte.',
      );
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Refresh (Cas A):
   * - le client envoie son refreshToken
   * - on vérifie la signature + le type
   * - on compare le hash DB pour s'assurer qu'il est encore valide
   * - on émet une nouvelle paire access/refresh (rotation)
   */
  async refresh(refreshToken: string) {
    try {
      const decoded: unknown = await this.jwt.verifyAsync(refreshToken, {
        secret:
          process.env.JWT_SECRET ||
          'ZO44bPd3LB6SdTgaLo7I9OIxQSKfp1_u3l_ri6hJmXw',
      });

      if (!isJwtPayload(decoded) || decoded.type !== 'refresh') {
        throw new UnauthorizedException('Refresh token invalide');
      }

      const userId = decoded.sub;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          refreshTokenHash: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      });
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Refresh token invalide');
      }

      if (sha256(refreshToken) !== user.refreshTokenHash) {
        throw new UnauthorizedException('Refresh token invalide');
      }

      return this.buildAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  /**
   * Logout:
   * - invalide le refresh token courant en supprimant son hash en DB
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Déconnecté' };
  }

  /**
   * Forgot password:
   * - renvoie TOUJOURS un message générique (ne pas révéler si l'email existe)
   * - si l'utilisateur existe ET a un passwordHash (pas Google uniquement):
   *   - génère un token aléatoire
   *   - stocke son hash + expiration
   *   - envoie email via Resend
   *
   * Note: Les comptes Google uniquement ne peuvent pas réinitialiser de mot de passe
   * (ils n'ont pas de passwordHash).
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, passwordHash: true },
    });

    // On envoie un email SEULEMENT si l'user existe ET a un passwordHash
    if (user && user.passwordHash) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: sha256(token),
          passwordResetTokenExpiresAt: expires,
        },
      });

      await this.mailer.sendRequestPasswordEmail({
        recipient: user.email,
        firstName: user.firstName ?? undefined,
        token,
      });
    }

    return {
      message:
        'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
    };
  }

  /**
   * Reset password:
   * - vérifie token + expiration
   * - met à jour passwordHash
   * - supprime le token de reset (usage unique)
   * - (optionnel) invalide le refresh token existant
   */
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = sha256(token);
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash },
      select: {
        id: true,
        passwordResetTokenExpiresAt: true,
      },
    });

    const expiresAt = user?.passwordResetTokenExpiresAt ?? null;
    if (
      !user ||
      !(expiresAt instanceof Date) ||
      expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        // on invalide aussi le refresh token (oblige à se reconnecter)
        refreshTokenHash: null,
      },
    });

    return { message: 'Mot de passe mis à jour' };
  }
}
