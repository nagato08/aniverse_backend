/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { SibnetResolver } from '../streaming/sibnet.resolver';

@Injectable()
export class EpisodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sibnet: SibnetResolver,
  ) {}

  async create(dto: CreateEpisodeDto) {
    try {
      return await this.prisma.episode.create({ data: dto });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          `Episode ${dto.episodeNumber} already exists for anime ${dto.animeId}`,
        );
      }
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async createMany(episodes: CreateEpisodeDto[]) {
    return this.prisma.episode.createMany({
      data: episodes,
      skipDuplicates: true,
    });
  }

  async findByAnime(animeId: number) {
    return this.prisma.episode.findMany({
      where: { animeId },
      orderBy: { episodeNumber: 'asc' },
    });
  }

  async findOne(animeId: number, episodeNumber: number) {
    const episode = await this.prisma.episode.findUnique({
      where: { animeId_episodeNumber: { animeId, episodeNumber } },
    });
    if (!episode) {
      throw new NotFoundException(
        `Episode ${episodeNumber} not found for anime ${animeId}`,
      );
    }
    return episode;
  }

  async getStreamUrl(
    animeId: number,
    episodeNumber: number,
    host: string,
    protocol: string,
  ) {
    const episode = await this.findOne(animeId, episodeNumber);

    let directUrl = episode.streamUrl;
    if (this.sibnet.isSibnetPage(episode.streamUrl)) {
      const resolved = await this.sibnet.resolve(episode.streamUrl);
      directUrl = resolved.videoUrl;
    }

    const proxiedUrl = `${protocol}://${host}/api/proxy/stream?url=${encodeURIComponent(directUrl)}`;
    return { streamUrl: proxiedUrl, episode };
  }

  async update(id: string, dto: UpdateEpisodeDto) {
    try {
      return await this.prisma.episode.update({
        where: { id },
        data: dto,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Episode ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.episode.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Episode ${id} not found`);
      }
      throw error;
    }
  }

  async removeAllByAnime(animeId: number) {
    return this.prisma.episode.deleteMany({ where: { animeId } });
  }
}
