-- Add position fields to tables for visual layout
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS position_x integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS position_y integer DEFAULT 100;