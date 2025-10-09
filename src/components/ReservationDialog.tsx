import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: any;
}

const ReservationDialog = ({ open, onOpenChange, reservation }: ReservationDialogProps) => {
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [partySize, setPartySize] = useState("");
  const [reservationDate, setReservationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reservationTime, setReservationTime] = useState("20:00");
  const [tableId, setTableId] = useState("");
  const [status, setStatus] = useState("confirmed");
  const [notes, setNotes] = useState("");

  const { data: tables } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .order("table_number");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (reservation) {
      setCustomerName(reservation.customer_name || "");
      setCustomerPhone(reservation.customer_phone || "");
      setCustomerEmail(reservation.customer_email || "");
      setPartySize(reservation.party_size?.toString() || "");
      setReservationDate(reservation.reservation_date || format(new Date(), "yyyy-MM-dd"));
      setReservationTime(reservation.reservation_time?.substring(0, 5) || "20:00");
      setTableId(reservation.table_id || "");
      setStatus(reservation.status || "confirmed");
      setNotes(reservation.notes || "");
    } else {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setPartySize("");
      setReservationDate(format(new Date(), "yyyy-MM-dd"));
      setReservationTime("20:00");
      setTableId("");
      setStatus("confirmed");
      setNotes("");
    }
  }, [reservation]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (reservation) {
        const { error } = await supabase
          .from("reservations")
          .update(data)
          .eq("id", reservation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reservations").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(reservation ? "Reserva actualizada correctamente" : "Reserva creada correctamente");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone || !partySize || !tableId) {
      toast.error("Por favor completa todos los campos obligatorios");
      return;
    }

    mutation.mutate({
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      party_size: parseInt(partySize),
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      table_id: tableId,
      status,
      notes: notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reservation ? "Editar Reserva" : "Nueva Reserva"}</DialogTitle>
          <DialogDescription>
            {reservation ? "Modifica los datos de la reserva" : "Añade una nueva reserva"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">
                Nombre del Cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Juan Pérez"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone">
                Teléfono <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerPhone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+34 600 000 000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partySize">
                Número de Personas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="partySize"
                type="number"
                min="1"
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                placeholder="4"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservationDate">
                Fecha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reservationDate"
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservationTime">
                Hora <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reservationTime"
                type="time"
                value={reservationTime}
                onChange={(e) => setReservationTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tableId">
                Mesa <span className="text-destructive">*</span>
              </Label>
              <Select value={tableId} onValueChange={setTableId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una mesa" />
                </SelectTrigger>
                <SelectContent>
                  {tables?.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      Mesa {table.table_number} - {table.capacity} personas
                      {table.location && ` (${table.location})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alergias, preferencias de mesa, etc."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando..." : reservation ? "Guardar Cambios" : "Crear Reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReservationDialog;
