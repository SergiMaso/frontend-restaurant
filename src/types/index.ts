// Common types for the restaurant management system

export interface Table {
  id: string;
  number: number;
  capacity: number;
  position?: { x: number; y: number };
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  visitCount: number;
  lastVisit?: Date;
}

export interface Reservation {
  id: string;
  customerId: string;
  tableId: string;
  date: string;
  time: string;
  duration: number;
  partySize: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  customer?: Customer;
  table?: Table;
}

export interface OpeningHours {
  day: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface Schedule {
  date: string;
  hours: OpeningHours[];
  isException?: boolean;
}