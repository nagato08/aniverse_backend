/**
 * Types pour les réponses de l'API GraphQL AniList.
 * Doc: https://docs.anilist.co/guide/graphql/
 */

export interface AnilistMediaTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface AnilistCoverImage {
  large?: string | null;
  medium?: string | null;
  extraLarge?: string | null;
}

export interface AnilistMediaTrailer {
  id?: string | null;
  site?: string | null;
  thumbnail?: string | null;
}

export interface AnilistStaffName {
  full?: string | null;
}

export interface AnilistStaffNode {
  name?: AnilistStaffName | null;
}

export interface AnilistStaffEdge {
  role?: string | null;
  node?: AnilistStaffNode | null;
}

export interface AnilistCharacterName {
  full?: string | null;
}

export interface AnilistCharacterImage {
  medium?: string | null;
}

export interface AnilistCharacterNode {
  name?: AnilistCharacterName | null;
  image?: AnilistCharacterImage | null;
}

export interface AnilistCharacterEdge {
  role?: string | null;
  node?: AnilistCharacterNode | null;
}

export interface AnilistNextAiringEpisode {
  airingAt?: number | null;
  episode?: number | null;
  timeUntilAiring?: number | null;
}

export interface AnilistAiringScheduleNode {
  id?: number | null;
  airingAt?: number | null;
  episode?: number | null;
  mediaId?: number | null;
  media?: AnilistMedia | null;
}

export interface AnilistMedia {
  id: number;
  title: AnilistMediaTitle;
  coverImage?: AnilistCoverImage | null;
  description?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  popularity?: number | null;
  episodes?: number | null;
  status?: string | null;
  format?: string | null;
  seasonYear?: number | null;
  season?: string | null;
  trailer?: AnilistMediaTrailer | null;
  staff?: { edges?: AnilistStaffEdge[] | null } | null;
  characters?: { edges?: AnilistCharacterEdge[] | null } | null;
  nextAiringEpisode?: AnilistNextAiringEpisode | null;
}

export interface AnilistPageInfo {
  hasNextPage?: boolean | null;
  total?: number | null;
  currentPage?: number | null;
  lastPage?: number | null;
  perPage?: number | null;
}

export interface AnilistPageMedia {
  pageInfo?: AnilistPageInfo | null;
  media: AnilistMedia[];
}

export interface AnilistGraphQLResponse<T> {
  data?: T | null;
  errors?: Array<{ message: string }> | null;
}
