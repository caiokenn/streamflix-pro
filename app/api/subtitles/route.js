import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return new NextResponse('Missing subtitle URL', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch subtitle', { status: response.status });
    }

    const content = await response.text();

    // Conversão básica de SRT para VTT
    let vttContent = content;
    if (!content.trim().startsWith('WEBVTT')) {
      vttContent = "WEBVTT\n\n" + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }

    return new NextResponse(vttContent, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    console.error('[SUBTITLE DOWNLOAD ERROR]:', error.message);
    return new NextResponse('Error downloading subtitle', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
