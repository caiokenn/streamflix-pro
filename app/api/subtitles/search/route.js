const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://159.112.189.135:4000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  if (!type || !id) {
    return Response.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const providers = [
      `https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`,
      `https://opensubtitles.strem.io/subtitles/${type}/${id}.json`
    ];

    for (const url of providers) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        console.log(`[API PROXY] Buscando legendas em: ${url}`);
        const response = await fetch(url, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.subtitles && data.subtitles.length > 0) {
            console.log(`[API PROXY] Sucesso! ${data.subtitles.length} legendas encontradas em ${url}`);
            return Response.json(data);
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`[API PROXY ERROR] Falha no provedor ${url}:`, e.message);
      }
    }
    
    // Se nenhum provedor retornou legendas
    return Response.json({ subtitles: [] });
  } catch (error) {
    console.error('[API PROXY FATAL ERROR]:', error.message);
    return Response.json({ subtitles: [], error: error.message });
  }
}

export const dynamic = 'force-dynamic';
