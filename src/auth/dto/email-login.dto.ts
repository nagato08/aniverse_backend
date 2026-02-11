import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

/** Demande d'envoi d'un code de connexion par email (connexion sans mot de passe). */
export class SendLoginCodeDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email du compte' })
  @IsEmail()
  email: string;
}

/** Vérification du code reçu par email pour obtenir les tokens. */
export class VerifyLoginCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'Code à 6 chiffres reçu par email' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Le code doit contenir exactement 6 chiffres' })
  code: string;
}
