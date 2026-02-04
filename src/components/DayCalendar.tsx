import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Pencil, User, UserCheck, XCircle } from "lucide-react";
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
  isFullscreen?: boolean;
  onSlotClick?: (time: string, tableId: number) => void;
}

const timeSlots = Array.from({ length: 49 }, (_, i) => {
  const totalMinutes = 12 * 60 + i * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hour === 24 && minutes === 0) {
    return "24:00";
  }

  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
});

const parseAsLocalTime = (timestamp: string): Date => {
  const withoutTz = timestamp.split('+')[0].split('Z')[0];
  return new Date(withoutTz);
};

const DayCalendar = ({ selectedDate, onDateChange, onEdit, isFullscreen = false, onSlotClick }: DayCalendarProps) => {
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const queryClient = useQueryClient();
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();

  // Drag-to-scroll functionality
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only start drag if not clicking on a reservation or other interactive element
      const target = e.target as HTMLElement;
      if (target.closest('.cursor-pointer') || target.closest('button')) return;

      setIsDragging(true);
      setStartY(e.pageY - container.offsetTop);
      setScrollTop(container.scrollTop);
      container.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const y = e.pageY - container.offsetTop;
      const walk = (y - startY) * 1.5; // Scroll speed multiplier
      container.scrollTop = scrollTop - walk;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      container.style.cursor = 'grab';
    };

    const handleMouseLeave = () => {
      setIsDragging(false);
      container.style.cursor = 'grab';
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Set initial cursor
    container.style.cursor = 'grab';

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDragging, startY, scrollTop]);

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const seatedMutation = useMutation({
    mutationFn: markAppointmentSeated,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });

      const delayMsg = data.delay_minutes
        ? ` (${data.delay_minutes > 0 ? '+' : ''}${data.delay_minutes} min)`
        : '';
      toast.success(`✅ ${t("calendar.seated")}${delayMsg}`);

      setTimeout(async () => {
        const appointments = await queryClient.fetchQuery({ queryKey: ["appointments"] });
        const updated = appointments.find((apt: any) => apt.id === selectedReservation?.id);
        if (updated) {
          setSelectedReservation(updated);
        }
      }, 500);
    },
    onError: () => {
      toast.error(`❌ ${tCommon("error")}`);
    },
  });

  const leftMutation = useMutation({
    mutationFn: markAppointmentLeft,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });

      toast.success(`👋 ${t("calendar.left")} ${data.duration_minutes} min`);

      setTimeout(async () => {
        const appointments = await queryClient.fetchQuery({ queryKey: ["appointments"] });
        const updated = appointments.find((apt: any) => apt.id === selectedReservation?.id);
        if (updated) {
          setSelectedReservation(updated);
        }
      }, 500);
    },
    onError: () => {
      toast.error(`❌ ${tCommon("error")}`);
    },
  });

  const noShowMutation = useMutation({
    mutationFn: markAppointmentNoShow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["globalStats"] });
      toast.success(`❌ ${t("calendar.noShowRegistered")}`);
      setDetailsDialogOpen(false);
    },
    onError: () => {
      toast.error(`❌ ${tCommon("error")}`);
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
    if (selectedReservation && window.confirm(t("calendar.confirmNoShow"))) {
      noShowMutation.mutate(selectedReservation.id);
    }
  };

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
    if (status === "completed") {
      return "bg-green-500/90 hover:bg-green-600 border-green-400/20 text-white";
    }

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
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{tCommon("loading")}</div>
      ) : !tables || tables.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("tables.noTables")}
        </div>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card relative" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '70vh' }}>
          <div ref={scrollContainerRef} className="overflow-auto relative h-full">
            <table className="border-collapse table-fixed w-full" style={{ minWidth: tables.length > 15 ? `${tables.length * 80 + 48}px` : undefined }}>
              <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b border-border/50">
                  <th className="w-12 px-1 py-1.5 text-[10px] font-semibold border-r border-border/50 sticky left-0 bg-muted/95 backdrop-blur-sm z-30">
                    {tCommon("time")}
                  </th>
                  {tables.map((table) => {
                    const numTables = tables.length;
                    const minWidth = numTables > 15 ? '80px' : '60px';

                    return (
                      <th
                        key={table.id}
                        className="px-1 py-1.5 text-[10px] font-semibold text-center border-r border-border/50 bg-muted/95"
                        style={{ minWidth }}
                      >
                        <div>T{table.table_number}</div>
                        <div className="text-[9px] text-muted-foreground font-normal">
                          {table.capacity}p
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {timeSlots.map((time, index) => (
                  <tr key={time} className="h-[20px] relative">
                    <td className="w-12 px-1 py-0.5 text-[9px] font-medium border-r border-border/50 bg-muted/30 sticky left-0 z-10 relative">
                      {time}
                      {/* Current time indicator line */}
                      {currentTimePosition !== null && index === Math.floor(currentTimePosition) && (
                        <div
                          className="absolute left-0 border-t-2 border-red-500 z-40 pointer-events-none"
                          style={{
                            top: `${(currentTimePosition - Math.floor(currentTimePosition)) * 20}px`,
                            width: '100vw',
                          }}
                        />
                      )}
                    </td>
                    {tables.map((table) => {
                      const tableReservations = getReservationsForTableAndTime(table.id, time);
                      const reservation = tableReservations[0];
                      const isStart = reservation && isReservationStart(reservation, time);

                      const numTables = tables.length;
                      const minWidth = numTables > 15 ? '80px' : '60px';

                      const isMultiTable = reservation && reservation.table_ids && reservation.table_ids.length > 1;
                      const hasNotes = !!reservation?.notes;

                      let colorClass;
                      if (isMultiTable) {
                        colorClass = hasNotes
                          ? 'bg-green-500/90 hover:bg-green-600 border-green-400/20 text-white'
                          : 'bg-yellow-500/90 hover:bg-yellow-600 border-yellow-400/20 text-white';
                      } else {
                        colorClass = getStatusColor(reservation?.status, hasNotes);
                      }

                      const canClickSlot = !reservation && onSlotClick;

                      return (
                        <td
                          key={table.id}
                          className={`border-r border-border/50 relative h-[20px] ${canClickSlot ? 'cursor-pointer hover:bg-primary/10' : ''}`}
                          style={{ minWidth }}
                          onClick={() => canClickSlot && onSlotClick(time, table.id)}
                        >
                          {isStart && (
                            <div
                              className={`absolute inset-0 m-0.5 px-1 py-0.5 rounded text-[9px] cursor-pointer transition-all z-10 flex flex-col justify-center ${colorClass}`}
                              style={{
                                height: `calc(${getReservationRowSpan(reservation)} * 20px - 4px)`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReservationClick(reservation);
                              }}
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
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reservations.details")}</DialogTitle>
          </DialogHeader>

          {selectedReservation && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {selectedReservation.status === 'completed' && (
                  <Badge className="bg-green-500 text-white border-green-400">
                    ✅ {tCommon("reservationStatus.completed")}
                  </Badge>
                )}
                {selectedReservation.seated_at && (
                  <Badge variant="success" className="bg-green-100 text-green-700 border-green-300">
                    🪑 {format(parseAsLocalTime(selectedReservation.seated_at), "HH:mm")}
                    {selectedReservation.delay_minutes && (
                      <span className="ml-1">
                        ({selectedReservation.delay_minutes > 0 ? '+' : ''}{selectedReservation.delay_minutes} min)
                      </span>
                    )}
                  </Badge>
                )}
                {selectedReservation.left_at && (
                  <Badge variant="secondary">
                    👋 {format(parseAsLocalTime(selectedReservation.left_at), "HH:mm")}
                    ({selectedReservation.duration_minutes} min)
                  </Badge>
                )}
                {selectedReservation.no_show && (
                  <Badge variant="destructive">
                    ❌ {tCommon("reservationStatus.no_show")}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">👤 {tCommon("name")}:</span>
                  <span>{selectedReservation.client_name}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">📞 {tCommon("phone")}:</span>
                  <span>{selectedReservation.phone}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">👥 {t("reservations.guests")}:</span>
                  <span>{selectedReservation.num_people}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">📅 {tCommon("date")}:</span>
                  <span>{format(parseISO(selectedReservation.date), "d MMMM yyyy", { locale: dateLocale })}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">🕐 {tCommon("time")}:</span>
                  <span>{format(parseAsLocalTime(selectedReservation.start_time), "HH:mm")}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[100px]">🪑 {t("reservations.table")}:</span>
                  <span>
                    {selectedReservation.table_numbers ? `${t("reservations.table")} ${selectedReservation.table_numbers}` : 'N/A'}
                    {selectedReservation.table_capacity > 0 && ` (${selectedReservation.table_capacity})`}
                  </span>
                </div>

                {selectedReservation.notes && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">📝 {tCommon("notes")}:</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{selectedReservation.notes}</p>
                  </div>
                )}
              </div>

              {!selectedReservation.no_show && (
                <div className="flex gap-2 flex-wrap pt-2 border-t">
                  {selectedReservation.status !== 'completed' && !selectedReservation.seated_at && (
                    <Button
                      onClick={handleSeated}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {t("calendar.seated")}
                    </Button>
                  )}

                  {selectedReservation.status !== 'completed' && selectedReservation.seated_at && !selectedReservation.left_at && (
                    <Button
                      onClick={handleLeft}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      {t("calendar.left")}
                    </Button>
                  )}

                  {(!selectedReservation.seated_at || selectedReservation.status === 'completed') && (
                    <Button
                      onClick={handleNoShow}
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {tCommon("reservationStatus.no_show")}
                    </Button>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                  {tCommon("close")}
                </Button>
                <Button onClick={handleEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {tCommon("edit")}
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
