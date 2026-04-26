import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      {/* Hero skeleton */}
      <div className={`${styles.heroSkeleton} skeleton`} />

      <div className={styles.rows}>
        {[1, 2, 3].map(i => (
          <div key={i} className={styles.rowGroup}>
            <div className={`${styles.titleSkeleton} skeleton`} />
            <div className={styles.cardRow}>
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className={`${styles.cardSkeleton} skeleton`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
