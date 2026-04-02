import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOwner?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireOwner, requireAdmin }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Mostrar loading mentre comprova autenticació
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregant...</p>
        </div>
      </div>
    );
  }

  // Si no està autenticat, redirigir a login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si requereix Owner i no ho és (superadmin també té accés)
  if (requireOwner && user.role !== 'owner' && user.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-2">Accés Denegat</h1>
          <p className="text-muted-foreground mb-4">
            Aquesta secció només està disponible per al propietari del sistema.
          </p>
          <Navigate to="/" replace />
        </div>
      </div>
    );
  }

  // Si requereix Admin (owner, admin o superadmin) i no ho és
  if (requireAdmin && user.role !== 'owner' && user.role !== 'admin' && user.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-2">Accés Denegat</h1>
          <p className="text-muted-foreground mb-4">
            Aquesta secció només està disponible per a administradors.
          </p>
          <Navigate to="/" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
