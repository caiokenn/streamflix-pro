'use client';
import { useAuth } from '@/contexts/AuthContext';
import styles from './AuthBanner.module.css';
import { UserPlus, Star, ShieldCheck, Heart } from 'lucide-react';

export default function AuthBanner() {
  const { user, setIsAuthOpen } = useAuth();

  if (user) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.left}>
          <h2 className={styles.title}>Leve sua experiência para o próximo nível</h2>
          <p className={styles.description}>
            Crie sua conta gratuita para salvar seus filmes favoritos, sincronizar seu progresso em qualquer dispositivo e receber recomendações personalizadas.
          </p>
          <div className={styles.features}>
            <div className={styles.feature}>
              <Star size={16} className={styles.icon} />
              <span>Sincronização em tempo real</span>
            </div>
            <div className={styles.feature}>
              <Heart size={16} className={styles.icon} />
              <span>Lista de favoritos</span>
            </div>
            <div className={styles.feature}>
              <ShieldCheck size={16} className={styles.icon} />
              <span>Acesso ilimitado</span>
            </div>
          </div>
          <button className={styles.cta} onClick={() => setIsAuthOpen(true)}>
            <UserPlus size={20} />
            <span>Criar Conta Gratuita</span>
          </button>
        </div>
        <div className={styles.right}>
            {/* Visual element or just empty for balance */}
            <div className={styles.glassCard}>
                <div className={styles.cardHeader}>
                    <div className={styles.dot} />
                    <div className={styles.dot} />
                    <div className={styles.dot} />
                </div>
                <div className={styles.cardBody}>
                    <div className={styles.skeletonLine} style={{ width: '60%' }} />
                    <div className={styles.skeletonLine} style={{ width: '80%' }} />
                    <div className={styles.skeletonLine} style={{ width: '40%' }} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
