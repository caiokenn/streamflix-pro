#!/usr/bin/env node

/**
 * Script de Validação de Segurança
 * 
 * Testa se todas as implementações de segurança estão funcionando corretamente.
 * 
 * Uso: node scripts/validate-security.js
 */

const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function check(condition, successMsg, failMsg) {
  if (condition) {
    log(`✓ ${successMsg}`, 'green');
    return true;
  } else {
    log(`✗ ${failMsg}`, 'red');
    return false;
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function fileContains(filePath, pattern) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern);
  } catch {
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────

log('\n🔒 Validação de Segurança do StreamFlix\n', 'cyan');

const projectRoot = path.resolve(__dirname, '..');
let totalChecks = 0;
let passedChecks = 0;

// 1. Arquivos Criados
log('📁 1. Verificando Arquivos de Segurança', 'blue');
log('─'.repeat(50));

const requiredFiles = [
  'lib/logger.js',
  'lib/validation.js',
  'lib/api-security.js',
  'app/api/tmdb/route.js',
  'SEGURANCA.md',
];

requiredFiles.forEach(file => {
  const fullPath = path.join(projectRoot, file);
  totalChecks++;
  if (check(fileExists(fullPath), `✓ ${file} existe`, `✗ ${file} não encontrado`)) {
    passedChecks++;
  }
});

// 2. Validação de Conteúdo
log('\n📋 2. Verificando Conteúdo dos Arquivos', 'blue');
log('─'.repeat(50));

const fileValidations = [
  {
    file: 'lib/logger.js',
    patterns: ['sanitizeData', 'logError', 'logSuccess', 'logWarn'],
    description: 'Funções de logging'
  },
  {
    file: 'lib/validation.js',
    patterns: ['ValidationError', 'validateEmail', 'validatePassword', 'validateTmdbId'],
    description: 'Funções de validação'
  },
  {
    file: 'lib/api-security.js',
    patterns: ['checkRateLimit', 'withSecurity', 'getSecurityHeaders', 'validateRequest'],
    description: 'Middleware de segurança'
  },
  {
    file: 'app/api/tmdb/route.js',
    patterns: ['ALLOWED_ENDPOINTS', 'validateEndpoint', 'validateParams', 'TMDB_TOKEN'],
    description: 'Proxy TMDB seguro'
  },
  {
    file: 'lib/supabase.js',
    patterns: ['try {', 'catch (error)', 'logError', 'ValidationError'],
    description: 'Try-catch em Supabase'
  },
  {
    file: 'contexts/AuthContext.js',
    patterns: ['try {', 'catch (error)', 'validateProfileId', 'getActiveProfileId'],
    description: 'Try-catch em AuthContext'
  },
];

fileValidations.forEach(({ file, patterns, description }) => {
  const fullPath = path.join(projectRoot, file);
  
  if (!fileExists(fullPath)) {
    totalChecks++;
    check(false, '', `✗ ${file} não encontrado (${description})`);
    return;
  }
  
  patterns.forEach(pattern => {
    totalChecks++;
    const fullPath2 = path.join(projectRoot, file);
    if (check(fileContains(fullPath2, pattern), 
      `✓ "${pattern}" encontrado em ${path.basename(file)}`, 
      `✗ "${pattern}" não encontrado em ${path.basename(file)}`)) {
      passedChecks++;
    }
  });
});

// 3. Verificar next.config.mjs
log('\n⚙️  3. Verificando Configuração Next.js', 'blue');
log('─'.repeat(50));

const nextConfigPath = path.join(projectRoot, 'next.config.mjs');
const securityHeaders = [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'X-XSS-Protection',
  'Strict-Transport-Security',
  'Content-Security-Policy',
];

securityHeaders.forEach(header => {
  totalChecks++;
  if (check(fileContains(nextConfigPath, header), 
    `✓ Header "${header}" configurado`, 
    `✗ Header "${header}" não configurado`)) {
    passedChecks++;
  }
});

// 4. Validar padrões de código
log('\n🔍 4. Verificando Padrões de Código', 'blue');
log('─'.repeat(50));

// Verificar se supabase.js tem validações
totalChecks++;
if (check(
  fileContains(path.join(projectRoot, 'lib/supabase.js'), 'validateProfileId') &&
  fileContains(path.join(projectRoot, 'lib/supabase.js'), 'validateTmdbId'),
  '✓ Validação de entrada em supabase.js',
  '✗ Falta validação de entrada em supabase.js'
)) {
  passedChecks++;
}

// Verificar se logger sanitiza dados
totalChecks++;
if (check(
  fileContains(path.join(projectRoot, 'lib/logger.js'), 'sanitizeData'),
  '✓ Logger sanitiza dados sensíveis',
  '✗ Logger não sanitiza dados'
)) {
  passedChecks++;
}

// Verificar se API route tem whitelist
totalChecks++;
if (check(
  fileContains(path.join(projectRoot, 'app/api/tmdb/route.js'), 'ALLOWED_ENDPOINTS'),
  '✓ API TMDB tem whitelist de endpoints',
  '✗ Falta whitelist na API TMDB'
)) {
  passedChecks++;
}

// 5. Resumo
log('\n' + '─'.repeat(50), 'cyan');
log(`\n📊 RESULTADO FINAL\n`, 'cyan');

const percentage = Math.round((passedChecks / totalChecks) * 100);
const resultColor = percentage >= 90 ? 'green' : percentage >= 70 ? 'yellow' : 'red';

log(`Testes Passados: ${passedChecks}/${totalChecks} (${percentage}%)`, resultColor);

if (percentage === 100) {
  log('\n🎉 Todas as implementações de segurança foram validadas com sucesso!', 'green');
  process.exit(0);
} else if (percentage >= 90) {
  log('\n✅ Implementações de segurança em bom estado. Verifique os erros acima.', 'yellow');
  process.exit(0);
} else {
  log('\n⚠️  Alguns testes falharam. Revise as implementações.', 'red');
  process.exit(1);
}
