import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Users, Phone, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import ReservationDialog from "./ReservationDialog";
import { getAppointments, deleteAppointment, type Appointment } from "@/services/api";

interface ReservationsListProps {
  selectedDate: Date;
  onEdit?: (reservation: any) => void;
}

const ReservationsList = ({ selectedDate, onEdit }: ReservationsListProps) => {
  const queryClient = useQueryClient();
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
    refetchInterval: 120000, // Auto-refresh every 2 minutes
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
      toast.success(t("reservations.deleteSuccess"));
    },
    onError: (error: Error) => {
      toast.error(t("reservations.deleteError") + ": " + error.message);
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
    if (confirm(t("reservations.confirmDelete"))) {
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
    return tCommon(`reservationStatus.${status}`) || status;
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

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">{tCommon("loading")}</div>;
  }

  return (
    <>
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
                    {reservation.num_people} {t("tables.people")}
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
              <div className="flex items-center gap-2 flex-wrap">
                {reservation.table_ids && reservation.table_ids.length > 1 ? (
                  <>
                    <Badge className={reservation.notes ? "bg-green-500 text-white hover:bg-green-600" : "bg-yellow-500 text-white hover:bg-yellow-600"}>
                      📍 {t("reservations.tables")} {reservation.table_numbers || reservation.table_ids.join('+')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {reservation.table_ids.length} {t("reservations.tables").toLowerCase()} · {t("reservations.tableCapacity")}: {reservation.table_capacity}
                    </span>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">
                      {t("reservations.table")} {reservation.table_numbers || reservation.table_number || 'N/A'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t("reservations.tableCapacity")}: {reservation.table_capacity}
                    </span>
                  </>
                )}
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
                {tCommon("edit")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(reservation.id)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {tCommon("delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredReservations?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t("calendar.noReservations")}</p>
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
