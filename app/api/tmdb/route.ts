/**
 * API Route: /api/tmdb/route.ts
 * 
 * Proxy seguro para requisições TMDB com TypeScript
 * Benefícios:
 * - API keys protegidas (não expostas ao cliente)
 * - Validação de entrada robusta
 * - Rate limiting
 * - Tratamento de erros seguro
 * - Logging
 * - Type safety
 */

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, checkRateLimit, getSecurityHeaders } from '@/lib/api-security';
import { logError, logSuccess, logPerformance, logWarn } from '@/lib/logger';
import { 
  validateTmdbId, 
  validateSearchQuery, 
  validatePage,
  ValidationError,
} from '@/lib/validation';

// ==================== CONSTANTS ====================

const TMDB_BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN;

if (!TMDB_TOKEN) {
  console.error('ERRO: NEXT_PUBLIC_TMDB_READ_TOKEN não configurado!');
}

// Whitelist de endpoints permitidos
const ALLOWED_ENDPOINTS: readonly string[] = [
  '/trending',
  '/movie/popular',
  '/movie/top_rated',
  '/movie/now_playing',
  '/movie/upcoming',
  '/tv/popular',
  '/tv/top_rated',
  '/tv/airing_today',
  '/search/multi',
  '/search/movie',
  '/search/tv',
  '/genre/movie/list',
  '/genre/tv/list',
  '/discover/movie',
  '/discover/tv',
];

// ==================== VALIDATORS ====================

/**
 * Valida endpoint
 */
function validateEndpoint(path: string): string {
  const matchesWhitelist = ALLOWED_ENDPOINTS.some(allowed => path.startsWith(allowed));
  
  if (!matchesWhitelist) {
    throw new ValidationError('Endpoint não permitido');
  }
  
  if (path.includes('..') || path.includes('//')) {
    throw new ValidationError('Caminho inválido');
  }
  
  return path;
}

/**
 * Valida parâmetros
 */
function validateParams(params: URLSearchParams): URLSearchParams {
  const validated = new URLSearchParams();
  
  const allowedParams = [
    'language',
    'page',
    'query',
    'include_adult',
    'region',
    'year',
    'sort_by',
    'with_genres',
    'append_to_response',
    'external_source',
  ];
  
  for (const [key, value] of params.entries()) {
    if (!allowedParams.includes(key)) {
      logWarn('tmdb-api', 'Parâmetro não permitido', { param: key });
      continue;
    }
    
    if (key === 'page') {
      try {
        const page = validatePage(value);
        validated.set(key, page.toString());
      } catch {
        throw new ValidationError('Parâmetro page inválido');
      }
    } else if (key === 'query') {
      try {
        const query = validateSearchQuery(value);
        validated.set(key, query);
      } catch (e) {
        if (e instanceof ValidationError) throw e;
        throw e;
      }
    } else if (key === 'with_genres') {
      if (!value.match(/^(\d+)(,\d+)*$/)) {
        throw new ValidationError('Parâmetro with_genres inválido');
      }
      validated.set(key, value);
    } else {
      validated.set(key, value);
    }
  }
  
  if (!validated.has('language')) {
    validated.set('language', 'pt-BR');
  }
  
  return validated;
}

// ==================== FETCH ====================

/**
 * Buscar dados do TMDB
 */
async function fetchTMDB(endpoint: string, params: URLSearchParams): Promise<unknown> {
  const url = new URL(endpoint, TMDB_BASE_URL);
  url.search = params.toString();
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TMDB_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    const duration = Date.now() - startTime;
    logPerformance('tmdb-fetch', duration, { endpoint });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new ValidationError('Conteúdo não encontrado');
      }
      
      throw new Error(`TMDB API Error: ${response.status}`);
    }
    
    const data = await response.json();
    logSuccess('tmdb-fetch', { endpoint });
    
    return data;
    
  } catch (error) {
    logError('tmdb-fetch', error, { endpoint });
    throw error;
  }
}

// ==================== HANDLER ====================

/**
 * Handler principal
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const rateLimit = checkRateLimit(clientIp);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido' },
        { status: 429, headers: { 'Retry-After': '60', ...getSecurityHeaders() } }
      );
    }

    const url = request.nextUrl;
    const pathParts = url.searchParams.get('path')?.split('/').filter(Boolean) ?? [];
    
    if (!pathParts.length) {
      return NextResponse.json({ error: 'Caminho necessário' }, { status: 400 });
    }
    
    const endpoint = '/' + pathParts.join('/');
    validateEndpoint(endpoint);
    
    const params = validateParams(url.searchParams);
    
    if (endpoint.startsWith('/movie/') || endpoint.startsWith('/tv/') || endpoint.startsWith('/person/')) {
      const id = pathParts[pathParts.length - 1];
      validateTmdbId(id);
    }
    
    const data = await fetchTMDB(endpoint, params);
    
    return NextResponse.json(data, { headers: getSecurityHeaders() });
    
  } catch (error) {
    logError('tmdb-api-route', error);
    
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('404')) {
      return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
  }
}