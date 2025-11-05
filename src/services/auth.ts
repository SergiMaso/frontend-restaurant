// Auth Service per connectar amb el backend d'autenticació

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// DEBUG: Veure quina URL s'està usant
console.log('🔧 API_URL configurada:', API_URL);

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'staff';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  token: string;
  password: string;
  full_name: string;
}

export interface SetupData {
  email: string;
  password: string;
  full_name: string;
  setup_key: string;
}

export interface InviteData {
  email: string;
  role: 'admin' | 'staff';
}

export interface ChangePasswordData {
  old_password: string;
  new_password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  new_password: string;
}

// ========================================
// AUTH ENDPOINTS
// ========================================

export async function login(data: LoginData): Promise<{ user: User; message: string }> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important per cookies de sessió
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en login');
  }
  
  return response.json();
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en logout');
  }
}

export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'No autenticat');
  }
  
  return response.json();
}

export async function register(data: RegisterData): Promise<{ message: string; user_id: number }> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en registre');
  }
  
  return response.json();
}

export async function setup(data: SetupData): Promise<{ message: string; user_id: number }> {
  const response = await fetch(`${API_URL}/auth/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en setup');
  }
  
  return response.json();
}

export async function sendInvitation(data: InviteData): Promise<any> {
  const response = await fetch(`${API_URL}/auth/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error enviant invitació');
  }
  
  return response.json();
}

export async function changePassword(data: ChangePasswordData): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error canviant password');
  }
  
  return response.json();
}

export async function forgotPassword(data: ForgotPasswordData): Promise<any> {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en recuperació de password');
  }
  
  return response.json();
}

export async function resetPassword(data: ResetPasswordData): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error resetejant password');
  }
  
  return response.json();
}

// ========================================
// USER MANAGEMENT (només Owner)
// ========================================

export async function listUsers(): Promise<any[]> {
  const response = await fetch(`${API_URL}/auth/users`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error obtenint usuaris');
  }
  
  return response.json();
}

export async function deactivateUser(userId: number): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/users/${userId}/deactivate`, {
    method: 'PUT',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error desactivant usuari');
  }
  
  return response.json();
}
