import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { getTables, createAppointment, updateAppointment } from "@/services/api";

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: any;
}

const ReservationDialog = ({ open, onOpenChange, reservation }: ReservationDialogProps) => {
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [numPeople, setNumPeople] = useState("");
  const [reservationDate, setReservationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reservationTime, setReservationTime] = useState("20:00");
  const [selectedTableId, setSelectedTableId] = useState<string>("");

  const { data: tables } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  useEffect(() => {
    if (reservation) {
      setClientName(reservation.client_name || "");
      setPhone(reservation.phone || "");
      setNumPeople(reservation.num_people?.toString() || "");
      setSelectedTableId(reservation.table_id?.toString() || "");
      
      // Parsejar la data
      if (reservation.date) {
        const date = new Date(reservation.date);
        setReservationDate(format(date, "yyyy-MM-dd"));
      }
      
      // Parsejar l'hora
      if (reservation.start_time) {
        const time = new Date(reservation.start_time);
        setReservationTime(format(time, "HH:mm"));
      }
    } else {
      setClientName("");
      setPhone("");
      setNumPeople("");
      setSelectedTableId("");
      setReservationDate(format(new Date(), "yyyy-MM-dd"));
      setReservationTime("20:00");
    }
  }, [reservation, open]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (reservation) {
        return updateAppointment(reservation.id, {
          date: data.date,
          time: data.time,
          num_people: data.num_people
        });
      } else {
        return createAppointment(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(reservation ? "Reserva actualitzada correctament" : "Reserva creada correctament");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientName || !phone || !numPeople) {
      toast.error("Si us plau, completa tots els camps obligatoris");
      return;
    }

    mutation.mutate({
      client_name: clientName,
      phone: phone,
      date: reservationDate,
      time: reservationTime,
      num_people: parseInt(numPeople),
      table_id: selectedTableId ? parseInt(selectedTableId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reservation ? "Editar Reserva" : "Nova Reserva"}</DialogTitle>
          <DialogDescription>
            {reservation ? "Modifica les dades de la reserva" : "Afegeix una nova reserva"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">
                Nom del Client <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Joan García"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Telèfon <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numPeople">
                Nombre de Persones <span className="text-destructive">*</span>
              </Label>
              <Input
                id="numPeople"
                type="number"
                min="1"
                max="8"
                value={numPeople}
                onChange={(e) => setNumPeople(e.target.value)}
                placeholder="4"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservationDate">
                Data <span className="text-destructive">*</span>
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

            {reservation && (
              <div className="space-y-2">
                <Label htmlFor="tableId">
                  Taula {selectedTableId && `(actual: ${reservation.table_number})`}
                </Label>
                <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Deixar automàtic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Automàtic</SelectItem>
                    {tables?.filter(t => t.status === 'available').map((table) => (
                      <SelectItem key={table.id} value={table.id.toString()}>
                        Mesa {table.table_number} ({table.capacity} persones)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardant..." : reservation ? "Guardar Canvis" : "Crear Reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReservationDialog;
