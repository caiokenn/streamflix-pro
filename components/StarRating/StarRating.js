'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { saveRating, getRating } from '@/lib/supabase';
import { useToast } from '@/components/Toast/Toast';
import styles from './StarRating.module.css';

export default function StarRating({ tmdbId, mediaType }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [rating, setRating] = useState(0);   // 0-5
  const [hovered, setHovered] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    getRating(profile.id, tmdbId, mediaType).then(data => {
      if (data?.stars_value) setRating(data.stars_value);
    });
  }, [user, profile, tmdbId, mediaType]);

  async function handleRate(stars) {
    if (!user || !profile) {
      toast?.addToast('Faça login para avaliar', 'info');
      return;
    }
    setLoading(true);
    const prev = rating;
    setRating(stars);
    const { error } = await saveRating(profile.id, tmdbId, mediaType,
      stars >= 4 ? 'like' : stars >= 2 ? 'neutral' : 'dislike',
      stars
    );
    if (error) {
      setRating(prev);
      toast?.addToast('Erro ao salvar avaliação', 'error');
    } else {
      const msgs = ['😐 Avaliação salva', '👎 Não curtiu', '🤷 Foi ok', '👍 Legal!', '❤️ Amou!', '🔥 Obra-prima!'];
      toast?.addToast(msgs[stars] || 'Avaliação salva!', 'success');
    }
    setLoading(false);
  }

  if (!user) return null;

  const display = hovered || rating;

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Sua nota:</span>
      <div className={styles.stars} onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            className={`${styles.star} ${star <= display ? styles.starFilled : ''} ${loading ? styles.disabled : ''}`}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            disabled={loading}
            title={`${star} estrela${star > 1 ? 's' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill={star <= display ? '#f5c518' : 'none'} stroke={star <= display ? '#f5c518' : '#6b6b80'} strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
        ))}
      </div>
      {rating > 0 && (
        <span className={styles.ratingVal}>{rating}/5</span>
      )}
    </div>
  );
}
