import { getPopularMovies, getTopRatedMovies, getNowPlayingMovies, getUpcomingMovies, discoverMovies } from '@/lib/tmdb';
import Hero from '@/components/Hero/Hero';
import ContentRow from '@/components/ContentRow/ContentRow';

export const metadata = { title: 'Filmes' };
export const revalidate = 3600;

export default async function MoviesPage() {
  const [popular, topRated, nowPlaying, upcoming, action, comedy, horror] = await Promise.all([
    getPopularMovies(),
    getTopRatedMovies(),
    getNowPlayingMovies(),
    getUpcomingMovies(),
    discoverMovies('with_genres=28'),
    discoverMovies('with_genres=35'),
    discoverMovies('with_genres=27'),
  ]);

  const heroItems = popular?.results?.slice(0, 5) || [];

  return (
    <>
      <Hero items={heroItems} />
      <div style={{ paddingBottom: '4rem' }}>
        <ContentRow title="Em Cartaz" icon="🎬" items={nowPlaying?.results || []} viewAllHref="/genres?type=movie" />
        <ContentRow title="Mais Populares" icon="🔥" items={popular?.results || []} viewAllHref="/genres?type=movie" />
        
        {/* Divisões por Categorias */}
        <ContentRow title="Ação Implacável" icon="💥" items={action?.results || []} viewAllHref="/genres?type=movie&id=28" />
        <ContentRow title="Comédias" icon="😂" items={comedy?.results || []} viewAllHref="/genres?type=movie&id=35" />
        
        <ContentRow title="Mais Bem Avaliados" icon="⭐" items={topRated?.results || []} viewAllHref="/genres?type=movie" />
        <ContentRow title="Terror" icon="👻" items={horror?.results || []} viewAllHref="/genres?type=movie&id=27" />
        <ContentRow title="Em Breve" icon="📅" items={upcoming?.results || []} viewAllHref="/genres?type=movie" />
      </div>
    </>
  );
}
