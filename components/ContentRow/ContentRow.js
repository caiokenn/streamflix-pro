import { ChevronRight } from 'lucide-react';
import ContentCard from '@/components/ContentCard/ContentCard';
import styles from './ContentRow.module.css';

export default function ContentRow({ title, items = [], icon, size = 'md', viewAllHref }) {
  if (!items.length) return null;

  return (
    <section className={`${styles.section} nav-row`}>
      <div className={styles.header} suppressHydrationWarning>
        <h2 className={styles.title}>
          <span className={styles.accentLine} />
          {icon && (
            <div className={styles.iconContainer} suppressHydrationWarning>
              {typeof icon === 'string' ? <span>{icon}</span> : icon}
            </div>
          )}
          {title}
        </h2>
        {viewAllHref && (
          <a href={viewAllHref} className={styles.viewAll}>
            <span>Ver todos</span>
            <ChevronRight size={14} />
          </a>
        )}
      </div>

      <div className={styles.row} suppressHydrationWarning>
        {items.map((item, index) => (
          <ContentCard key={item.id} item={item} size={size} index={index} />
        ))}
      </div>
    </section>
  );
}
