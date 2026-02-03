import { Genre, Mood } from '@prisma/client';

/**
 * Mapping Prisma Genre → AniList genre string (AniList utilise "Action", "Sci-Fi", etc.).
 */
export const GENRE_TO_ANILIST: Record<Genre, string> = {
  [Genre.ACTION]: 'Action',
  [Genre.ADVENTURE]: 'Adventure',
  [Genre.COMEDY]: 'Comedy',
  [Genre.DRAMA]: 'Drama',
  [Genre.FANTASY]: 'Fantasy',
  [Genre.HORROR]: 'Horror',
  [Genre.MYSTERY]: 'Mystery',
  [Genre.ROMANCE]: 'Romance',
  [Genre.SCI_FI]: 'Sci-Fi',
  [Genre.SLICE_OF_LIFE]: 'Slice of Life',
};

/**
 * Mapping Mood → genres AniList pour "Moods" (sélection d'animés par ambiance).
 * On utilise des genres existants sur AniList.
 */
export const MOOD_TO_GENRES: Record<Mood, string[]> = {
  [Mood.CHILL]: ['Slice of Life', 'Comedy', 'Drama'],
  [Mood.DARK]: ['Horror', 'Mystery', 'Drama'],
  [Mood.HYPE]: ['Action', 'Adventure', 'Sci-Fi', 'Sports'],
  [Mood.EMOTIONAL]: ['Drama', 'Romance', 'Slice of Life'],
};
