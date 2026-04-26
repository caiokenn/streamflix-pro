import { getPopularTV, getTopRatedTV, getAiringTodayTV, discoverTV } from '@/lib/tmdb';
import Hero from '@/components/Hero/Hero';
import ContentRow from '@/components/ContentRow/ContentRow';

export const metadata = { title: 'Séries' };
export const revalidate = 3600;

export default async function SeriesPage() {
  const [popular, topRated, airingToday, actionAdv, comedy, drama, scifi] = await Promise.all([
    getPopularTV(),
    getTopRatedTV(),
    getAiringTodayTV(),
    discoverTV('with_genres=10759'),
    discoverTV('with_genres=35'),
    discoverTV('with_genres=18'),
    discoverTV('with_genres=10765'),
  ]);

  const heroItems = popular?.results?.slice(0, 5) || [];

  return (
    <>
      <Hero items={heroItems} />
      <div style={{ paddingBottom: '4rem' }}>
        <ContentRow title="No Ar Hoje" icon="📡" items={airingToday?.results || []} viewAllHref="/genres?type=tv" />
        <ContentRow title="Mais Populares" icon="🔥" items={popular?.results || []} viewAllHref="/genres?type=tv" />
        
        {/* Divisões por Categorias */}
        <ContentRow title="Ação & Aventura" icon="🏃" items={actionAdv?.results || []} viewAllHref="/genres?type=tv&id=10759" />
        <ContentRow title="Comédias" icon="😂" items={comedy?.results || []} viewAllHref="/genres?type=tv&id=35" />
        <ContentRow title="Drama" icon="🎭" items={drama?.results || []} viewAllHref="/genres?type=tv&id=18" />
        
        <ContentRow title="Mais Bem Avaliadas" icon="⭐" items={topRated?.results || []} viewAllHref="/genres?type=tv" />
        <ContentRow title="Ficção & Fantasia" icon="🧝" items={scifi?.results || []} viewAllHref="/genres?type=tv&id=10765" />
      </div>
    </>
  );
}
