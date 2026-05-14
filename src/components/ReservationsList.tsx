import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Users, Phone, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import ReservationDialog from "./ReservationDialog";
import DeleteReservationDialog from "./DeleteReservationDialog";
import { deleteAppointment, type Appointment } from "@/services/api";
import { getAppointmentsQueryKey, useAppointmentsQuery } from "@/hooks/useAppointmentsQuery";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";

interface ReservationsListProps {
  selectedDate: Date;
  onEdit?: (reservation: any) => void;
}

const ReservationsList = ({ selectedDate, onEdit }: ReservationsListProps) => {
  const queryClient = useQueryClient();
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReservation, setDeletingReservation] = useState<Appointment | null>(null);
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { paymentEnabled } = useRestaurantConfig();
  const { selectedRestaurant } = useRestaurant();
  const appointmentsKey = getAppointmentsQueryKey(selectedRestaurant?.id);

  const { data: reservations, isLoading } = useAppointmentsQuery({
    refetchInterval: 300000,
  });

  // Filtrar reserves per la data seleccionada i només confirmed
  const filteredReservations = reservations?.filter((r) => {
    const reservationDate = new Date(r.date);
    return (
      (r.status === 'confirmed' || r.status === 'pending_payment') &&
      format(reservationDate, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    );
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, refund }: { id: number; refund: boolean }) =>
      deleteAppointment(id, refund),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKey });
      toast.success(t("reservations.deleteSuccess"));
      setDeleteDialogOpen(false);
      setDeletingReservation(null);
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

  const handleDelete = (reservation: Appointment) => {
    if (!paymentEnabled) {
      // Payments off — original simple confirm flow
      if (confirm(t("reservations.confirmDelete"))) {
        deleteMutation.mutate({ id: reservation.id, refund: false });
      }
      return;
    }
    setDeletingReservation(reservation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = (refund: boolean) => {
    if (deletingReservation) {
      deleteMutation.mutate({ id: deletingReservation.id, refund });
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
              <div className="flex flex-col items-end gap-1">
                <Badge className={getStatusColor(reservation.status)}>
                  {getStatusLabel(reservation.status)}
                </Badge>
                {paymentEnabled && reservation.status === 'pending_payment' && (
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                    💳 {tCommon("reservationStatus.pending_payment")}
                  </Badge>
                )}
              </div>
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
                onClick={() => handleDelete(reservation)}
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

      <DeleteReservationDialog
        open={deleteDialogOpen}
        appointmentId={deletingReservation?.id ?? null}
        appointmentName={deletingReservation?.client_name}
        appointmentDate={deletingReservation?.date}
        appointmentTime={deletingReservation?.start_time}
        paymentEnabled={paymentEnabled}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDeletingReservation(null);
        }}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
};

export default ReservationsList;
