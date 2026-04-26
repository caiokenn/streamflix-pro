import { getTrending, getPopularMovies, getPopularTV, getTopRatedMovies, getNowPlayingMovies, getAiringTodayTV } from '@/lib/tmdb';
import Hero from '@/components/Hero/Hero';
import ContentRow from '@/components/ContentRow/ContentRow';
import ContinueWatching from '@/components/ContinueWatching/ContinueWatching';
import styles from './page.module.css';
import AuthBanner from '@/components/AuthBanner/AuthBanner';

export const revalidate = 3600;

async function getHomeData() {
  const [trending, popularMovies, popularTV, topRatedMovies, nowPlaying, airingToday] = await Promise.all([
    getTrending('all', 'week'),
    getPopularMovies(),
    getPopularTV(),
    getTopRatedMovies(),
    getNowPlayingMovies(),
    getAiringTodayTV(),
  ]);

  return {
    trending: trending?.results || [],
    popularMovies: popularMovies?.results || [],
    popularTV: popularTV?.results || [],
    topRatedMovies: topRatedMovies?.results || [],
    nowPlaying: nowPlaying?.results || [],
    airingToday: airingToday?.results || [],
  };
}

import { Flame, Clapperboard, Tv, Star, Radio, Film } from 'lucide-react';

export default async function HomePage() {
  const { trending, popularMovies, popularTV, topRatedMovies, nowPlaying, airingToday } = await getHomeData();
  const heroItems = trending.slice(0, 5);

  return (
    <main className={styles.homeContainer}>
      <Hero items={heroItems} />

      <div className={styles.rowsWrapper} suppressHydrationWarning>
        {/* Continue Watching — só aparece se o usuário estiver logado e tiver progresso */}
        <ContinueWatching />

        <ContentRow
          title="Populares Agora"
          icon={<Flame size={18} fill="currentColor" />}
          items={trending.slice(0, 20)}
          viewAllHref="/trending"
          size="md"
        />

        <AuthBanner />

        <ContentRow
          title="Em Cartaz"
          icon={<Clapperboard size={18} />}
          items={nowPlaying}
          viewAllHref="/movies?filter=now_playing"
          size="md"
        />

        <ContentRow
          title="Séries Populares"
          icon={<Tv size={18} />}
          items={popularTV}
          viewAllHref="/series"
          size="md"
        />

        <ContentRow
          title="Filmes Mais Bem Avaliados"
          icon={<Star size={18} fill="currentColor" />}
          items={topRatedMovies}
          viewAllHref="/movies?filter=top_rated"
          size="md"
        />

        <ContentRow
          title="Séries no Ar Hoje"
          icon={<Radio size={18} />}
          items={airingToday}
          viewAllHref="/series?filter=airing_today"
          size="md"
        />

        <ContentRow
          title="Filmes Populares"
          icon={<Film size={18} />}
          items={popularMovies}
          viewAllHref="/movies"
          size="md"
        />
      </div>
    </main>
  );
}
