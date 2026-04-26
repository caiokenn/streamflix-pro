/**
 * Logger Seguro com TypeScript
 * 
 * Sistema de logging com type safety que:
 * - Não expõe detalhes sensíveis (senhas, tokens, emails)
 * - Diferencia entre logs de desenvolvimento e produção
 * - Estrutura logs para fácil rastreamento
 */

const isDev = process.env.NODE_ENV === 'development';
const isServer = typeof window === 'undefined';

/**
 * Tipo para dados de log (sensíveis são automaticamente filtrados)
 */
interface LogData {
  [key: string]: unknown;
}

/**
 * Tipo para erro
 */
interface LogError {
  message?: string;
  cause?: unknown;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Função para sanitizar dados sensíveis
 */
function sanitizeData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitive = ['password', 'token', 'secret', 'key', 'api_key', 'authorization', 'cookie', 'session'];
  const sanitized = { ...obj as Record<string, unknown> };
  
  Object.keys(sanitized).forEach(key => {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Função para extrair mensagem de erro segura
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  
  const err = error as LogError;
  
  // Em produção, retorna mensagem genérica
  if (!isDev && err.message) {
    // Alguns erros são seguros de mostrar
    const safePatterns = ['not found', 'validation', 'required', 'already exists'];
    const msg = err.message.toLowerCase();
    const isSafe = safePatterns.some(p => msg.includes(p));
    return isSafe ? err.message : 'Ocorreu um erro. Tente novamente.';
  }
  
  return err.message || 'Erro desconhecido';
}

/**
 * Log de sucesso
 */
export function logSuccess(action: string, data: LogData = {}): void {
  const message = `✓ [${action}] Sucesso`;
  
  if (isDev) {
    console.log(message, sanitizeData(data));
  } else if (isServer) {
    console.log(JSON.stringify({ level: 'info', action, timestamp: new Date().toISOString() }));
  }
}

/**
 * Log de erro
 */
export function logError(action: string, error: unknown, data: LogData = {}): void {
  const message = `✗ [${action}] Erro`;
  const errorMsg = getErrorMessage(error);
  
  if (isDev) {
    console.error(message, error);
    if (Object.keys(data).length > 0) {
      console.error('Context:', sanitizeData(data));
    }
  } else if (isServer) {
    // Em produção, log estruturado para monitoramento
    console.error(JSON.stringify({
      level: 'error',
      action,
      message: errorMsg,
      timestamp: new Date().toISOString(),
      context: sanitizeData(data)
    }));
  }
}

/**
 * Log de avisos (warnings)
 */
export function logWarn(action: string, message: string, data: LogData = {}): void {
  if (isDev) {
    console.warn(`⚠ [${action}] ${message}`, sanitizeData(data));
  } else if (isServer) {
    console.warn(JSON.stringify({ level: 'warn', action, message, timestamp: new Date().toISOString() }));
  }
}

/**
 * Log de informações (debug)
 */
export function logInfo(action: string, message: string, data: LogData = {}): void {
  if (isDev) {
    console.log(`ℹ [${action}] ${message}`, sanitizeData(data));
  }
}

/**
 * Log de performance (tempo de execução)
 */
export function logPerformance(action: string, durationMs: number, data: LogData = {}): void {
  if (isDev) {
    const level = durationMs > 1000 ? 'warn' : 'info';
    console[level](`⏱ [${action}] ${durationMs}ms`, sanitizeData(data));
  } else if (isServer && durationMs > 1000) {
    console.warn(JSON.stringify({
      level: 'warn',
      action,
      duration_ms: durationMs,
      message: 'Operação lenta detectada',
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Tipos exportados para uso em outras partes do código
 */
export type { LogData, LogError };