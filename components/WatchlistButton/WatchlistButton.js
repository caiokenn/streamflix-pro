'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast/Toast';
import { createClient } from '@/lib/supabase/client';
import { Plus, Check } from 'lucide-react';
import styles from './WatchlistButton.module.css';

export default function WatchlistButton({ tmdbId, mediaType, title }) {
  const { user, profile, loading } = useAuth();
  const toast = useToast();
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile?.id || !tmdbId) return;
    const supabase = createClient();
    supabase
      .from('watchlist')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .maybeSingle()
      .then(({ data }) => setInList(!!data));
  }, [profile?.id, tmdbId, mediaType]);

  if (loading || !user || !profile) return null;

  async function toggle() {
    const supabase = createClient();
    setBusy(true);
    try {
      if (inList) {
        await supabase
          .from('watchlist')
          .delete()
          .eq('profile_id', profile.id)
          .eq('tmdb_id', tmdbId)
          .eq('media_type', mediaType);
        setInList(false);
        toast?.addToast(title ? `"${title}" removido da lista` : 'Removido da lista', 'info');
      } else {
        await supabase
          .from('watchlist')
          .upsert({ profile_id: profile.id, tmdb_id: tmdbId, media_type: mediaType });
        setInList(true);
        toast?.addToast(title ? `"${title}" adicionado ✓` : 'Adicionado à lista ✓', 'success');
      }
    } catch {
      toast?.addToast('Erro ao atualizar lista', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`btn btn-secondary ${styles.btn} ${inList ? styles.active : ''}`}
      onClick={toggle}
      disabled={busy}
      title={inList ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
    >
      {busy ? (
        <span className={styles.spinner} />
      ) : inList ? (
        <Check size={18} />
      ) : (
        <Plus size={18} />
      )}
      <span>{inList ? 'Na minha lista' : 'Minha lista'}</span>
    </button>
  );
}
