/* eslint-disable no-console */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function buildPrisma(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

interface SibnetEntry {
  titre: string;
  url: string;
  thumbnail?: string;
  duree?: string;
  duree_iso?: string;
  date_upload?: string;
  auteur?: string;
  auteur_url?: string;
  album?: string;
  album_url?: string;
  vues?: string;
  famille_ok?: boolean;
}

interface AlbumGroup {
  album: string;
  albumUrl: string;
  entries: SibnetEntry[];
}

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v ?? true;
    }
  }
  return args;
}

function loadJson(path: string): SibnetEntry[] {
  const raw = readFileSync(resolve(path), 'utf-8');
  return JSON.parse(raw) as SibnetEntry[];
}

function extractEpisodeNumber(titre: string): number | null {
  // Tente d'abord les patterns explicites: "S4 - 07", "Серия 07", "- 12 -", "Ep 05"
  const explicit =
    titre.match(/(?:серия|ep|episode|épisode|-)\s*0*(\d{1,4})/i) ||
    titre.match(/\bs\d+\s*[-–]\s*0*(\d{1,4})/i);
  if (explicit?.[1]) return parseInt(explicit[1], 10);

  // Sinon: dernier nombre du titre (formats "043", "516", "0515")
  const nums = titre.match(/\d{1,4}/g);
  if (nums && nums.length > 0) {
    return parseInt(nums[nums.length - 1], 10);
  }
  return null;
}

function groupByAlbum(entries: SibnetEntry[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();
  for (const e of entries) {
    const key = e.album_url || e.album || 'UNKNOWN';
    if (!map.has(key)) {
      map.set(key, {
        album: e.album || 'Sans album',
        albumUrl: e.album_url || '',
        entries: [],
      });
    }
    map.get(key)!.entries.push(e);
  }
  return [...map.values()].sort((a, b) => b.entries.length - a.entries.length);
}

function cmdListAlbums(jsonPath: string, limit: number) {
  const data = loadJson(jsonPath);
  const groups = groupByAlbum(data);
  console.log(
    `\n${groups.length} albums uniques sur ${data.length} épisodes scrapés.\n`,
  );
  console.log('Top albums (par nb épisodes):');
  console.log('─'.repeat(100));
  for (const g of groups.slice(0, limit)) {
    console.log(
      `${String(g.entries.length).padStart(3)} ép.  ${g.album.padEnd(60).slice(0, 60)}  ${g.albumUrl}`,
    );
  }
  console.log('\nPour importer un album:');
  console.log(
    '  npx ts-node scripts/import-sibnet.ts --import --anime-id=<ANILIST_ID> --album-url=<URL>',
  );
}

async function cmdImport(
  prisma: PrismaClient,
  jsonPath: string,
  animeId: number,
  albumUrl: string,
  dryRun: boolean,
) {
  const data = loadJson(jsonPath);
  const matching = data.filter((e) => e.album_url === albumUrl);

  if (matching.length === 0) {
    console.error(`Aucun épisode trouvé pour album-url=${albumUrl}`);
    process.exit(1);
  }

  console.log(
    `\n${matching.length} épisodes trouvés pour animeId=${animeId} (${matching[0].album})`,
  );

  const rows = matching
    .map((e) => {
      const num = extractEpisodeNumber(e.titre);
      if (num === null) {
        console.warn(`  [SKIP] Numéro introuvable: "${e.titre}"`);
        return null;
      }
      return {
        animeId,
        episodeNumber: num,
        title: e.titre,
        streamUrl: e.url,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Déduplication par episodeNumber (garder le premier)
  const seen = new Set<number>();
  const unique = rows.filter((r) => {
    if (seen.has(r.episodeNumber)) {
      console.warn(
        `  [DUP] Episode ${r.episodeNumber} déjà mappé, ignoré: ${r.title}`,
      );
      return false;
    }
    seen.add(r.episodeNumber);
    return true;
  });

  unique.sort((a, b) => a.episodeNumber - b.episodeNumber);

  console.log('\nAperçu:');
  for (const r of unique.slice(0, 5)) {
    console.log(`  ep ${r.episodeNumber} → ${r.streamUrl}`);
  }
  if (unique.length > 5) console.log(`  ... +${unique.length - 5} autres`);

  if (dryRun) {
    console.log('\n[DRY-RUN] Aucune insertion. Retire --dry-run pour exécuter.');
    return;
  }

  const result = await prisma.episode.createMany({
    data: unique,
    skipDuplicates: true,
  });

  console.log(`\n${result.count} épisodes insérés en DB.`);
}

async function main() {
  const args = parseArgs();
  const jsonPath = (args.json as string) || 'sibnet_anime.json';

  if (args['list-albums']) {
    const limit = args.limit ? parseInt(args.limit as string, 10) : 50;
    cmdListAlbums(jsonPath, limit);
    return;
  }

  if (args.import) {
    const animeId = args['anime-id']
      ? parseInt(args['anime-id'] as string, 10)
      : NaN;
    const albumUrl = args['album-url'] as string;
    const dryRun = !!args['dry-run'];

    if (!Number.isFinite(animeId) || !albumUrl) {
      console.error(
        'Usage: --import --anime-id=<ID> --album-url=<URL> [--dry-run] [--json=path]',
      );
      process.exit(1);
    }

    const prisma = buildPrisma();
    try {
      await cmdImport(prisma, jsonPath, animeId, albumUrl, dryRun);
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  console.log(`
Import sibnet → DB Aniverse

Commandes:
  --list-albums [--limit=N]              Inventaire des albums uniques
  --import --anime-id=<ID> --album-url=<URL> [--dry-run]
                                         Importe les épisodes d'un album sous animeId AniList

Options globales:
  --json=<path>                          Chemin JSON (défaut: sibnet_anime.json)
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
