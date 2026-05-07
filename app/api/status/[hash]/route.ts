import { NextRequest } from 'next/server';

const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://147.15.92.17:4000';

export async function GET(request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const resolvedParams = await params;
  const hash = resolvedParams?.hash;
  
  if (!hash || hash.length < 20) {
    return Response.json({ status: 'invalid', peers: 0 });
  }

  try {
    const response = await fetch(`${STREAMING_URL}/status/${hash}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return Response.json({ status: 'error', peers: 0 });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error: any) {
    return Response.json({ 
      status: 'unavailable', 
      peers: 0,
      error: error.message || String(error)
    });
  }
}

export const dynamic = 'force-dynamic';