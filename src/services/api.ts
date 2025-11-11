// API Service per connectar amb el backend
// CORRECCIÓ: Afegit credentials: 'include' a totes les crides per enviar cookies de sessió

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface Appointment {
  id: number;
  phone: string;
  client_name: string;
  date: string;
  start_time: string;
  end_time: string;
  num_people: number;
  status: string;
  table_number: number;
  table_capacity: number;
  table_id?: number;
  notes?: string | null;
  created_at?: string;
}

export interface Table {
  id: number;
  table_number: number;
  capacity: number;
  status: string;
  pairing: number[];
}

export interface CreateTableData {
  table_number: number;
  capacity: number;
  status?: string;
  pairing?: number[];
}

export interface UpdateTableData {
  table_number?: number;
  capacity?: number;
  status?: string;
  pairing?: number[] | null;
}

export interface CreateAppointmentData {
  phone: string;
  client_name: string;
  date: string;
  time: string;
  num_people: number;
  duration_hours?: number;
}

export interface UpdateAppointmentData {
  date?: string;
  time?: string;
  num_people?: number;
  table_id?: number;
}

export interface Customer {
  phone: string;
  name: string;
  language: string;
  visit_count: number;
  last_visit: string;
  has_reservation_today?: boolean;
  no_show_count?: number;
}

export interface Conversation {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

// ========================================
// APPOINTMENTS
// ========================================

export async function getAppointments(): Promise<Appointment[]> {
  const response = await fetch(`${API_URL}/api/appointments`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint reserves');
  }
  return response.json();
}

export async function getAppointment(id: number): Promise<Appointment> {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint reserva');
  }
  return response.json();
}

export async function createAppointment(data: CreateAppointmentData): Promise<any> {
  const response = await fetch(`${API_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error creant reserva');
  }
  
  return response.json();
}

export async function updateAppointment(
  id: number,
  data: UpdateAppointmentData
): Promise<any> {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant reserva');
  }
  
  return response.json();
}

export async function deleteAppointment(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: 'DELETE',
    credentials: 'include', // ← AFEGIT
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error cancel·lant reserva');
  }
}

// ========================================
// TABLES
// ========================================

export async function getTables(): Promise<Table[]> {
  const response = await fetch(`${API_URL}/api/tables`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint taules');
  }
  return response.json();
}

export async function createTable(data: CreateTableData): Promise<any> {
  const response = await fetch(`${API_URL}/api/tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error creant taula');
  }
  
  return response.json();
}

export async function updateTable(
  tableId: number,
  data: UpdateTableData
): Promise<any> {
  const response = await fetch(`${API_URL}/api/tables/${tableId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant taula');
  }
  
  return response.json();
}

export async function updateTableStatus(
  tableId: number,
  status: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/tables/${tableId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify({ status }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant status');
  }
}

export async function deleteTable(tableId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/tables/${tableId}`, {
    method: 'DELETE',
    credentials: 'include', // ← AFEGIT
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error eliminant taula');
  }
}

// ========================================
// CUSTOMERS
// ========================================

export async function getCustomers(): Promise<Customer[]> {
  const response = await fetch(`${API_URL}/api/customers`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint clients');
  }
  return response.json();
}

export async function getConversations(phone: string): Promise<Conversation[]> {
  const response = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(phone)}`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint converses');
  }
  return response.json();
}

// ========================================
// OPENING HOURS
// ========================================

export interface OpeningHours {
  date: string;
  status: 'closed' | 'lunch_only' | 'dinner_only' | 'full_day';
  lunch_start?: string | null;
  lunch_end?: string | null;
  dinner_start?: string | null;
  dinner_end?: string | null;
  notes?: string | null;
}

export interface SetOpeningHoursData {
  date: string;
  status: 'closed' | 'lunch_only' | 'dinner_only' | 'full_day';
  lunch_start?: string;
  lunch_end?: string;
  dinner_start?: string;
  dinner_end?: string;
  notes?: string;
}

export async function getOpeningHours(date: string): Promise<OpeningHours> {
  const response = await fetch(`${API_URL}/api/opening-hours?date=${date}`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint horaris');
  }
  return response.json();
}

export async function getOpeningHoursRange(fromDate: string, toDate: string): Promise<OpeningHours[]> {
  const response = await fetch(`${API_URL}/api/opening-hours?from=${fromDate}&to=${toDate}`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint horaris');
  }
  return response.json();
}

export async function setOpeningHours(data: SetOpeningHoursData): Promise<any> {
  const response = await fetch(`${API_URL}/api/opening-hours`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error guardant horaris');
  }
  
  return response.json();
}

export async function updateOpeningHours(date: string, data: Partial<SetOpeningHoursData>): Promise<any> {
  const response = await fetch(`${API_URL}/api/opening-hours/${date}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant horaris');
  }
  
  return response.json();
}

// ========================================
// WEEKLY DEFAULTS
// ========================================

export interface WeeklyDefault {
  day_of_week: number;
  day_name: string;
  status: 'closed' | 'lunch_only' | 'dinner_only' | 'full_day';
  lunch_start?: string | null;
  lunch_end?: string | null;
  dinner_start?: string | null;
  dinner_end?: string | null;
}

export interface UpdateWeeklyDefaultData {
  status: 'closed' | 'lunch_only' | 'dinner_only' | 'full_day';
  lunch_start?: string;
  lunch_end?: string;
  dinner_start?: string;
  dinner_end?: string;
}

export async function getWeeklyDefaults(): Promise<WeeklyDefault[]> {
  const response = await fetch(`${API_URL}/api/weekly-defaults`, {
    credentials: 'include', // ← AFEGIT
  });
  if (!response.ok) {
    throw new Error('Error obtenint configuració setmanal');
  }
  return response.json();
}

export async function updateWeeklyDefault(
  dayOfWeek: number,
  data: UpdateWeeklyDefaultData
): Promise<any> {
  const response = await fetch(`${API_URL}/api/weekly-defaults/${dayOfWeek}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // ← AFEGIT
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant configuració setmanal');
  }
  
  return response.json();
}

// ==========================================
// CLIENT CONFIGURATION
// ==========================================

export interface ClientConfig {
  key: string;
  value: string;
  value_type: string;
  category: string;
  description: string;
  updated_at: string;
}

export async function getClientConfigs(): Promise<ClientConfig[]> {
  const response = await fetch(`${API_URL}/api/config`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error obtenint configuració');
  }

  return response.json();
}

export async function updateClientConfig(key: string, value: string): Promise<any> {
  const response = await fetch(`${API_URL}/api/config/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant configuració');
  }

  return response.json();
}