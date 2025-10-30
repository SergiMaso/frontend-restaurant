import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, getCurrentUser, login as loginApi, logout as logoutApi } from '@/services/auth';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Carregar usuari actual al iniciar
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // No autenticat
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await loginApi({ email, password });
      setUser(response.user);
      
      toast({
        title: "Login correcte",
        description: `Benvingut/da, ${response.user.full_name}!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error en login",
        description: error.message || "Email o password incorrectes",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
      setUser(null);
      
      toast({
        title: "Logout correcte",
        description: "Sessió tancada correctament",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error en logout",
        description: error.message,
      });
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isOwner: user?.role === 'owner',
    isAdmin: user?.role === 'admin' || user?.role === 'owner',
    isStaff: user?.role === 'staff',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
