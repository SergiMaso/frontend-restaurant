import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface TableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: any;
}

const TableDialog = ({ open, onOpenChange, table }: TableDialogProps) => {
  const queryClient = useQueryClient();
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (table) {
      setTableNumber(table.table_number || "");
      setCapacity(table.capacity?.toString() || "");
      setLocation(table.location || "");
    } else {
      setTableNumber("");
      setCapacity("");
      setLocation("");
    }
  }, [table]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (table) {
        const { error } = await supabase
          .from("tables")
          .update(data)
          .eq("id", table.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tables").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success(table ? "Mesa actualizada correctamente" : "Mesa creada correctamente");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tableNumber || !capacity) {
      toast.error("Por favor completa todos los campos obligatorios");
      return;
    }

    mutation.mutate({
      table_number: tableNumber,
      capacity: parseInt(capacity),
      location: location || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{table ? "Editar Mesa" : "Nueva Mesa"}</DialogTitle>
          <DialogDescription>
            {table ? "Modifica los datos de la mesa" : "Añade una nueva mesa al restaurante"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tableNumber">
              Número de Mesa <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tableNumber"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="ej: 1, A1, Terraza-5"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">
              Capacidad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Número de personas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ej: Interior, Terraza, Salón principal"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando..." : table ? "Guardar Cambios" : "Crear Mesa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TableDialog;
