import { NextRequest } from 'next/server';

const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://147.15.92.17:4000';

export async function GET(request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const { searchParams } = new URL(request.url);
  const fileIndex = searchParams.get('fileIndex');
  
  const url = new URL(`${STREAMING_URL}/probe/${hash}`);
  if (fileIndex) url.searchParams.set('fileIndex', fileIndex);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'probe failed' }), { status: 502 });
  }
}

export const dynamic = 'force-dynamic';
