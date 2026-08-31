// API Service per connectar amb el backend
// Includes X-Restaurant-ID header for multi-tenant support

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Helper to get restaurant ID header
function getRestaurantHeaders(): HeadersInit {
  const restaurantId = localStorage.getItem('selectedRestaurantId');
  const headers: HeadersInit = {};
  if (restaurantId) {
    headers['X-Restaurant-ID'] = restaurantId;
  }
  return headers;
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  const rawBody = await response.text();

  if (!rawBody) {
    return response.status === 401 ? 'La sessió ha caducat. Torna a iniciar sessió.' : fallback;
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error;
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message;
      }
    }
  } catch {
    // Fall back to handling plain-text or HTML responses below.
  }

  if (response.status === 401) {
    return 'La sessió ha caducat. Torna a iniciar sessió.';
  }

  const trimmedBody = rawBody.trim();
  return trimmedBody.startsWith('<') ? fallback : trimmedBody;
}

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
  table_numbers?: string;
  table_capacity: number;
  table_id?: number;
  table_ids?: number[];
  area_preference?: "auto" | "inside" | "terrace";
  manual_override?: boolean;
  notes?: string | null;
  created_at?: string;
  language?: string;
  /**
   * The CUSTOMER's current language, joined in by GET /api/appointments.
   * Distinct from `language` above, which is stored on the booking and can be
   * older than the customer's. ReservationDialog falls back to this when the
   * booking has no language of its own.
   */
  customer_language?: string;
  no_show?: boolean;
  seated_at?: string | null;
  left_at?: string | null;
  delay_minutes?: number | null;
  duration_minutes?: number | null;
}

export interface Table {
  id: number;
  table_number: number;
  capacity: number;
  status: string;
  pairing: number[];
  area?: "inside" | "terrace";
}

export interface CreateTableData {
  table_number: number;
  capacity: number;
  status?: string;
  pairing?: number[];
  area?: "inside" | "terrace";
}

export interface UpdateTableData {
  table_number?: number;
  capacity?: number;
  status?: string;
  pairing?: number[] | null;
  area?: "inside" | "terrace";
}

export interface CreateAppointmentData {
  phone: string;
  client_name: string;
  date: string;
  time: string;
  num_people: number;
  duration_hours?: number;
  area_preference?: "auto" | "inside" | "terrace";
  table_id?: number;
  table_ids?: number[];
  language?: string;
  notes?: string | null;
  /** Staff ticked "ask for a deposit". Overrides the day's rules and min_people. */
  send_payment_link?: boolean;
  /** Per person. Pre-filled from the day's rules, then whatever staff types. */
  deposit_amount_per_person?: number;
}

export interface UpdateAppointmentData {
  date?: string;
  time?: string;
  num_people?: number;
  table_id?: number;
  table_ids?: number[];
  area_preference?: "auto" | "inside" | "terrace";
}

/** Summary payload returned by POST/PUT /api/appointments (not a full Appointment record). */
export interface AppointmentMutationResult {
  appointment_id: number;
  table_ids: number[];
  manual_override: boolean;
  message?: string;
  /** Present when a deposit was requested and created. */
  requires_payment?: boolean;
  checkout_url?: string;
  payment_short_url?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_expiry_minutes?: number;
  /** False when the link exists but the WhatsApp message did not go out. */
  payment_link_sent?: boolean;
  /**
   * The booking WAS created; only the deposit failed. Comes back with a 201, not an
   * error status, so staff are never left thinking the reservation did not save.
   */
  payment_error?: string;
}

export interface PaymentTerms {
  /** False when the restaurant has no Stripe set up — hide the deposit controls. */
  payments_available: boolean;
  /** True when the day's own rules would charge this party automatically. */
  would_apply?: boolean;
  amount_per_person?: number | null;
  min_people?: number;
  currency?: string;
  /** The rules could not be resolved; the dialog opens but cannot suggest a figure. */
  terms_unavailable?: boolean;
}

/** What the day's rules would charge, for pre-filling the deposit box. */
export async function getPaymentTerms(
  date: string, time: string, numPeople: number,
): Promise<PaymentTerms> {
  const params = new URLSearchParams({ date, time, num_people: String(numPeople) });
  const response = await fetch(`${API_URL}/api/payment-terms?${params}`, {
    headers: { ...getRestaurantHeaders() },
    credentials: 'include',
  });
  if (!response.ok) {
    // Never block the dialog over this: it only supplies a suggested figure.
    return { payments_available: false };
  }
  return response.json();
}

export interface Customer {
  phone: string;
  bsuid?: string | null;
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
  channel?: string;  // 'whatsapp' | 'telegram' | 'voice'
}

// ========================================
// APPOINTMENTS
// ========================================

export async function getAppointments(): Promise<Appointment[]> {
  const response = await fetch(`${API_URL}/api/appointments`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error obtenint reserves'));
  }
  return response.json();
}

export async function getAppointment(id: number): Promise<Appointment> {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error obtenint reserva'));
  }
  return response.json();
}

export async function createAppointment(data: CreateAppointmentData): Promise<AppointmentMutationResult> {
  const response = await fetch(`${API_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error creant reserva'));
  }

  return response.json();
}

export async function updateAppointment(id: number, data: UpdateAppointmentData): Promise<AppointmentMutationResult> {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error actualitzant reserva'));
  }
  
  return response.json();
}

export async function deleteAppointment(id: number, refund = false): Promise<void> {
  const response = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    body: JSON.stringify({ refund }),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error cancel·lant reserva'));
  }
}

// ========================================
// TABLES
// ========================================

export async function getTables(): Promise<Table[]> {
  const response = await fetch(`${API_URL}/api/tables`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error obtenint taules');
  }
  return response.json();
}

export async function createTable(data: CreateTableData): Promise<Table> {
  const response = await fetch(`${API_URL}/api/tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error creant taula');
  }
  
  return response.json();
}

export async function updateTable(tableId: number, data: UpdateTableData): Promise<Table> {
  const response = await fetch(`${API_URL}/api/tables/${tableId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant taula');
  }
  
  return response.json();
}

export async function updateTableStatus(tableId: number, status: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/tables/${tableId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
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
    credentials: 'include',
    headers: getRestaurantHeaders(),
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
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error obtenint clients');
  }
  return response.json();
}

export async function getConversations(phone: string): Promise<Conversation[]> {
  const response = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(phone)}`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
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
  /** null = this date inherits its weekday. The backend returns these; without them
      declared here the date dialog cannot show what it is currently overriding. */
  slot_config?: SlotConfig | null;
  payment_config?: PaymentConfig | null;
}

export interface SetOpeningHoursData {
  date: string;
  status: 'closed' | 'lunch_only' | 'dinner_only' | 'full_day';
  lunch_start?: string;
  lunch_end?: string;
  dinner_start?: string;
  dinner_end?: string;
  notes?: string;
  /** Send null to clear the override and inherit the weekday again. */
  slot_config?: SlotConfig | null;
  payment_config?: PaymentConfig | null;
}

export async function getOpeningHours(date: string): Promise<OpeningHours> {
  const response = await fetch(`${API_URL}/api/opening-hours?date=${date}`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error obtenint horaris');
  }
  return response.json();
}

export async function getOpeningHoursRange(fromDate: string, toDate: string): Promise<OpeningHours[]> {
  const response = await fetch(`${API_URL}/api/opening-hours?from=${fromDate}&to=${toDate}`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error obtenint horaris');
  }
  return response.json();
}

export async function setOpeningHours(data: SetOpeningHoursData): Promise<OpeningHours> {
  const response = await fetch(`${API_URL}/api/opening-hours`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error guardant horaris');
  }
  
  return response.json();
}

export async function updateOpeningHours(date: string, data: Partial<SetOpeningHoursData>): Promise<OpeningHours> {
  const response = await fetch(`${API_URL}/api/opening-hours/${date}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
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

/**
 * Per-day overrides. NULL means INHERIT — a level that has not been customised follows
 * the one above automatically, which is why clearing a value is how you reset it.
 *
 * slot_config keys ARE the slots that exist for that service; a null cap means the slot
 * exists with no people limit. Defining a service takes ownership of its whole list, so
 * slots added globally afterwards do not appear there — the reset control is the way back.
 */
export interface SlotConfig {
  lunch?: Record<string, number | null>;
  dinner?: Record<string, number | null>;
}

export interface ServicePaymentConfig {
  required?: boolean;
  /** Per person. Omit to inherit the amount from the level above. */
  amount?: number;
  min_people?: number;
}

export interface PaymentConfig {
  lunch?: ServicePaymentConfig;
  dinner?: ServicePaymentConfig;
}

export interface WeeklyDefault {
  day_of_week: number;
  day_name: string;
  status: 'closed' | 'lunch_only' | 'dinner_only' | 'full_day';
  lunch_start?: string | null;
  lunch_end?: string | null;
  dinner_start?: string | null;
  dinner_end?: string | null;
  /** null = inherits the global config. Distinct from {} , which would be an override. */
  slot_config?: SlotConfig | null;
  payment_config?: PaymentConfig | null;
}

export interface UpdateWeeklyDefaultData {
  status: 'closed' | 'lunch_only' | 'dinner_only' | 'full_day';
  lunch_start?: string;
  lunch_end?: string;
  dinner_start?: string;
  dinner_end?: string;
  /** Send null to clear the override and inherit global again. */
  slot_config?: SlotConfig | null;
  payment_config?: PaymentConfig | null;
}

export async function getWeeklyDefaults(): Promise<WeeklyDefault[]> {
  const response = await fetch(`${API_URL}/api/weekly-defaults`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error('Error obtenint configuració setmanal');
  }
  return response.json();
}

export async function updateWeeklyDefault(dayOfWeek: number, data: UpdateWeeklyDefaultData): Promise<WeeklyDefault> {
  const response = await fetch(`${API_URL}/api/weekly-defaults/${dayOfWeek}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
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
    headers: getRestaurantHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error obtenint configuració');
  }

  return response.json();
}

export async function updateClientConfig(key: string, value: string): Promise<ClientConfig> {
  const response = await fetch(`${API_URL}/api/config/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
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

// ==========================================
// STATS
// ==========================================

export interface GlobalStats {
  total_reservations: number;
  total_customers: number;
  reservations_today: number;
  reservations_this_week: number;
  avg_party_size: number;
  no_show_rate: number;
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const response = await fetch(`${API_URL}/api/stats/global`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error obtenint estadístiques');
  }

  return response.json();
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

export interface UpdateCustomerData {
  name?: string;
  language?: string;
}

export async function updateCustomer(phone: string, data: UpdateCustomerData): Promise<Customer> {
  const response = await fetch(`${API_URL}/api/customers/${encodeURIComponent(phone)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    const err = new Error(error.error || 'Error actualitzant client') as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export async function deleteCustomer(phone: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/customers/${encodeURIComponent(phone)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error eliminant client');
  }
}

// ==========================================
// APPOINTMENT ACTIONS
// ==========================================

export async function markAppointmentSeated(appointmentId: number): Promise<{ message: string; appointment_id: number; delay_minutes: number }> {
  const response = await fetch(`${API_URL}/api/appointments/${appointmentId}/seated`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error marcant reserva com assegut');
  }

  return response.json();
}

export async function markAppointmentLeft(appointmentId: number): Promise<{ message: string; appointment_id: number; duration_minutes: number }> {
  const response = await fetch(`${API_URL}/api/appointments/${appointmentId}/left`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error marcant reserva com sortit');
  }

  return response.json();
}

export async function markAppointmentNoShow(appointmentId: number): Promise<{ message: string; appointment_id: number }> {
  const response = await fetch(`${API_URL}/api/appointments/${appointmentId}/no-show`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error marcant reserva com no-show');
  }

  return response.json();
}

// ==========================================
// MESSAGING
// ==========================================

export interface SendMessageData {
  phone: string;
  message: string;
}

export async function sendMessage(data: SendMessageData): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/send-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error enviant missatge');
  }

  return response.json();
}

// ==========================================
// BROADCAST
// ==========================================

export interface BroadcastData {
  message: string;
  filter?: {
    language?: string;
    min_visits?: number;
    has_reservation_today?: boolean;
  };
}

export async function previewBroadcast(data: BroadcastData): Promise<{ recipients: Customer[]; count: number }> {
  const response = await fetch(`${API_URL}/api/broadcast/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error obtenint preview de broadcast');
  }

  return response.json();
}

export async function sendBroadcast(data: BroadcastData): Promise<{ sent: number; failed: number }> {
  const response = await fetch(`${API_URL}/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error enviant broadcast');
  }

  return response.json();
}

// ==========================================
// MEDIA
// ==========================================

export interface Media {
  id: number;
  type: 'menu' | 'image' | 'document';
  filename: string;
  cloudinary_url: string;
  cloudinary_public_id: string;
  description?: string;
  active: boolean;
  created_at: string;
}

export async function getMedia(): Promise<Media[]> {
  const response = await fetch(`${API_URL}/api/media`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error obtenint media');
  }

  return response.json();
}

export async function uploadMedia(formData: FormData): Promise<Media> {
  // For FormData, we need to add the header differently
  const restaurantId = localStorage.getItem('selectedRestaurantId');
  const headers: HeadersInit = {};
  if (restaurantId) {
    headers['X-Restaurant-ID'] = restaurantId;
  }

  const response = await fetch(`${API_URL}/api/media`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error pujant media');
  }

  return response.json();
}

export async function deleteMedia(mediaId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/media/${mediaId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error eliminant media');
  }
}

// ==========================================
// PAYMENTS
// ==========================================

export interface PaymentRecord {
  id: number;
  appointment_id: number;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'refunded' | 'failed' | 'expired';
  refund_id: string | null;
  refund_eligible: boolean;
  created_at: string;
  updated_at: string;
  appointment: {
    date: string;
    start_time: string;
    num_people: number;
    status: string;
    phone: string;
    customer_name: string | null;
  };
}

export interface PaymentsResponse {
  payments: PaymentRecord[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export async function getPayments(page = 1, status?: string, search?: string): Promise<PaymentsResponse> {
  const params = new URLSearchParams({ page: String(page), per_page: '25' });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const response = await fetch(`${API_URL}/api/payments?${params}`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error loading payments'));
  }
  return response.json();
}

export async function markAppointmentPaid(appointmentId: number): Promise<{ message: string; appointment_id: number }> {
  const response = await fetch(`${API_URL}/api/appointments/${appointmentId}/mark-paid`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error marking as paid'));
  }
  return response.json();
}

export async function refundAppointmentPayment(appointmentId: number): Promise<{ refund_id: string }> {
  const response = await fetch(`${API_URL}/api/appointments/${appointmentId}/refund`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error issuing refund'));
  }
  return response.json();
}

export async function getAppointmentPayment(appointmentId: number): Promise<PaymentRecord | null> {
  const response = await fetch(`${API_URL}/api/appointments/${appointmentId}/payment`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error loading payment'));
  }
  return response.json();
}

// ==========================================
// STRIPE CONNECT
// ==========================================

export async function createStripeConnectAccount(data: { restaurant_name: string; email: string }): Promise<{ onboarding_url: string }> {
  const response = await fetch(`${API_URL}/api/stripe/connect`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error creating Stripe account'));
  }
  return response.json();
}

export async function getStripeConnectStatus(): Promise<{ connected: boolean; details_submitted: boolean; account_id: string | null }> {
  const response = await fetch(`${API_URL}/api/stripe/connect/status`, {
    credentials: 'include',
    headers: getRestaurantHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Error checking Stripe status'));
  }
  return response.json();
}

export async function toggleMediaActive(mediaId: number, active: boolean): Promise<Media> {
  const response = await fetch(`${API_URL}/api/media/${mediaId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getRestaurantHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error actualitzant media');
  }

  return response.json();
}
