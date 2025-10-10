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
  const [selectedTableId, setSelectedTableId] = useState<string>("auto");

  const { data: tables } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  useEffect(() => {
    console.log("🔍 DEBUG: reservation changed:", reservation);
    
    if (reservation) {
      console.log("📝 Carregant dades de la reserva:", {
        id: reservation.id,
        client_name: reservation.client_name,
        table_id: reservation.table_id,
        table_number: reservation.table_number
      });
      
      setClientName(reservation.client_name || "");
      setPhone(reservation.phone || "");
      setNumPeople(reservation.num_people?.toString() || "");
      // Si té table_id, usar-lo, sinó "auto"
      setSelectedTableId(reservation.table_id ? reservation.table_id.toString() : "auto");
      
      // Parsejar la data
      if (reservation.date) {
        const date = new Date(reservation.date);
        setReservationDate(format(date, "yyyy-MM-dd"));
      }
      
      // Parsejar l'hora
      if (reservation.start_time) {
        try {
          const withoutTz = reservation.start_time.split('+')[0].split('Z')[0];
          const time = new Date(withoutTz);
          setReservationTime(format(time, "HH:mm"));
        } catch (e) {
          console.error("❌ Error parsing time:", e);
          setReservationTime("20:00");
        }
      }
      
      console.log("✅ Valors carregats:", {
        selectedTableId: reservation.table_id ? reservation.table_id.toString() : "auto",
        date: reservationDate,
        time: reservationTime
      });
    } else {
      console.log("🆕 Nova reserva - resetejant camps");
      setClientName("");
      setPhone("");
      setNumPeople("");
      setSelectedTableId("auto");
      setReservationDate(format(new Date(), "yyyy-MM-dd"));
      setReservationTime("20:00");
    }
  }, [reservation, open]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("🚀 Enviant petició:", data);
      
      if (reservation) {
        // Actualitzar reserva existent
        console.log(`📤 PUT /api/appointments/${reservation.id}`, data);
        return updateAppointment(reservation.id, data);
      } else {
        // Crear nova reserva
        console.log("📤 POST /api/appointments", data);
        return createAppointment(data);
      }
    },
    onSuccess: (response) => {
      console.log("✅ Resposta del servidor:", response);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(reservation ? "Reserva actualitzada correctament" : "Reserva creada correctament");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("❌ Error:", error);
      toast.error("Error: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientName || !phone || !numPeople) {
      toast.error("Si us plau, completa tots els camps obligatoris");
      return;
    }

    const dataToSend: any = {
      client_name: clientName,
      phone: phone,
      date: reservationDate,
      time: reservationTime,
      num_people: parseInt(numPeople),
    };

    // Afegir table_id si NO és "auto"
    if (selectedTableId && selectedTableId !== "auto") {
      dataToSend.table_id = parseInt(selectedTableId);
      console.log(`📍 Taula seleccionada: ${selectedTableId}`);
    } else {
      console.log("🔄 Assignació automàtica de taula");
    }

    console.log("📦 Dades finals a enviar:", dataToSend);
    mutation.mutate(dataToSend);
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
                disabled={!!reservation}
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
                disabled={!!reservation}
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

            <div className="space-y-2">
              <Label htmlFor="tableId">
                Taula {reservation && reservation.table_number && `(actual: Mesa ${reservation.table_number})`}
              </Label>
              <Select 
                value={selectedTableId} 
                onValueChange={(value) => {
                  console.log("🎯 Taula seleccionada:", value);
                  setSelectedTableId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assignació automàtica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automàtic</SelectItem>
                  {tables?.filter(t => t.status === 'available').map((table) => (
                    <SelectItem key={table.id} value={table.id.toString()}>
                      Mesa {table.table_number} ({table.capacity} persones)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecciona "Automàtic" per assignació automàtica
              </p>
            </div>
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
