// lib/supabase.ts
import { createClient as createBrowserClient } from './supabase/client';
import { 
  validateEmail, 
  validatePassword, 
  validateUsername,
  type MediaType 
} from './validation';

// ==================== CLIENTE ====================
// Cliente compartilhado (browser-safe)
export const supabase = createBrowserClient();

// ==================== AUTH ====================

export async function signIn(email: unknown, password: unknown) {
  const client = createBrowserClient();
  const e = validateEmail(email);
  const p = validatePassword(password);
  return await client.auth.signInWithPassword({ email: e, password: p });
}

export async function signUp(email: unknown, password: unknown, username: unknown) {
  const client = createBrowserClient();
  const e = validateEmail(email);
  const p = validatePassword(password);
  const u = validateUsername(username);
  
  return await client.auth.signUp({
    email: e,
    password: p,
    options: { data: { username: u } }
  });
}

// ==================== PROGRESSO ====================

export async function saveProgress(profileId: string, tmdbId: number, mediaType: MediaType, data: any) {
  const client = createBrowserClient();
  return await client
    .from('watch_progress')
    .upsert({
      profile_id: profileId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      ...data,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'profile_id, tmdb_id, media_type, season_number, episode_number'
    });
}

export async function getProgress(profileId: string, tmdbId: number, mediaType: MediaType, season?: number | null, episode?: number | null) {
  const client = createBrowserClient();
  let query = client
    .from('watch_progress')
    .select('*')
    .eq('profile_id', profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType);

  if (season !== undefined && season !== null) query = query.eq('season_number', season);
  else query = query.is('season_number', null);

  if (episode !== undefined && episode !== null) query = query.eq('episode_number', episode);
  else query = query.is('episode_number', null);

  return await query.maybeSingle();
}

// ==================== RATINGS ====================

export async function saveRating(profileId: string, tmdbId: number, mediaType: MediaType, ratingType: string, value?: number) {
  const client = createBrowserClient();
  return await client
    .from('ratings')
    .upsert({
      profile_id: profileId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      rating_type: ratingType,
      stars_value: value || null
    });
}

export async function getRating(profileId: string, tmdbId: number, mediaType: MediaType) {
  const client = createBrowserClient();
  return await client
    .from('ratings')
    .select('*')
    .eq('profile_id', profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle();
}

// ==================== WATCHLIST ====================

export async function addToWatchlist(profileId: string, tmdbId: number, mediaType: MediaType) {
  const client = createBrowserClient();
  return await client
    .from('watchlist')
    .upsert({ profile_id: profileId, tmdb_id: tmdbId, media_type: mediaType });
}

export async function removeFromWatchlist(profileId: string, tmdbId: number, mediaType: MediaType) {
  const client = createBrowserClient();
  return await client
    .from('watchlist')
    .delete()
    .eq('profile_id', profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType);
}

export async function isInWatchlist(profileId: string, tmdbId: number, mediaType: MediaType) {
  const client = createBrowserClient();
  const { data } = await client
    .from('watchlist')
    .select('id')
    .eq('profile_id', profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle();
  return !!data;
}

export async function getWatchlist(profileId: string) {
  const client = createBrowserClient();
  return await client
    .from('watchlist')
    .select('*')
    .eq('profile_id', profileId)
    .order('added_at', { ascending: false });
}

export async function getContinueWatching(profileId: string) {
  const client = createBrowserClient();
  return await client
    .from('watch_progress')
    .select('*')
    .eq('profile_id', profileId)
    .eq('status', 'watching')
    .order('updated_at', { ascending: false });
}