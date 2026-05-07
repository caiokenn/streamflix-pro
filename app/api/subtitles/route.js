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
    
    // Detectar encoding a partir do Content-Type ou dos metadados do Stremio
    // As legendas do strem.io geralmente vêm como subencoding-stremio-utf8 na URL
    // ou têm Content-Type informando o charset
    const contentType = response.headers.get('content-type') || '';
    let decoded = '';
    
    // Se a URL contém 'utf8' ou o content-type informa utf-8, usa UTF-8
    const isUtf8 = url.toLowerCase().includes('utf8') || 
                   url.toLowerCase().includes('utf-8') || 
                   contentType.toLowerCase().includes('utf-8');
    
    if (isUtf8) {
      decoded = new TextDecoder('utf-8').decode(buffer);
    } else {
      // Tentar decodificar como Windows-1252 (comum em legendas antigas de PT-BR)
      // Fallback: UTF-8 se CP1252 não funcionar
      try {
        decoded = new TextDecoder('windows-1252').decode(buffer);
      } catch {
        decoded = new TextDecoder('utf-8').decode(buffer);
      }
    }

    // Conversão SRT → VTT
    let vttContent = decoded;
    if (!decoded.trim().startsWith('WEBVTT')) {
      // Remove BOM se houver
      const clean = decoded.replace(/^\uFEFF/, '');
      vttContent = 'WEBVTT\n\n' + clean
        // Converte timestamps SRT (00:00:00,000) para VTT (00:00:00.000)
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
        // Remove tags de formatação SRT que VTT não suporta
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
