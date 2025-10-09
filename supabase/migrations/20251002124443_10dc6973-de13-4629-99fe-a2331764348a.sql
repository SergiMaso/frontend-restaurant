-- Crear tabla de mesas
CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL UNIQUE,
  capacity integer NOT NULL CHECK (capacity > 0),
  location text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS en mesas
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Política para leer todas las mesas
CREATE POLICY "Anyone can view tables"
  ON public.tables
  FOR SELECT
  USING (true);

-- Política para insertar mesas
CREATE POLICY "Anyone can insert tables"
  ON public.tables
  FOR INSERT
  WITH CHECK (true);

-- Política para actualizar mesas
CREATE POLICY "Anyone can update tables"
  ON public.tables
  FOR UPDATE
  USING (true);

-- Política para eliminar mesas
CREATE POLICY "Anyone can delete tables"
  ON public.tables
  FOR DELETE
  USING (true);

-- Crear tabla de reservas
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.tables(id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  party_size integer NOT NULL CHECK (party_size > 0),
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  duration_minutes integer DEFAULT 120,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no-show')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS en reservas
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Política para leer todas las reservas
CREATE POLICY "Anyone can view reservations"
  ON public.reservations
  FOR SELECT
  USING (true);

-- Política para insertar reservas
CREATE POLICY "Anyone can insert reservations"
  ON public.reservations
  FOR INSERT
  WITH CHECK (true);

-- Política para actualizar reservas
CREATE POLICY "Anyone can update reservations"
  ON public.reservations
  FOR UPDATE
  USING (true);

-- Política para eliminar reservas
CREATE POLICY "Anyone can delete reservations"
  ON public.reservations
  FOR DELETE
  USING (true);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejorar el rendimiento
CREATE INDEX idx_reservations_date ON public.reservations(reservation_date);
CREATE INDEX idx_reservations_table_id ON public.reservations(table_id);
CREATE INDEX idx_reservations_status ON public.reservations(status);