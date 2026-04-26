/**
 * Validação de Entrada com TypeScript
 * 
 * Funções para validar e sanitizar dados de entrada com type safety
 */

// Regex patterns com tipos
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_-]{3,30}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  tmdbId: /^\d+$/,
  url: /^https?:\/\/.+/,
} as const;

/**
 * Tipo para erro de validação customizado
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Tipo para Email válido
 */
export type ValidEmail = string & { __brand: 'ValidEmail' };

/**
 * Tipo para Senha válida
 */
export type ValidPassword = string & { __brand: 'ValidPassword' };

/**
 * Tipo para Nome de usuário válido
 */
export type ValidUsername = string & { __brand: 'ValidUsername' };

/**
 * Tipo para ID TMDB válido
 */
export type ValidTmdbId = number & { __brand: 'ValidTmdbId' };

/**
 * Tipo para tipo de mídia válido
 */
export type MediaType = 'movie' | 'tv' | 'person';

/**
 * Tamanhos de imagem válidos
 */
export type ImageSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';

/**
 * Valida email
 */
export function validateEmail(email: unknown): ValidEmail {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email é obrigatório');
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length > 254) {
    throw new ValidationError('Email muito longo');
  }
  
  if (!patterns.email.test(trimmed)) {
    throw new ValidationError('Email inválido');
  }
  
  return trimmed as ValidEmail;
}

/**
 * Valida senha
 * - Mínimo 8 caracteres
 * - Letras maiúsculas
 * - Letras minúsculas
 * - Números
 * - Caracteres especiais (@$!%*?&)
 */
export function validatePassword(password: unknown): ValidPassword {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Senha é obrigatória');
  }
  
  if (password.length < 8) {
    throw new ValidationError('Senha deve ter no mínimo 8 caracteres');
  }
  
  if (password.length > 128) {
    throw new ValidationError('Senha muito longa');
  }
  
  if (!patterns.password.test(password)) {
    throw new ValidationError(
      'Senha deve conter: maiúsculas, minúsculas, números e caracteres especiais (@$!%*?&)'
    );
  }
  
  return password as ValidPassword;
}

/**
 * Valida nome de usuário
 */
export function validateUsername(username: unknown): ValidUsername {
  if (!username || typeof username !== 'string') {
    throw new ValidationError('Nome de usuário é obrigatório');
  }
  
  const trimmed = username.trim();
  
  if (!patterns.username.test(trimmed)) {
    throw new ValidationError('Nome de usuário: 3-30 caracteres, apenas letras, números, _ e -');
  }
  
  return trimmed as ValidUsername;
}

/**
 * Valida ID do TMDB
 */
export function validateTmdbId(id: unknown): ValidTmdbId {
  if (!id) {
    throw new ValidationError('ID do TMDB é obrigatório');
  }
  
  const parsed = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  
  if (isNaN(parsed) || parsed < 1) {
    throw new ValidationError('ID do TMDB inválido');
  }
  
  return parsed as ValidTmdbId;
}

/**
 * Valida tipo de mídia
 */
export function validateMediaType(type: unknown): MediaType {
  const valid: MediaType[] = ['movie', 'tv', 'person'];
  
  if (!type || typeof type !== 'string') {
    throw new ValidationError('Tipo de mídia é obrigatório');
  }
  
  if (!valid.includes(type as MediaType)) {
    throw new ValidationError(`Tipo de mídia deve ser: ${valid.join(', ')}`);
  }
  
  return type as MediaType;
}

/**
 * Valida string de busca
 */
export function validateSearchQuery(query: unknown): string {
  if (!query || typeof query !== 'string') {
    throw new ValidationError('Busca é obrigatória');
  }
  
  const trimmed = query.trim();
  
  if (trimmed.length < 2) {
    throw new ValidationError('Busca deve ter no mínimo 2 caracteres');
  }
  
  if (trimmed.length > 200) {
    throw new ValidationError('Busca muito longa');
  }
  
  // Remove caracteres perigosos
  return trimmed.replace(/[<>\"'%;()&+]/g, '');
}

/**
 * Valida página de paginação
 */
export function validatePage(page: unknown): number {
  const parsed = typeof page === 'string' ? parseInt(page, 10) : Number(page);
  
  if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
    throw new ValidationError('Página deve estar entre 1 e 1000');
  }
  
  return parsed;
}

/**
 * Valida tamanho de imagem
 */
export function validateImageSize(size: unknown): ImageSize {
  const valid: ImageSize[] = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
  
  if (!size || typeof size !== 'string') {
    throw new ValidationError('Tamanho de imagem é obrigatório');
  }
  
  if (!valid.includes(size as ImageSize)) {
    throw new ValidationError(`Tamanho deve ser: ${valid.join(', ')}`);
  }
  
  return size as ImageSize;
}

/**
 * Valida URL
 */
export function validateUrl(url: unknown): URL {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL é obrigatória');
  }
  
  try {
    return new URL(url);
  } catch {
    throw new ValidationError('URL inválida');
  }
}

/**
 * Valida ID de perfil
 */
export function validateProfileId(id: unknown): string {
  if (!id || typeof id !== 'string') {
    throw new ValidationError('ID de perfil é obrigatório');
  }
  
  if (id.length > 100) {
    throw new ValidationError('ID de perfil inválido');
  }
  
  return id;
}

/**
 * Valida ID do usuário
 */
export function validateUserId(id: unknown): string {
  if (!id || typeof id !== 'string') {
    throw new ValidationError('ID do usuário é obrigatório');
  }
  
  if (id.length > 100) {
    throw new ValidationError('ID do usuário inválido');
  }
  
  return id;
}

/**
 * Valida posição do vídeo
 */
export function validatePosition(position: unknown): number {
  const parsed = typeof position === 'string' ? parseFloat(position) : Number(position);
  
  if (isNaN(parsed) || parsed < 0) {
    throw new ValidationError('Posição inválida');
  }
  
  return parsed;
}

/**
 * Valida duração
 */
export function validateDuration(duration: unknown): number {
  const parsed = typeof duration === 'string' ? parseFloat(duration) : Number(duration);
  
  if (isNaN(parsed) || parsed <= 0 || parsed > 14400) {
    throw new ValidationError('Duração inválida');
  }
  
  return parsed;
}

/**
 * Valida classificação (rating)
 */
export function validateRating(rating: unknown): number {
  const parsed = typeof rating === 'string' ? parseFloat(rating) : Number(rating);
  
  if (isNaN(parsed) || parsed < 1 || parsed > 5 || (parsed * 10) % 5 !== 0) {
    throw new ValidationError('Classificação deve ser entre 1 e 5 em incrementos de 0.5');
  }
  
  return parsed;
}

/**
 * Valida boolean
 */
export function validateBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  throw new ValidationError('Valor booleano inválido');
}

/**
 * Valida número de temporada/episódio
 */
export function validateEpisodeNumber(num: unknown): number {
  const parsed = typeof num === 'string' ? parseInt(num, 10) : Number(num);
  
  if (isNaN(parsed) || parsed < 0 || parsed > 9999) {
    throw new ValidationError('Número de temporada/episódio inválido');
  }
  
  return parsed;
}

/**
 * Valida rating type (like/dislike/stars)
 */
export function validateRatingType(type: unknown): 'like' | 'dislike' | 'stars' {
  const valid = ['like', 'dislike', 'stars'] as const;
  
  if (!type || typeof type !== 'string') {
    throw new ValidationError('Tipo de rating é obrigatório');
  }
  
  if (!valid.includes(type as typeof valid[number])) {
    throw new ValidationError(`Tipo de rating deve ser: ${valid.join(', ')}`);
  }
  
  return type as 'like' | 'dislike' | 'stars';
}

/**
 * Valida status de visualização
 */
export function validateWatchStatus(status: unknown): 'watching' | 'completed' | 'paused' {
  const valid = ['watching', 'completed', 'paused'] as const;
  
  if (!status || typeof status !== 'string') {
    throw new ValidationError('Status é obrigatório');
  }
  
  if (!valid.includes(status as typeof valid[number])) {
    throw new ValidationError(`Status deve ser: ${valid.join(', ')}`);
  }
  
  return status as 'watching' | 'completed' | 'paused';
}

/**
 * Tipo para resultado de validação (sucesso)
 */
export type ValidationSuccess<T> = {
  success: true;
  data: T;
  error?: never;
};

/**
 * Tipo para resultado de validação (erro)
 */
export type ValidationFailure<T> = {
  success: false;
  data?: never;
  error: ValidationError;
};

/**
 * Tipo para resultado de validação
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure<T>;

/**
 * Valida e retorna resultado (sem throw)
 */
export function validateEmailSafe(email: unknown): ValidationResult<ValidEmail> {
  try {
    return { success: true, data: validateEmail(email) };
  } catch (error) {
    return { success: false, error: error as ValidationError };
  }
}

/**
 * Valida senha de forma segura (sem throw)
 */
export function validatePasswordSafe(password: unknown): ValidationResult<ValidPassword> {
  try {
    return { success: true, data: validatePassword(password) };
  } catch (error) {
    return { success: false, error: error as ValidationError };
  }
}

/**
 * Valida nome de usuário de forma segura (sem throw)
 */
export function validateUsernameSafe(username: unknown): ValidationResult<ValidUsername> {
  try {
    return { success: true, data: validateUsername(username) };
  } catch (error) {
    return { success: false, error: error as ValidationError };
  }
}