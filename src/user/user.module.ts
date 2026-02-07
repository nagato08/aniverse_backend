import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryService } from './cloudinary.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService, CloudinaryService],
})
export class UserModule {}
