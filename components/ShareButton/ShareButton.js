'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast/Toast';
import { Share2 } from 'lucide-react';
import styles from './ShareButton.module.css';

export default function ShareButton({ title, url }) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleShare() {
    const shareData = {
      title: `Assista ${title} no StreamFlix`,
      text: `Confira ${title} no StreamFlix!`,
      url: url || window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        toast?.addToast('Link copiado para a área de transferência!', 'success');
      } catch (err) {
        toast?.addToast('Erro ao copiar link', 'error');
      }
    }
  }

  return (
    <button 
      className={`btn btn-secondary ${styles.shareBtn}`} 
      onClick={handleShare}
      title="Compartilhar"
    >
      <Share2 size={18} />
      <span>Compartilhar</span>
    </button>
  );
}
