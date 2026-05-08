import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return new NextResponse('Missing subtitle URL', { status: 400 });
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      return new NextResponse('Failed to fetch subtitle', { status: response.status });
    }

    // Ler como ArrayBuffer para preservar o encoding original
    const buffer = await response.arrayBuffer();
    
    let decoded = '';
    try {
      // 1. Tentar decodificar como UTF-8 estrito primeiro
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      try {
        // 2. Se falhar (caracteres inválidos para UTF-8), decodificar como Windows-1252 (padrão PT-BR antigo)
        decoded = new TextDecoder('windows-1252').decode(buffer);
      } catch {
        // Fallback de segurança final
        decoded = new TextDecoder('utf-8').decode(buffer);
      }
    }

    // Conversão SRT → VTT com máxima robustez
    let vttContent = decoded;
    if (!decoded.trim().startsWith('WEBVTT')) {
      // Remove BOM se houver
      const clean = decoded.replace(/^\uFEFF/, '');
      
      // Converte linha por linha para tratar variações de formatação nos timestamps
      const lines = clean.split('\n');
      const processedLines = lines.map(line => {
        if (line.includes('-->')) {
          // Converte vírgulas de milissegundos para pontos (SRT -> VTT)
          let processed = line.replace(/,/g, '.');
          
          // Corrige timestamps SRT que podem vir com horas de 1 dígito (ex: 0:12:34.567 -> 00:12:34.567)
          processed = processed.replace(/(?:^|\s)(\d):(\d{2}):(\d{2})\.(\d{3})/g, ' 0$1:$2:$3.$4');
          return processed;
        }
        return line;
      });
      
      vttContent = 'WEBVTT\n\n' + processedLines.join('\n')
        // Remove tags de formatação SRT que VTT não suporta nativamente
        .replace(/<font[^>]*>/gi, '').replace(/<\/font>/gi, '')
        .replace(/<b>/gi, '<b>').replace(/<\/b>/gi, '</b>')
        .replace(/<i>/gi, '<i>').replace(/<\/i>/gi, '</i>')
        .replace(/<u>/gi, '<u>').replace(/<\/u>/gi, '</u>');
    }

    return new NextResponse(vttContent, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=86400',
      }
    });
  } catch (error) {
    console.error('[SUBTITLE PROXY ERROR]:', error.message);
    return new NextResponse('Error downloading subtitle', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
