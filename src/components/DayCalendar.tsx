import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DayCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const timeSlots = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 12;
  const minutes = (i % 2) * 30;
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
});

const DayCalendar = ({ selectedDate, onDateChange }: DayCalendarProps) => {
  const { data: tables, isLoading: tablesLoading } = useQuery({
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

  const { data: reservations, isLoading: reservationsLoading } = useQuery({
    queryKey: ["reservations", format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("reservation_date", format(selectedDate, "yyyy-MM-dd"))
        .order("reservation_time");

      if (error) throw error;
      return data;
    },
  });

  const isLoading = tablesLoading || reservationsLoading;

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-primary/90 hover:bg-primary border-primary/20 text-primary-foreground";
      case "cancelled":
        return "bg-destructive/90 hover:bg-destructive border-destructive/20 text-destructive-foreground";
      case "completed":
        return "bg-muted hover:bg-muted/80 border-border text-foreground";
      case "no-show":
        return "bg-accent/90 hover:bg-accent border-accent/20 text-accent-foreground";
      default:
        return "bg-muted hover:bg-muted/80 border-border text-foreground";
    }
  };

  const getReservationsForTableAndTime = (tableId: string, time: string) => {
    return reservations?.filter((r) => {
      if (r.table_id !== tableId) return false;
      
      const startTime = r.reservation_time.substring(0, 5);
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [slotHour, slotMin] = time.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const slotMinutes = slotHour * 60 + slotMin;
      const endMinutes = startMinutes + (r.duration_minutes || 120);
      
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    }) || [];
  };

  const isReservationStart = (reservation: any, time: string) => {
    return reservation.reservation_time.substring(0, 5) === time;
  };

  const getReservationRowSpan = (reservation: any) => {
    const durationSlots = Math.ceil((reservation.duration_minutes || 120) / 30);
    return durationSlots;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmada";
      case "cancelled":
        return "Cancelada";
      case "completed":
        return "Completada";
      case "no-show":
        return "No Show";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={goToPreviousDay} size="sm">
            ← Anterior
          </Button>
          <Button variant="outline" onClick={goToToday} size="sm">
            Hoy
          </Button>
          <Button variant="outline" onClick={goToNextDay} size="sm">
            Siguiente →
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy")}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : !tables || tables.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No hay mesas configuradas. Añade mesas primero.
        </div>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header con las mesas */}
              <div className="flex border-b border-border/50 bg-muted/50 sticky top-0 z-10">
                <div className="w-20 px-3 py-3 text-sm font-semibold border-r border-border/50 flex-shrink-0">
                  Hora
                </div>
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className="min-w-[140px] px-3 py-3 text-sm font-semibold text-center border-r border-border/50 flex-shrink-0"
                  >
                    <div>Mesa {table.table_number}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {table.capacity} pax
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid de horarios */}
              <div className="divide-y divide-border/50">
                {timeSlots.map((time) => (
                  <div key={time} className="flex min-h-[50px]">
                    <div className="w-20 px-3 py-2 text-xs font-medium border-r border-border/50 flex-shrink-0 bg-muted/30">
                      {time}
                    </div>
                    {tables.map((table) => {
                      const tableReservations = getReservationsForTableAndTime(table.id, time);
                      const reservation = tableReservations[0];
                      const isStart = reservation && isReservationStart(reservation, time);
                      
                      return (
                        <div
                          key={table.id}
                          className="min-w-[140px] border-r border-border/50 flex-shrink-0 relative"
                        >
                          {isStart && (
                            <div
                              className={`absolute inset-0 m-1 p-2 rounded-md border text-xs cursor-pointer transition-all z-10 ${getStatusColor(
                                reservation.status
                              )}`}
                              style={{
                                height: `calc(${getReservationRowSpan(reservation)} * 50px - 8px)`,
                              }}
                            >
                              <div className="font-semibold truncate">
                                {reservation.customer_name}
                              </div>
                              <div className="text-[10px] opacity-90 truncate">
                                {reservation.customer_phone}
                              </div>
                              <div className="text-[10px] opacity-80 mt-1">
                                {reservation.party_size} pax • {reservation.duration_minutes}min
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayCalendar;
