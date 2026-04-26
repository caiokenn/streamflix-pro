// lib/tmdb.js — TMDB API Service Layer

const BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const READ_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN;
const IMAGE_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p';

const headers = {
  Authorization: `Bearer ${READ_TOKEN}`,
  'Content-Type': 'application/json',
};

const defaultParams = 'language=pt-BR';

async function fetchTMDB(endpoint, params = '') {
  const sep = params ? '&' : '?';
  const url = `${BASE_URL}${endpoint}?${defaultParams}${params ? sep + params : ''}`;
  const res = await fetch(url, { headers, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB Error: ${res.status} - ${endpoint}`);
  return res.json();
}

// ─── Image Helpers ───────────────────────────────────────────────
export function getPosterUrl(path, size = 'w500') {
  if (!path) return '/placeholder-poster.jpg';
  return `${IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path, size = 'original') {
  if (!path) return '/placeholder-backdrop.jpg';
  return `${IMAGE_BASE}/${size}${path}`;
}

export function getProfileUrl(path, size = 'w185') {
  if (!path) return '/placeholder-profile.jpg';
  return `${IMAGE_BASE}/${size}${path}`;
}

// ─── Home / Trending ─────────────────────────────────────────────
export async function getTrending(mediaType = 'all', timeWindow = 'week') {
  return fetchTMDB(`/trending/${mediaType}/${timeWindow}`);
}

export async function getPopularMovies(page = 1) {
  return fetchTMDB('/movie/popular', `page=${page}`);
}

export async function getPopularTV(page = 1) {
  return fetchTMDB('/tv/popular', `page=${page}`);
}

export async function getTopRatedMovies(page = 1) {
  return fetchTMDB('/movie/top_rated', `page=${page}`);
}

export async function getTopRatedTV(page = 1) {
  return fetchTMDB('/tv/top_rated', `page=${page}`);
}

export async function getNowPlayingMovies(page = 1) {
  return fetchTMDB('/movie/now_playing', `page=${page}`);
}

export async function getUpcomingMovies(page = 1) {
  return fetchTMDB('/movie/upcoming', `page=${page}`);
}

export async function getAiringTodayTV(page = 1) {
  return fetchTMDB('/tv/airing_today', `page=${page}`);
}

// ─── Details ─────────────────────────────────────────────────────
export async function getMovieDetails(id) {
  return fetchTMDB(`/movie/${id}`, 'append_to_response=credits,videos,similar,recommendations,images');
}

export async function getTVDetails(id) {
  return fetchTMDB(`/tv/${id}`, 'append_to_response=credits,videos,similar,recommendations,seasons,images');
}

export async function getTVSeasonDetails(tvId, seasonNumber) {
  return fetchTMDB(`/tv/${tvId}/season/${seasonNumber}`);
}

export async function getTVEpisodeDetails(tvId, seasonNumber, episodeNumber) {
  return fetchTMDB(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);
}

export async function getPersonDetails(id) {
  return fetchTMDB(`/person/${id}`, 'append_to_response=combined_credits,images');
}

// ─── Search ───────────────────────────────────────────────────────
export async function searchMulti(query, page = 1) {
  return fetchTMDB('/search/multi', `query=${encodeURIComponent(query)}&page=${page}&include_adult=false`);
}

export async function searchMovies(query, page = 1) {
  return fetchTMDB('/search/movie', `query=${encodeURIComponent(query)}&page=${page}`);
}

export async function searchTV(query, page = 1) {
  return fetchTMDB('/search/tv', `query=${encodeURIComponent(query)}&page=${page}`);
}

// ─── Genres ───────────────────────────────────────────────────────
export async function getMovieGenres() {
  return fetchTMDB('/genre/movie/list');
}

export async function getTVGenres() {
  return fetchTMDB('/genre/tv/list');
}

export async function discoverMovies(params = '') {
  return fetchTMDB('/discover/movie', `sort_by=popularity.desc&${params}`);
}

export async function discoverTV(params = '') {
  return fetchTMDB('/discover/tv', `sort_by=popularity.desc&${params}`);
}

// ─── Video Sources ────────────────────────────────────────────────
export function getVideoEmbedUrl(mediaType, id, season = null, episode = null) {
  if (mediaType === 'movie') {
    return `https://www.vidking.net/embed/movie/${id}?color=00e5ff`;
  }
  return `https://www.vidking.net/embed/tv/${id}/${season || 1}/${episode || 1}?color=00e5ff`;
}

// Fontes de vídeo integradas (Melhores servidores 2025)
export function getAlternativeVideoSources(mediaType, id, season = null, episode = null) {
  const sources = [];
  const s = season || 1;
  const e = episode || 1;
  
  if (mediaType === 'movie') {
    sources.push(
      { name: 'Vkng', url: `https://www.vidking.net/embed/movie/${id}?color=00e5ff` },
      { name: 'Vpm', url: `https://vidsrc.pm/embed/movie/${id}` },
      { name: 'Vicu', url: `https://vidsrc.icu/embed/movie/${id}` },
      { name: 'Wrez', url: `https://embed.warezcdn.net/movie/${id}` },
      { name: 'Auto', url: `https://player.autoembed.to/movie/${id}` },
      { name: 'Super', url: `https://multiembed.mov/?video_id=${id}&tmdb=1` },
    );
  } else {
    sources.push(
      { name: 'Vkng', url: `https://www.vidking.net/embed/tv/${id}/${s}/${e}?color=00e5ff` },
      { name: 'Vpm', url: `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` },
      { name: 'Vicu', url: `https://vidsrc.icu/embed/tv/${id}/${s}/${e}` },
      { name: 'Wrez', url: `https://embed.warezcdn.net/tv/${id}/${s}/${e}` },
      { name: 'Auto', url: `https://player.autoembed.to/tv/${id}/${s}/${e}` },
      { name: 'Super', url: `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
    );
  }
  
  return sources;
}

// ─── Helpers ──────────────────────────────────────────────────────
export function formatRuntime(minutes) {
  if (!minutes) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function getReleaseYear(item) {
  const date = item.release_date || item.first_air_date;
  if (!date) return '';
  return new Date(date).getFullYear();
}

export function getTitle(item) {
  return item.title || item.name || 'Sem título';
}

export function getMediaType(item) {
  return item.media_type || (item.title ? 'movie' : 'tv');
}
