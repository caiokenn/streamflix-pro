# 🔒 Guia de Segurança - StreamFlix

## Sumário das Implementações de Segurança

Este documento descreve todas as medidas de segurança implementadas no projeto StreamFlix.

---

## 1. 🛡️ Proteção de Secrets (API Keys)

### Problema
API keys (TMDB e Supabase) estavam expostas ao cliente no navegador, permitindo:
- Roubo de credenciais
- Rate limiting bypass
- Acesso não autorizado a APIs

### Solução Implementada
✅ **API Routes como Proxy**
- Criada nova API route: `/api/tmdb/...`
- Todas as requisições TMDB passam pelo servidor
- API keys armazenadas apenas em `process.env` (servidor)
- Cliente nunca tem acesso às credenciais

**Arquivo**: `app/api/tmdb/route.js`

```javascript
// Antes (INSEGURO):
const token = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN; // ❌ Exposto ao cliente

// Depois (SEGURO):
const TMDB_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN; // ✅ Apenas no servidor
// Cliente faz: fetch('/api/tmdb/...') → Servidor faz requisição autenticada
```

---

## 2. ✔️ Validação Robusta de Entrada

### Problema
Falta de validação permitia:
- Directory traversal attacks
- SQL injection (via Supabase)
- XSS attacks
- Injeção de parâmetros

### Solução Implementada
✅ **Módulo de Validação Completo**

**Arquivo**: `lib/validation.js`

Funções disponíveis:
- `validateEmail()` - Email válido e tamanho máximo
- `validatePassword()` - Força de senha (8+ chars, maiúsculas, minúsculas, números, especiais)
- `validateUsername()` - 3-30 chars, apenas alfanuméricos + _ -
- `validateTmdbId()` - Número positivo
- `validateMediaType()` - Apenas 'movie', 'tv', 'person'
- `validateSearchQuery()` - Remove caracteres perigosos, 2-200 chars
- `validatePage()` - 1-1000
- `validateUrl()` - URL válida
- Mais 10+ funções específicas

**Exemplo**:
```javascript
// Antes (INSEGURO):
const tmdbId = req.query.id; // Sem validação

// Depois (SEGURO):
const tmdbId = validateTmdbId(req.query.id); // Throw ValidationError se inválido
```

---

## 3. 🔴 Try-Catch em Funções Críticas

### Problema
Funções de autenticação e banco de dados sem tratamento de erro:
- Crashes não documentados
- Informações sensíveis em error messages
- Estado inconsistente

### Solução Implementada
✅ **Supabase Functions com Try-Catch**

**Arquivo**: `lib/supabase.js` (totalmente refatorado)

Todas as funções agora têm:
- `try-catch` block
- Validação de entrada antes de execução
- Logging seguro (sem expor dados)
- Retorno consistente: `{ data, error }`

```javascript
// Antes (INSEGURO):
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({...});
  return { data, error }; // Se erro, data pode ser undefined
}

// Depois (SEGURO):
export async function signUp(email, password, username) {
  try {
    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password);
    
    const { data, error } = await supabase.auth.signUp({...});
    
    if (error) {
      logError('signup', error, { email: validatedEmail });
      return { data: null, error: { message: 'Erro ao criar conta' } };
    }
    
    return { data, error: null };
  } catch (error) {
    logError('signup', error);
    return { data: null, error: { message: 'Erro ao criar conta' } };
  }
}
```

---

## 4. 📝 Logging Seguro

### Problema
- Console.log expunha dados sensíveis (senhas, tokens)
- Logs em produção não estruturados
- Impossível rastrear problemas

### Solução Implementada
✅ **Logger Seguro com Sanitização**

**Arquivo**: `lib/logger.js`

Características:
- Redação automática de dados sensíveis (password, token, secret, key, etc)
- Diferencia entre dev e produção
- Estrutura para monitoramento
- Logs de performance

```javascript
// Antes (INSEGURO):
console.log('User:', { email, password, token }); // ❌ Expõe tudo

// Depois (SEGURO):
logSuccess('login', { email }); // ✅ Password/token não inclusos
// Output: ✓ [login] Sucesso { email: 'user@example.com' }

logError('signup', error, { email });
// Output: ✗ [signup] Erro 'Usuário já registrado'
```

---

## 5. 🔐 Middleware de Segurança para APIs

### Problema
- Sem rate limiting
- Sem validação de método HTTP
- Sem headers de segurança
- Sem timeout

### Solução Implementada
✅ **API Security Middleware**

**Arquivo**: `lib/api-security.js`

Recursos:
- **Rate Limiting**: 100 requisições/minuto por IP
- **Validação de Método HTTP**: Apenas POST/GET permitidos
- **Headers de Segurança**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - Mais 3+ headers
- **Timeout**: 30 segundos por requisição
- **Whitelist de Endpoints**: Apenas rotas autorizadas

```javascript
// Uso:
export const GET = withSecurity(handler, {
  methods: ['GET'],
  requireAuth: false,
  timeout: 30000,
});
```

---

## 6. 🔗 Validação de Endpoints TMDB

### Problema
- Endpoints TMDB sem restriction (directory traversal possível)
- Todos os parâmetros aceitos

### Solução Implementada
✅ **Whitelist de Endpoints + Validação de Parâmetros**

**Arquivo**: `app/api/tmdb/route.js`

Endpoints permitidos:
- `/trending`
- `/movie/*` (popular, top_rated, now_playing, upcoming)
- `/tv/*` (popular, top_rated, airing_today)
- `/search/*` (multi, movie, tv)
- `/genre/*`
- `/discover/*`

Parâmetros permitidos:
- `language`, `page`, `query`, `include_adult`
- `region`, `year`, `sort_by`, `with_genres`
- `append_to_response`, `external_source`

Validações:
- `page` deve estar entre 1-1000
- `query` remove caracteres perigosos
- `with_genres` apenas números separados por vírgula

---

## 7. 📦 localStorage Seguro

### Problema
- localStorage lido sem validação
- Possibilidade de XSS para injetar dados falsos
- Sem tratamento de erro ao ler

### Solução Implementada
✅ **Validação ao Ler localStorage**

**Arquivo**: `contexts/AuthContext.js`

```javascript
function getActiveProfileId() {
  try {
    if (typeof window === 'undefined') return null;
    
    const profileId = localStorage.getItem('activeProfileId');
    
    // Validar antes de usar
    if (profileId) {
      validateProfileId(profileId); // ✅ Valida formato
      return profileId;
    }
    
    return null;
  } catch (error) {
    logWarn('localStorage', 'Erro ao recuperar');
    localStorage.removeItem('activeProfileId'); // ✅ Remove se inválido
    return null;
  }
}
```

---

## 8. 🌐 Headers de Segurança HTTP

### Problema
- Sem proteção contra MIME type sniffing
- Sem proteção contra clickjacking
- Sem HSTS
- Sem Content Security Policy

### Solução Implementada
✅ **Headers Configurados no Next.js**

**Arquivo**: `next.config.mjs`

Headers implementados:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: [restrictivo]
```

---

## 9. 🛠️ Melhorias no AuthContext

### Implementações
✅ `selectProfile()` - Validação de entrada e try-catch
✅ `loadProfiles()` - Tratamento de erro e validação de array
✅ `logout()` - Try-catch + limpeza de state
✅ `useAuth()` - Throw error se fora do AuthProvider
✅ `error` state - Para comunicar problemas ao usuário

---

## 📋 Checklist de Segurança

- ✅ API keys protegidas (não expostas ao cliente)
- ✅ Validação de entrada em todas as APIs
- ✅ Try-catch em funções críticas
- ✅ Logging seguro (sem dados sensíveis)
- ✅ Rate limiting implementado
- ✅ Headers de segurança HTTP
- ✅ localStorage validado
- ✅ Whitelist de endpoints
- ✅ Sanitização de entrada
- ✅ Error handling consistente

---

## 🚀 Como Usar as Novas Funções

### 1. Validação de Entrada
```javascript
import { validateEmail, validatePassword, ValidationError } from '@/lib/validation';

try {
  const email = validateEmail(userInput);
  const password = validatePassword(userInput);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Entrada inválida:', error.message);
  }
}
```

### 2. Logging Seguro
```javascript
import { logSuccess, logError, logWarn } from '@/lib/logger';

logSuccess('user-login', { email: 'user@example.com' });
logError('database-error', error, { userId });
logWarn('rate-limit', 'Limite próximo', { remaining: 5 });
```

### 3. Chamadas ao Supabase
```javascript
// Todas as funções retornam { data, error }
const { data, error } = await signUp(email, password, username);

if (error) {
  console.log('Erro:', error.message); // Mensagem segura
} else {
  console.log('Sucesso!', data);
}
```

### 4. Chamar TMDB via Proxy
```javascript
// Antes (INSEGURO):
const response = await fetch('https://api.themoviedb.org/3/...', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Depois (SEGURO):
const response = await fetch('/api/tmdb?path=/trending/all/week');
```

---

## ⚠️ Próximas Etapas de Segurança

1. **CSRF Protection** - Implementar tokens CSRF
2. **Rate Limiting Redis** - Mover do in-memory para Redis
3. **JWT Validation** - Validar tokens de auth
4. **Database Encryption** - Criptografar dados sensíveis
5. **Audit Logging** - Log de todas as operações críticas
6. **OWASP Testing** - Teste de penetração regular

---

## 📞 Suporte

Dúvidas sobre segurança? Contate a equipe de desenvolvimento.

**Última atualização**: 22/04/2026
**Versão**: 1.0
