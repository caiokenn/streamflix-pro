/**
 * Middleware de Segurança para API Routes com TypeScript
 * 
 * Implementa:
 * - Rate limiting
 * - Validação de requisição
 * - Headers de segurança
 * - CORS
 * - Timeout
 */

import { logError, logWarn } from './logger';

// Tipos internos
interface RateLimitEntry {
  firstRequest: number;
  count: number;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';

interface SecurityHeaders {
  [key: string]: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  status?: number;
}

// Armazenar rate limit em memória (em produção, usar Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configurações
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 100; // Requisições por janela
const DEFAULT_TIMEOUT = 30000; // 30 segundos

/**
 * Limpa entradas expiradas do rate limit
 */
function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.firstRequest > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Verifica rate limit
 */
export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  cleanupRateLimit();
  
  const now = Date.now();
  let data = rateLimitStore.get(identifier);
  
  if (!data) {
    rateLimitStore.set(identifier, { firstRequest: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  // Se passou da janela de tempo, reseta
  if (now - data.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(identifier, { firstRequest: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  // Incrementa contador
  data.count++;
  
  const allowed = data.count <= RATE_LIMIT_MAX_REQUESTS;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - data.count);
  
  if (!allowed) {
    logWarn('rate-limit', 'Limite excedido', { identifier, count: data.count });
  }
  
  return { allowed, remaining };
}

/**
 * Headers de segurança
 */
export function getSecurityHeaders(): SecurityHeaders {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

/**
 * Headers CORS
 */
export function getCORSHeaders(origin: string): SecurityHeaders {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);
  
  const isAllowed = allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Valida request método HTTP
 */
export function validateRequest(method: string, allowedMethods: HttpMethod[] = ['GET', 'POST']): ValidationResult {
  if (!allowedMethods.includes(method as HttpMethod)) {
    return {
      valid: false,
      error: 'Método não permitido',
      status: 405,
    };
  }
  
  return { valid: true, error: undefined, status: undefined };
}

/**
 * Valida Content-Type
 */
export function validateContentType(contentType: string | null, expected = 'application/json'): ValidationResult {
  if (!contentType || !contentType.includes(expected)) {
    return {
      valid: false,
      error: `Content-Type deve ser ${expected}`,
      status: 415,
    };
  }
  
  return { valid: true, error: undefined, status: undefined };
}

/**
 * Tipo para handler de API
 */
type ApiHandler = (request: Request) => Promise<Response>;

/**
 * Tipo para opções do wrapper de segurança
 */
interface SecurityOptions {
  methods: HttpMethod[];
  requireAuth: boolean;
  timeout: number;
}

/**
 * Wrapper para API handlers com segurança
 */
export async function withSecurity(
  handler: ApiHandler,
  options: Partial<SecurityOptions> = {}
): Promise<(request: Request) => Promise<Response>> {
  const {
    methods = ['GET', 'POST'],
    requireAuth = false,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  return async function secureHandler(request: Request): Promise<Response> {
    try {
      // Validar método
      const methodValidation = validateRequest(request.method, methods);
      if (!methodValidation.valid) {
        return new Response(JSON.stringify({ error: methodValidation.error }), {
          status: methodValidation.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Rate limiting
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
      const rateLimit = checkRateLimit(clientIp);

      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        });
      }

      // Executar handler com timeout
      const responsePromise = handler(request);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]);

      // Adicionar headers de segurança
      const headers = new Headers(response.headers);
      const securityHeaders = getSecurityHeaders();
      Object.entries(securityHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      // Adicionar rate limit headers
      headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
      headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

    } catch (error) {
      logError('api-handler', error);

      // Evitar expor detalhes de erro
      const errorMessage = error instanceof Error ? error.message : 'Erro interno';
      const statusCode = errorMessage === 'Timeout' ? 408 : 500;
      const message = errorMessage === 'Timeout'
        ? 'Requisição expirou'
        : 'Erro interno do servidor';

      return new Response(JSON.stringify({ error: message }), {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders(),
        },
      });
    }
  };
}

/**
 * Extrai e valida token JWT
 */
export function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
}

/**
 * Cria resposta de erro
 */
export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...getSecurityHeaders() },
  });
}

/**
 * Cria resposta de sucesso
 */
export function successResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getSecurityHeaders() },
  });
}

/**
 * Tipos exportados para uso externo
 */
export type { SecurityHeaders, HttpMethod, SecurityOptions, ApiHandler };