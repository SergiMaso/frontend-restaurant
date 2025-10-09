import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTables, getAppointments } from "@/services/api";

interface DayCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

// Horaris de 12:00 a 24:00 (cada 15 minuts)
const timeSlots = Array.from({ length: 49 }, (_, i) => {
  const totalMinutes = 12 * 60 + i * 15; // Començar a les 12:00
  const hour = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  // Per l'última ranura, mostrar 24:00
  if (hour === 24 && minutes === 0) {
    return "24:00";
  }
  
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
});

const DayCalendar = ({ selectedDate, onDateChange }: DayCalendarProps) => {
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Filtrar reserves per la data seleccionada i només confirmed
  const reservations = allAppointments?.filter((r) => {
    if (r.status !== 'confirmed') return false;
    
    // Parsejar la data de la reserva correctament
    try {
      const reservationDate = parseISO(r.date);
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      const reservationDateStr = format(reservationDate, "yyyy-MM-dd");
      
      return reservationDateStr === selectedDateStr;
    } catch (e) {
      console.error("Error parsing date:", r.date, e);
      return false;
    }
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

  const getStatusColor = (status: string, hasNotes: boolean = false) => {
    // Si té notes, mostrar en blau
    if (hasNotes) {
      return "bg-blue-500/90 hover:bg-blue-600 border-blue-400/20 text-white";
    }
    
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

  // Arrodonir hora al slot més proper de 15 minuts
  const roundToNearestSlot = (minutes: number): number => {
    // Arrodonir al múltiple de 15 més proper
    return Math.round(minutes / 15) * 15;
  };

  const getReservationsForTableAndTime = (tableNumber: number, time: string) => {
    return reservations?.filter((r) => {
      if (r.table_number !== tableNumber) return false;
      
      try {
        const startTime = parseISO(r.start_time);
        const endTime = parseISO(r.end_time);
        
        const [slotHour, slotMin] = time.split(':').map(Number);
        
        const slotMinutes = slotHour * 60 + slotMin;
        const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
        const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
        
        // Arrodonir l'hora d'inici al slot més proper
        const roundedStartMinutes = roundToNearestSlot(startMinutes);
        
        return slotMinutes >= roundedStartMinutes && slotMinutes < endMinutes;
      } catch (e) {
        console.error("Error parsing time:", r.start_time, r.end_time, e);
        return false;
      }
    }) || [];
  };

  const isReservationStart = (reservation: any, time: string) => {
    try {
      const startTime = parseISO(reservation.start_time);
      const [slotHour, slotMin] = time.split(':').map(Number);
      const slotMinutes = slotHour * 60 + slotMin;
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      
      // Arrodonir l'hora d'inici al slot més proper de 15 minuts
      const roundedStartMinutes = roundToNearestSlot(startMinutes);
      
      // La reserva comença en aquest slot si coincideix amb el slot arrodonit
      return roundedStartMinutes === slotMinutes;
    } catch (e) {
      console.error("Error checking reservation start:", reservation.start_time, e);
      return false;
    }
  };

  const getReservationRowSpan = (reservation: any) => {
    try {
      const start = parseISO(reservation.start_time);
      const end = parseISO(reservation.end_time);
      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
      // Ara cada slot és de 15 minuts
      const durationSlots = Math.ceil(durationMinutes / 15);
      return durationSlots;
    } catch (e) {
      console.error("Error calculating rowspan:", reservation.start_time, reservation.end_time, e);
      return 4; // Default 1 hora (4 slots de 15 min)
    }
  };

  // Calcular l'hora actual per mostrar la línia vermella
  const getCurrentTimePosition = () => {
    const now = new Date();
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    const todayStr = format(now, "yyyy-MM-dd");
    
    // Només mostrar la línia si estem veient el dia d'avui
    if (selectedDateStr !== todayStr) return null;
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Si estem fora de l'horari (abans de les 12 o després de les 24)
    if (currentHour < 12 || currentHour >= 24) return null;
    
    const slotIndex = (currentHour - 12) * 4 + Math.floor(currentMinute / 15);
    const minuteOffset = (currentMinute % 15) / 15;
    
    return slotIndex + minuteOffset;
  };
  
  const currentTimePosition = getCurrentTimePosition();

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
          <div className="overflow-x-auto relative">
            <div className="inline-block min-w-full">
              {/* Header amb les taules - MÉS ESTRET */}
              <div className="flex border-b border-border/50 bg-muted/50 sticky top-0 z-20">
                <div className="w-12 px-1 py-1.5 text-[10px] font-semibold border-r border-border/50 flex-shrink-0">
                  Hora
                </div>
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className="min-w-[60px] px-1 py-1.5 text-[10px] font-semibold text-center border-r border-border/50 flex-shrink-0"
                  >
                    <div>T{table.table_number}</div>
                    <div className="text-[9px] text-muted-foreground font-normal">
                      {table.capacity}p
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid d'horaris - FILES MÉS BAIXES (ara cada 15 min) */}
              <div className="divide-y divide-border/50 relative">
                {timeSlots.map((time, index) => (
                  <div key={time} className="flex min-h-[20px] relative">
                    {/* Línia vermella de l'hora actual */}
                    {currentTimePosition !== null && index === Math.floor(currentTimePosition) && (
                      <div 
                        className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none"
                        style={{ 
                          top: `${(currentTimePosition - Math.floor(currentTimePosition)) * 20}px`
                        }}
                      />
                    )}
                    
                    <div className="w-12 px-1 py-0.5 text-[9px] font-medium border-r border-border/50 flex-shrink-0 bg-muted/30 flex items-center">
                      {time}
                    </div>
                    {tables.map((table) => {
                      const tableReservations = getReservationsForTableAndTime(table.table_number, time);
                      const reservation = tableReservations[0];
                      const isStart = reservation && isReservationStart(reservation, time);
                      
                      return (
                        <div
                          key={table.id}
                          className="min-w-[60px] border-r border-border/50 flex-shrink-0 relative"
                        >
                          {isStart && (
                            <div
                              className={`absolute inset-0 m-0.5 px-1 py-0.5 rounded text-[9px] cursor-pointer transition-all z-10 flex flex-col justify-center ${getStatusColor(
                                reservation.status,
                                !!reservation.notes
                              )}`}
                              style={{
                                height: `calc(${getReservationRowSpan(reservation)} * 20px - 4px)`,
                              }}
                              onClick={() => {
                                setSelectedReservation(reservation);
                                setDialogOpen(true);
                              }}
                              title="Click per veure detalls"
                            >
                              <div className="font-semibold truncate text-[9px] leading-tight">
                                {reservation.client_name}
                              </div>
                              <div className="text-[8px] opacity-90">
                                {reservation.num_people}p
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
      
      {/* Dialog amb detalls de la reserva */}
      {selectedReservation && (
        <div 
          className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 ${
            dialogOpen ? 'block' : 'hidden'
          }`}
          onClick={() => setDialogOpen(false)}
        >
          <div 
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">Detalls de la Reserva</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">👤 Nom:</span> {selectedReservation.client_name}
              </div>
              <div>
                <span className="font-semibold">📞 Telèfon:</span> {selectedReservation.phone}
              </div>
              <div>
                <span className="font-semibold">👥 Persones:</span> {selectedReservation.num_people}
              </div>
              <div>
                <span className="font-semibold">📅 Data:</span> {format(parseISO(selectedReservation.date), "d 'de' MMMM 'de' yyyy")}
              </div>
              <div>
                <span className="font-semibold">🕐 Hora:</span> {format(parseISO(selectedReservation.start_time), "HH:mm")}
              </div>
              <div>
                <span className="font-semibold">🪑 Taula:</span> {selectedReservation.table_number} (capacitat {selectedReservation.table_capacity})
              </div>
              {selectedReservation.notes && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <span className="font-semibold">📝 Notes:</span>
                  <p className="mt-1">{selectedReservation.notes}</p>
                </div>
              )}
            </div>
            <button
              className="mt-6 w-full bg-primary text-primary-foreground py-2 rounded hover:bg-primary/90 transition-colors"
              onClick={() => setDialogOpen(false)}
            >
              Tancar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayCalendar;
