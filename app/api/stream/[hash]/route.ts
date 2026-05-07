import { NextRequest } from 'next/server';

const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://147.15.92.17:4000';

export async function GET(request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const resolvedParams = await params;
  const hash = resolvedParams?.hash;
  
  if (!hash || hash.length < 20) {
    return new Response(JSON.stringify({ error: 'Invalid hash' }), { status: 400 });
  }

  const range = request.headers.get('range');
  
  try {
    const fetchOptions: RequestInit = {
      headers: {
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      },
      cache: 'no-store',
    };

    if (range) {
      (fetchOptions.headers as any)['Range'] = range;
    }

    const response = await fetch(`${STREAMING_URL}/stream/${hash}`, fetchOptions);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Stream unavailable' }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        headers.set(key, value);
      }
    });

    headers.set('Access-Control-Allow-Origin', '*');
    
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to connect' }), { status: 502 });
  }
}

export const dynamic = 'force-dynamic';