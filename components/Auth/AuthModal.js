'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';
import { X, Mail, Lock } from 'lucide-react';
import styles from './AuthModal.module.css';

export default function AuthModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    const supabase = createClient();

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password 
        });
        if (error) throw error;
        toast?.addToast('Bem-vindo de volta!', 'success');
        onClose();
        setTimeout(() => { window.location.reload(); }, 500);
      } else {
        const { error } = await supabase.auth.signUp({ 
          email: email.trim(), 
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        toast?.addToast('Conta criada! Verifique seu e-mail.', 'success');
        onClose();
      }
    } catch (err) {
      toast?.addToast(err.message || 'Erro ao processar solicitação', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
        
        <div className={styles.content}>
          <div className={styles.logoWrapper}>
            <span className={styles.logoRed}>Stream</span>Flix
          </div>
          
          <h2 className={styles.title}>{isLogin ? 'Entrar' : 'Criar conta'}</h2>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputContainer}>
              <input 
                type="email" 
                id="email"
                placeholder=" "
                className={styles.inputField}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required 
              />
              <label htmlFor="email" className={styles.inputLabel}>E-mail</label>
            </div>
            
            <div className={styles.inputContainer}>
              <input 
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder=" "
                className={styles.inputField}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required 
              />
              <label htmlFor="password" className={styles.inputLabel}>Senha</label>
              <button 
                type="button" 
                className={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <X size={20} /> : <div className={styles.eyeIcon} />}
              </button>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.loader} /> : isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
            
            <div className={styles.helpRow}>
               <label className={styles.rememberMe}>
                  <input type="checkbox" className={styles.checkbox} />
                  <span>Lembrar de mim</span>
               </label>
               <button type="button" className={styles.helpLink}>Precisa de ajuda?</button>
            </div>
          </form>

          <div className={styles.footer}>
            <div className={styles.conversion}>
              <span>{isLogin ? 'Novo por aqui?' : 'Já tem uma conta?'}</span>
              <button onClick={() => setIsLogin(!isLogin)} className={styles.switchBtn}>
                {isLogin ? 'Assine agora.' : 'Faça login.'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
