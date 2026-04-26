'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import styles from './BackButton.module.css';

export default function BackButton({ className = '' }) {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.back()} 
      className={`${styles.backBtn} ${className}`}
      aria-label="Voltar"
    >
      <ArrowLeft size={20} strokeWidth={2.5} />
      <span>Voltar</span>
    </button>
  );
}
