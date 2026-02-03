import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;
}

export class PublicUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false, nullable: true })
  username?: string | null;

  @ApiProperty({ required: false, nullable: true })
  firstName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl?: string | null;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: PublicUserDto })
  user: PublicUserDto;
}
