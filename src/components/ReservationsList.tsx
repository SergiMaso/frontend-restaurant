import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Users, Phone, Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import ReservationDialog from "./ReservationDialog";
import { getAppointments, deleteAppointment, type Appointment } from "@/services/api";

interface ReservationsListProps {
  selectedDate: Date;
  onEdit?: (reservation: any) => void;
  onDateChange?: (date: Date) => void;
}

const ReservationsList = ({ selectedDate, onEdit, onDateChange }: ReservationsListProps) => {
  const queryClient = useQueryClient();
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Filtrar reserves per la data seleccionada i només confirmed
  const filteredReservations = reservations?.filter((r) => {
    const reservationDate = new Date(r.date);
    return (
      r.status === 'confirmed' &&
      format(reservationDate, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    );
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Reserva eliminada correctament");
    },
    onError: (error: Error) => {
      toast.error("Error eliminant la reserva: " + error.message);
    },
  });

  const handleEdit = (reservation: any) => {
    if (onEdit) {
      onEdit(reservation);
    } else {
      setEditingReservation(reservation);
      setDialogOpen(true);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Estàs segur que vols eliminar aquesta reserva?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingReservation(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-success/10 text-success border-success/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "completed":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmada";
      case "cancelled":
        return "Cancel·lada";
      case "completed":
        return "Completada";
      default:
        return status;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      // Parsejar com a hora local ignorant timezone (igual que DayCalendar)
      const withoutTz = isoString.split('+')[0].split('Z')[0];
      const date = new Date(withoutTz);
      return date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const goToPreviousDay = () => {
    if (!onDateChange) return;
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    if (!onDateChange) return;
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    if (!onDateChange) return;
    onDateChange(new Date());
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregant reserves...</div>;
  }

  return (
    <>
      {/* Botons de navegació de dates */}
      {onDateChange && (
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goToPreviousDay} size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button variant="outline" onClick={goToToday} size="sm">
              Hoy
            </Button>
            <Button variant="outline" onClick={goToNextDay} size="sm">
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(selectedDate, "d 'de' MMMM 'de' yyyy")}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredReservations?.map((reservation) => (
          <div
            key={reservation.id}
            className="p-4 rounded-lg border border-border bg-card hover:shadow-elegant transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1">
                <h3 className="font-bold text-lg">{reservation.client_name}</h3>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(reservation.start_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {reservation.num_people} persones
                  </span>
                </div>
              </div>
              <Badge className={getStatusColor(reservation.status)}>
                {getStatusLabel(reservation.status)}
              </Badge>
            </div>

            <div className="space-y-2 mb-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3 w-3" />
                {reservation.phone}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Mesa {reservation.table_number}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Capacidad: {reservation.table_capacity}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(reservation)}
                className="flex-1"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(reservation.id)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredReservations?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay reservas para esta fecha</p>
          <p className="text-sm">Añade una nueva reserva para empezar</p>
        </div>
      )}

      {!onEdit && (
        <ReservationDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          reservation={editingReservation}
        />
      )}
    </>
  );
};

export default ReservationsList;
