'use client';
import { useAuth } from '@/contexts/AuthContext';
import ProfileSelector from './ProfileSelector';

export default function ProfileGuard({ children }) {
  const { user, profile, loading, initialized } = useAuth();

  // Enquanto a sessão ainda está sendo verificada, renderiza os filhos
  // sem bloquear (evita flash de conteúdo incorreto)
  if (loading || !initialized) return children;

  // Sem usuário logado: renderiza normalmente (Navbar mostrará botão de login)
  if (!user) return children;

  // Logado mas sem perfil ativo: mostra seletor de perfil
  if (user && !profile) {
    return <ProfileSelector />;
  }

  return children;
}
