import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import {
  SendLoginCodeDto,
  VerifyLoginCodeDto,
} from './dto/email-login.dto';
import {
  RegisterWithGoogleDto,
  LoginWithGoogleDto,
  GoogleProfilePrefillDto,
} from './dto/google-auth.dto';
import { AuthResponseDto, PublicUserDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary:
      'Créer un compte (email + password) + préférences + favoris initiaux',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Connexion email + mot de passe (legacy)',
    description:
      'Optionnel. Connexion recommandée : Google (/auth/google/login) ou email sans mot de passe (/auth/send-login-code + /auth/verify-login-code).',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('send-login-code')
  @ApiOperation({
    summary: 'Connexion par email : envoyer le code',
    description:
      "L'utilisateur entre son email. Envoie un code à 6 chiffres par email (valide 10 min). Réponse toujours générique.",
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example:
            'Si un compte existe avec cet email, un code de connexion a été envoyé. Valide 10 minutes.',
        },
      },
    },
  })
  sendLoginCode(@Body() dto: SendLoginCodeDto) {
    return this.auth.sendLoginCode(dto);
  }

  @Post('verify-login-code')
  @ApiOperation({
    summary: 'Connexion par email : vérifier le code',
    description: "L'utilisateur entre le code reçu par email. Retourne les tokens.",
  })
  @ApiOkResponse({ type: AuthResponseDto })
  verifyLoginCode(@Body() dto: VerifyLoginCodeDto) {
    return this.auth.verifyLoginCode(dto);
  }

  @Post('google/profile')
  @ApiOperation({
    summary: 'Profil Google pour pré-remplir l’inscription (sans créer de compte)',
    description:
      "À l'étape 1 « Continuer avec Google », envoie l'idToken. Retourne email, prénom, nom, avatar pour pré-remplir le formulaire. Aucun compte n'est créé. Garde l'idToken pour l'appel final à POST /auth/google/register après les étapes username/phone/bio, genres/moods, avatar.",
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@gmail.com' },
        firstName: { type: 'string', example: 'Jean' },
        lastName: { type: 'string', example: 'Dupont' },
        avatarUrl: { type: 'string', example: 'https://lh3.googleusercontent.com/...' },
      },
    },
  })
  getGoogleProfileForPrefill(@Body() dto: GoogleProfilePrefillDto) {
    return this.auth.getGoogleProfileForPrefill(dto.idToken);
  }

  @Post('google/login')
  @ApiOperation({
    summary: 'Connexion avec Google (écran « Se connecter »)',
    description:
      "Envoie l'idToken. Si compte existant → tokens. Si aucun compte → 401 avec code GOOGLE_NO_ACCOUNT : rediriger vers l'inscription en gardant l'idToken.",
  })
  @ApiOkResponse({ type: AuthResponseDto })
  loginWithGoogle(@Body() dto: LoginWithGoogleDto) {
    return this.auth.loginWithGoogle(dto);
  }

  @Post('google/register')
  @ApiOperation({
    summary: 'Inscription avec Google (fin du parcours multi-étapes)',
    description:
      "Appelé après les étapes : 1) pré-remplir avec POST /auth/google/profile, 2) username/phone/bio, 3) genres/moods, 4) choix avatar. Envoie l'idToken + tous les champs collectés. Crée le compte et retourne les tokens.",
  })
  @ApiOkResponse({ type: AuthResponseDto })
  registerWithGoogle(@Body() dto: RegisterWithGoogleDto) {
    return this.auth.registerWithGoogle(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renouveler l’accessToken via refreshToken (90j)' })
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Demander un lien de réinitialisation (email)' })
  @ApiOkResponse({
    schema: { example: { message: 'Si un compte existe...' } },
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe via token' })
  @ApiOkResponse({
    schema: { example: { message: 'Mot de passe mis à jour' } },
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le profil de l’utilisateur connecté' })
  @ApiOkResponse({ type: PublicUserDto })
  me(@GetUser() user: { userId: string; email: string }) {
    // Ici on renvoie la forme "publique" côté JWT.
    // Si tu veux plus de champs (genres, mood, etc.), on peut faire un SELECT Prisma.
    return { id: user.userId, email: user.email };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion (invalide le refresh token en DB)' })
  @ApiOkResponse({ schema: { example: { message: 'Déconnecté' } } })
  logout(@GetUser() user: { userId: string; email: string }) {
    return this.auth.logout(user.userId);
  }
}
