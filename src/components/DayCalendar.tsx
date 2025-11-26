import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Pencil, User, UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTables, getAppointments, markAppointmentSeated, markAppointmentLeft, markAppointmentNoShow } from "@/services/api";
import { toast } from "sonner";

interface DayCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onEdit?: (reservation: any) => void;
}

// Horaris de 12:00 a 24:00 (cada 15 minuts)
const timeSlots = Array.from({ length: 49 }, (_, i) => {
  const totalMinutes = 12 * 60 + i * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hour === 24 && minutes === 0) {
    return "24:00";
  }
  
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
});

// Funció per parsejar timestamp ignorant timezone (tractar com a hora local)
const parseAsLocalTime = (timestamp: string): Date => {
  const withoutTz = timestamp.split('+')[0].split('Z')[0];
  return new Date(withoutTz);
};

const DayCalendar = ({ selectedDate, onDateChange, onEdit }: DayCalendarProps) => {
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Mutations per tracking
  const seatedMutation = useMutation({
    mutationFn: markAppointmentSeated,
    onSuccess: async (data) => {
      // Refrescar les dades del servidor
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      
      const delayMsg = data.delay_minutes 
        ? ` (Retraso: ${data.delay_minutes > 0 ? '+' : ''}${data.delay_minutes} min)`
        : '';
      toast.success(`✅ Cliente sentado!${delayMsg}`);
      
      // Esperar una mica i reobrir amb dades fresques
      setTimeout(async () => {
        const appointments = await queryClient.fetchQuery({ queryKey: ["appointments"] });
        const updated = appointments.find((apt: any) => apt.id === selectedReservation?.id);
        if (updated) {
          setSelectedReservation(updated);
        }
      }, 500);
    },
    onError: () => {
      toast.error("❌ Error marcando como sentado");
    },
  });

  const leftMutation = useMutation({
    mutationFn: markAppointmentLeft,
    onSuccess: async (data) => {
      // Refrescar les dades del servidor
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      
      toast.success(`👋 Cliente marchó! Duración: ${data.duration_minutes} min`);
      
      // Esperar una mica i reobrir amb dades fresques
      setTimeout(async () => {
        const appointments = await queryClient.fetchQuery({ queryKey: ["appointments"] });
        const updated = appointments.find((apt: any) => apt.id === selectedReservation?.id);
        if (updated) {
          setSelectedReservation(updated);
        }
      }, 500);
    },
    onError: () => {
      toast.error("❌ Error marcando salida");
    },
  });

  const noShowMutation = useMutation({
    mutationFn: markAppointmentNoShow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("❌ No-show registrado");
      setDetailsDialogOpen(false);
    },
    onError: () => {
      toast.error("❌ Error registrando no-show");
    },
  });

  const handleSeated = () => {
    if (selectedReservation) {
      seatedMutation.mutate(selectedReservation.id);
    }
  };

  const handleLeft = () => {
    if (selectedReservation) {
      leftMutation.mutate(selectedReservation.id);
    }
  };

  const handleNoShow = () => {
    if (selectedReservation && window.confirm("¿Estás seguro de que quieres marcar esta reserva como no-show?")) {
      noShowMutation.mutate(selectedReservation.id);
    }
  };

  // Filtrar reserves per la data seleccionada i només confirmed o completed
  const reservations = allAppointments?.filter((r) => {
    if (r.status !== 'confirmed' && r.status !== 'completed') return false;
    
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

  const handleReservationClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setDetailsDialogOpen(true);
  };

  const handleEdit = () => {
    setDetailsDialogOpen(false);
    if (onEdit && selectedReservation) {
      onEdit(selectedReservation);
    }
  };

  const getStatusColor = (status: string, hasNotes: boolean = false) => {
    // Si està completat (ha marxat), color verd
    if (status === "completed") {
      return "bg-green-500/90 hover:bg-green-600 border-green-400/20 text-white";
    }
    
    // Si té notes, color blau
    if (hasNotes) {
      return "bg-blue-500/90 hover:bg-blue-600 border-blue-400/20 text-white";
    }
    
    switch (status) {
      case "confirmed":
        return "bg-primary/90 hover:bg-primary border-primary/20 text-primary-foreground";
      case "cancelled":
        return "bg-destructive/90 hover:bg-destructive border-destructive/20 text-destructive-foreground";
      default:
        return "bg-muted hover:bg-muted/80 border-border text-foreground";
    }
  };

  const roundToNearestSlot = (minutes: number): number => {
    return Math.round(minutes / 15) * 15;
  };

  const getReservationsForTableAndTime = (tableId: number, time: string) => {
    const result = reservations?.filter((r) => {
      // Comprovar si aquesta taula està dins de table_ids
      if (!r.table_ids || !Array.isArray(r.table_ids)) return false;
      if (!r.table_ids.includes(tableId)) return false;

      try {
        const startTime = parseAsLocalTime(r.start_time);
        const endTime = parseAsLocalTime(r.end_time);

        const [slotHour, slotMin] = time.split(':').map(Number);

        const slotMinutes = slotHour * 60 + slotMin;
        let startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
        let endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        const roundedStartMinutes = roundToNearestSlot(startMinutes);

        const matches = slotMinutes >= roundedStartMinutes && slotMinutes < endMinutes;

        return matches;
      } catch (e) {
        console.error("Error parsing time:", r.start_time, r.end_time, e);
        return false;
      }
    }) || [];

    return result;
  };

  const isReservationStart = (reservation: any, time: string) => {
    try {
      const startTime = parseAsLocalTime(reservation.start_time);
      const [slotHour, slotMin] = time.split(':').map(Number);
      const slotMinutes = slotHour * 60 + slotMin;
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      
      const roundedStartMinutes = roundToNearestSlot(startMinutes);
      
      return roundedStartMinutes === slotMinutes;
    } catch (e) {
      console.error("Error checking reservation start:", reservation.start_time, e);
      return false;
    }
  };

  const getReservationRowSpan = (reservation: any) => {
    try {
      const start = parseAsLocalTime(reservation.start_time);
      const end = parseAsLocalTime(reservation.end_time);
      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
      const durationSlots = Math.ceil(durationMinutes / 15);
      return durationSlots;
    } catch (e) {
      console.error("Error calculating rowspan:", reservation.start_time, reservation.end_time, e);
      return 4;
    }
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    const todayStr = format(now, "yyyy-MM-dd");
    
    if (selectedDateStr !== todayStr) return null;
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
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
            Hoy
          </Button>
          <Button variant="outline" onClick={goToNextDay} size="sm">
            Siguiente →
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregant...</div>
      ) : !tables || tables.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No hay mesas configuradas. Añade mesas primero.
        </div>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto relative">
            <div className="inline-block min-w-full">
              <div className="flex border-b border-border/50 bg-muted/50 sticky top-0 z-20">
                <div className="w-12 px-1 py-1.5 text-[10px] font-semibold border-r border-border/50 flex-shrink-0">
                  Hora
                </div>
                {tables.map((table) => {
                  const numTables = tables.length;
                  // Si hi ha menys de 15 taules, usar flex-1 per repartir espai
                  // Si n'hi ha més, usar min-w fixe per permetre scroll
                  const flexClass = numTables <= 15 ? 'flex-1' : '';
                  const minWidth = numTables > 15 ? 'min-w-[80px]' : 'min-w-[60px]';

                  return (
                    <div
                      key={table.id}
                      className={`${flexClass} ${minWidth} px-1 py-1.5 text-[10px] font-semibold text-center border-r border-border/50 flex-shrink-0`}
                    >
                      <div>T{table.table_number}</div>
                      <div className="text-[9px] text-muted-foreground font-normal">
                        {table.capacity}p
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="divide-y divide-border/50 relative">
                {timeSlots.map((time, index) => (
                  <div key={time} className="flex min-h-[20px] relative">
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
                      const tableReservations = getReservationsForTableAndTime(table.id, time);
                      const reservation = tableReservations[0];
                      const isStart = reservation && isReservationStart(reservation, time);

                      // Mateix sistema que al header
                      const numTables = tables.length;
                      const flexClass = numTables <= 15 ? 'flex-1' : '';
                      const minWidth = numTables > 15 ? 'min-w-[80px]' : 'min-w-[60px]';

                      // Detectar si és una reserva amb múltiples taules i si té observacions
                      const isMultiTable = reservation && reservation.table_ids && reservation.table_ids.length > 1;
                      const hasNotes = !!reservation?.notes;

                      let colorClass;
                      if (isMultiTable) {
                        // Múltiples taules
                        colorClass = hasNotes
                          ? 'bg-green-500/90 hover:bg-green-600 border-green-400/20 text-white'  // Verd: múltiples taules amb notes
                          : 'bg-yellow-500/90 hover:bg-yellow-600 border-yellow-400/20 text-white';  // Groc: múltiples taules sense notes
                      } else {
                        // Una sola taula: taronja (sense notes) o blau (amb notes)
                        colorClass = getStatusColor(reservation?.status, hasNotes);
                      }

                      return (
                        <div
                          key={table.id}
                          className={`${flexClass} ${minWidth} border-r border-border/50 flex-shrink-0 relative`}
                        >
                          {isStart && (
                            <div
                              className={`absolute inset-0 m-0.5 px-1 py-0.5 rounded text-[9px] cursor-pointer transition-all z-10 flex flex-col justify-center ${colorClass}`}
                              style={{
                                height: `calc(${getReservationRowSpan(reservation)} * 20px - 4px)`,
                              }}
                              onClick={() => handleReservationClick(reservation)}
                              title="Click para ver detalles"
                            >
                              <div className="font-semibold truncate text-[9px] leading-tight">
                                {reservation.client_name}
                              </div>
                              <div className="text-[8px] opacity-90">
                                {reservation.num_people}p
                                {isMultiTable && (
                                  <span className="ml-1">📍{reservation.table_ids.length}T</span>
                                )}
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

      {/* Diàleg de detalls de la reserva */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalles de la Reserva</DialogTitle>
          </DialogHeader>
          
          {selectedReservation && (
            <div className="space-y-4">
              {/* Badges d'estat */}
              <div className="flex gap-2 flex-wrap">
                {selectedReservation.status === 'completed' && (
                  <Badge className="bg-green-500 text-white border-green-400">
                    ✅ Finalizado
                  </Badge>
                )}
                {selectedReservation.seated_at && (
                  <Badge variant="success" className="bg-green-100 text-green-700 border-green-300">
                    🪑 Sentado: {format(parseAsLocalTime(selectedReservation.seated_at), "HH:mm")}
                    {selectedReservation.delay_minutes && (
                      <span className="ml-1">
                        ({selectedReservation.delay_minutes > 0 ? '+' : ''}{selectedReservation.delay_minutes} min)
                      </span>
                    )}
                  </Badge>
                )}
                {selectedReservation.left_at && (
                  <Badge variant="secondary">
                    👋 Salió: {format(parseAsLocalTime(selectedReservation.left_at), "HH:mm")} 
                    ({selectedReservation.duration_minutes} min)
                  </Badge>
                )}
                {selectedReservation.no_show && (
                  <Badge variant="destructive">
                    ❌ No-show
                  </Badge>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">👤 Nombre:</span>
                  <span>{selectedReservation.client_name}</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">📞 Teléfono:</span>
                  <span>{selectedReservation.phone}</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">👥 Personas:</span>
                  <span>{selectedReservation.num_people}</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">📅 Fecha:</span>
                  <span>{format(parseISO(selectedReservation.date), "d 'de' MMMM 'de' yyyy")}</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">🕐 Hora:</span>
                  <span>{format(parseAsLocalTime(selectedReservation.start_time), "HH:mm")}</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">🪑 Mesa{selectedReservation.table_ids && selectedReservation.table_ids.length > 1 ? 's' : ''}:</span>
                  <span>
                    {selectedReservation.table_numbers ? `Mesa ${selectedReservation.table_numbers}` : 'N/A'}
                    {selectedReservation.table_capacity > 0 && ` (capacitat ${selectedReservation.table_capacity})`}
                  </span>
                </div>
                
                {selectedReservation.notes && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">📝 Notas:</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{selectedReservation.notes}</p>
                  </div>
                )}
              </div>
              
              {/* Botons de tracking */}
              {!selectedReservation.no_show && selectedReservation.status !== 'completed' && (
                <div className="flex gap-2 flex-wrap pt-2 border-t">
                  {!selectedReservation.seated_at && (
                    <Button 
                      onClick={handleSeated} 
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Sentado
                    </Button>
                  )}
                  
                  {selectedReservation.seated_at && !selectedReservation.left_at && (
                    <Button 
                      onClick={handleLeft} 
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Ha salido
                    </Button>
                  )}
                  
                  {!selectedReservation.seated_at && (
                    <Button 
                      onClick={handleNoShow} 
                      size="sm" 
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      No show
                    </Button>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                  Tancar
                </Button>
                <Button onClick={handleEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DayCalendar;
