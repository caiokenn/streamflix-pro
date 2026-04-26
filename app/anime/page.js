import { discoverTV } from '@/lib/tmdb';
import Hero from '@/components/Hero/Hero';
import ContentRow from '@/components/ContentRow/ContentRow';

export const metadata = { title: 'Animes' };
export const revalidate = 3600;

// Genre 16 = Animation, keyword anime
export default async function AnimePage() {
  const [popularAnime, topAnime, ongoingAnime] = await Promise.all([
    discoverTV('with_genres=16&with_keywords=210024&sort_by=popularity.desc'),
    discoverTV('with_genres=16&with_keywords=210024&sort_by=vote_average.desc&vote_count.gte=200'),
    discoverTV('with_genres=16&with_keywords=210024&with_status=0'),
  ]);

  const heroItems = popularAnime?.results?.slice(0, 5) || [];

  return (
    <>
      <Hero items={heroItems} />
      <div style={{ paddingBottom: '4rem' }}>
        <ContentRow title="Animes Populares" icon="⛩️" items={popularAnime?.results || []} viewAllHref="/genres?type=tv&id=16" />
        <ContentRow title="Mais Bem Avaliados" icon="⭐" items={topAnime?.results || []} viewAllHref="/genres?type=tv&id=16" />
        <ContentRow title="Em Andamento" icon="📡" items={ongoingAnime?.results || []} viewAllHref="/genres?type=tv&id=16" />
      </div>
    </>
  );
}
