import Link from 'next/link';
import styles from './not-found.module.css';

export const metadata = { title: '404 — Página não encontrada | StreamFlix' };

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.glow1} />
        <div className={styles.glow2} />
      </div>

      <div className={styles.content}>
        <div className={styles.code}>404</div>
        <div className={styles.filmStrip}>
          {['🎬','🍿','📽️','🎞️','📺'].map((e, i) => (
            <span key={i} className={styles.filmCell} style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
          ))}
        </div>
        <h1 className={styles.title}>Conteúdo não encontrado</h1>
        <p className={styles.subtitle}>
          O conteúdo que você procura não existe ou foi movido.<br />
          Explore nosso catálogo e encontre algo incrível!
        </p>

        <div className={styles.actions} suppressHydrationWarning>
          <Link href="/" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Ir para o início
          </Link>
          <Link href="/movies" className="btn btn-secondary">
            🎬 Ver filmes
          </Link>
          <Link href="/series" className="btn btn-secondary">
            📺 Ver séries
          </Link>
        </div>
      </div>
    </div>
  );
}
