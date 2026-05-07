import { NextRequest } from 'next/server';

const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://147.15.92.17:4000';

export async function GET(request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const { searchParams } = new URL(request.url);
  
  const url = new URL(`${STREAMING_URL}/transcode/${hash}`);
  // Repassa os query params: ?audioTrack=N&t=SEGUNDOS&fileIndex=N
  searchParams.forEach((value, key) => url.searchParams.set(key, value));

  try {
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      return new Response('Transcode unavailable', { status: response.status });
    }
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') headers.set(key, value);
    });
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response('Transcode connection failed', { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
