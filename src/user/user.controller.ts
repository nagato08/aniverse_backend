import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('user')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Récupérer mon profil' })
  @ApiOkResponse({ type: ProfileResponseDto })
  getProfile(@GetUser() user: { userId: string }) {
    return this.userService.getProfile(user.userId);
  }

  @Patch('profile')
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
