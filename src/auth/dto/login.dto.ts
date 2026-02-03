import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * Login = email (seul identifiant) + mot de passe.
 * On ne se connecte pas avec le username, uniquement avec l'email.
 */
export class LoginDto {
  @ApiProperty({
    example: 'user@email.com',
    description: 'Email (seul identifiant de connexion, pas le username)',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MyStrongPassword123!' })
  @IsString()
  password: string;
}
