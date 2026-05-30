import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const SIBNET_ORIGIN = 'https://video.sibnet.ru';
const SIBNET_HOST_PATTERN = /(^|\.)sibnet\.ru$/i;

const PLAYER_SRC_PATTERNS: RegExp[] = [
  /player\.src\(\[\s*\{[^}]*?src:\s*["']([^"']+)["']/i,
  /"src"\s*:\s*"([^"]+\.(?:mp4|m3u8)[^"]*)"/i,
  /src:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i,
];

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
};

export interface ResolvedVideo {
  videoUrl: string;
  referer: string;
}

@Injectable()
export class SibnetResolver {
  private readonly logger = new Logger(SibnetResolver.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  isSibnetPage(url: string): boolean {
    try {
      return SIBNET_HOST_PATTERN.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  async resolve(pageUrl: string): Promise<ResolvedVideo> {
    const cacheKey = `sibnet:resolve:${pageUrl}`;
    const cached = await this.cache.get<ResolvedVideo>(cacheKey);
    if (cached) return cached;

    const res = await fetch(pageUrl, {
      headers: { ...BROWSER_HEADERS, Referer: SIBNET_ORIGIN + '/' },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new NotFoundException(
        `Sibnet page HTTP ${res.status} pour ${pageUrl}`,
      );
    }

    const html = await res.text();
    const rawSrc = this.extractSrc(html);
    if (!rawSrc) {
      this.logger.warn(`Sibnet src introuvable: ${pageUrl}`);
      throw new NotFoundException('Sibnet: source vidéo introuvable');
    }

    const videoUrl = new URL(rawSrc, SIBNET_ORIGIN).toString();
    const resolved: ResolvedVideo = { videoUrl, referer: pageUrl };

    // TTL court: URLs sibnet souvent signées/temporaires
    await this.cache.set(cacheKey, resolved, 5 * 60 * 1000);
    return resolved;
  }

  async invalidate(pageUrl: string): Promise<void> {
    await this.cache.del(`sibnet:resolve:${pageUrl}`);
  }

  private extractSrc(html: string): string | null {
    for (const re of PLAYER_SRC_PATTERNS) {
      const m = html.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  }
}
