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

    // Os arquivos já vêm convertidos para UTF-8 pelo CDN do Stremio (subencoding-stremio-utf8)
    // Usa conversão simples e direta SRT → VTT — exatamente como funcionava antes
    const content = await response.text();
    let vttContent = content;

    if (!content.trim().startsWith('WEBVTT')) {
      // Remove BOM se houver
      const clean = content.replace(/^\uFEFF/, '');
      // Converte timestamps: vírgula → ponto  (SRT → VTT)
      vttContent = 'WEBVTT\n\n' + clean.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
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
