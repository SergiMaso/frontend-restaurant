import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTables, getAppointments } from "@/services/api";

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
    queryFn: getTables,
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Filtrar reserves per la data seleccionada
  const reservations = allAppointments?.filter((r) => {
    const reservationDate = new Date(r.date);
    return format(reservationDate, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
  });

  const isLoading = tablesLoading || appointmentsLoading;

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
      default:
        return "bg-muted hover:bg-muted/80 border-border text-foreground";
    }
  };

  const getReservationsForTableAndTime = (tableNumber: number, time: string) => {
    return reservations?.filter((r) => {
      if (r.table_number !== tableNumber) return false;
      
      const startTime = new Date(r.start_time);
      const endTime = new Date(r.end_time);
      
      const startHourMin = format(startTime, "HH:mm");
      const [slotHour, slotMin] = time.split(':').map(Number);
      
      const slotMinutes = slotHour * 60 + slotMin;
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
      
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    }) || [];
  };

  const isReservationStart = (reservation: any, time: string) => {
    const startTime = new Date(reservation.start_time);
    const formattedTime = format(startTime, "HH:mm");
    return formattedTime === time;
  };

  const getReservationRowSpan = (reservation: any) => {
    const start = new Date(reservation.start_time);
    const end = new Date(reservation.end_time);
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    const durationSlots = Math.ceil(durationMinutes / 30);
    return durationSlots;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={goToPreviousDay} size="sm">
            ← Anterior
          </Button>
          <Button variant="outline" onClick={goToToday} size="sm">
            Avui
          </Button>
          <Button variant="outline" onClick={goToNextDay} size="sm">
            Següent →
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy")}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregant...</div>
      ) : !tables || tables.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No hi ha taules configurades. Afegeix taules primer.
        </div>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header amb les taules */}
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

              {/* Grid d'horaris */}
              <div className="divide-y divide-border/50">
                {timeSlots.map((time) => (
                  <div key={time} className="flex min-h-[50px]">
                    <div className="w-20 px-3 py-2 text-xs font-medium border-r border-border/50 flex-shrink-0 bg-muted/30">
                      {time}
                    </div>
                    {tables.map((table) => {
                      const tableReservations = getReservationsForTableAndTime(table.table_number, time);
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
                                {reservation.client_name}
                              </div>
                              <div className="text-[10px] opacity-90 truncate">
                                {reservation.phone}
                              </div>
                              <div className="text-[10px] opacity-80 mt-1">
                                {reservation.num_people} pax
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
