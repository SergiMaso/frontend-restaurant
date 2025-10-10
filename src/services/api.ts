// API Service per connectar amb el backend

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
  notes?: string | null;
  created_at?: string;
}

export interface Table {
  id: number;
  table_number: number;
  capacity: number;
  status: string;
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
}

export interface Customer {
  phone: string;
  name: string;
  language: string;
  visit_count: number;
  last_visit: string;
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
  const response = await fetch(`${API_URL}/api/appointments`);
  if (!response.ok) {
    throw new Error('Error obtenint reserves');
  }
  return response.json();
}

export async function getAppointment(id: number): Promise<Appointment> {
  const response = await fetch(`${API_URL}/api/appointments/${id}`);
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
  const response = await fetch(`${API_URL}/api/tables`);
  if (!response.ok) {
    throw new Error('Error obtenint taules');
  }
  return response.json();
}

// ========================================
// CUSTOMERS
// ========================================

export async function getCustomers(): Promise<Customer[]> {
  const response = await fetch(`${API_URL}/api/customers`);
  if (!response.ok) {
    throw new Error('Error obtenint clients');
  }
  return response.json();
}

export async function getConversations(phone: string): Promise<Conversation[]> {
  const response = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(phone)}`);
  if (!response.ok) {
    throw new Error('Error obtenint converses');
  }
  return response.json();
}
