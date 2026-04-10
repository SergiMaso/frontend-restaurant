import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { getAppointmentsQueryKey, useAppointmentsQuery } from "@/hooks/useAppointmentsQuery";
import { Pencil, User, UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTables, markAppointmentSeated, markAppointmentLeft, markAppointmentNoShow, markAppointmentPaid, getAppointmentPayment, type Appointment, type Table } from "@/services/api";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";
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

const MIN_MAJOR_ROW_HEIGHT_FULLSCREEN_PX = 12;
const MIN_MAJOR_ROW_HEIGHT_COMPACT_PX = 8;
const MIN_MINOR_ROW_HEIGHT_PX = 6;
const DEFAULT_MAJOR_ROW_HEIGHT_PX = 17;
const NON_LABEL_ROW_RATIO_COMPACT = 0.65;
const NON_FULLSCREEN_MAJOR_ROW_SCALE = 0.8;
const NON_FULLSCREEN_TARGET_END_TIME = "22:00";
const DEFAULT_TABLE_COLUMN_MIN_WIDTH_PX = 44.1;
const DENSE_TABLE_COLUMN_MIN_WIDTH_PX = 58.5;

const parseAsLocalTime = (timestamp: string): Date => {
  const withoutTz = timestamp.split('+')[0].split('Z')[0];
  return new Date(withoutTz);
};

const shouldShowTimeLabel = (time: string): boolean => {
  const [, minutes] = time.split(":");
  return minutes === "00" || minutes === "30";
};

const normalizeTableArea = (area?: Table["area"]): "inside" | "terrace" =>
  area === "terrace" ? "terrace" : "inside";

const getTableColumnMinWidthPx = (tableCount: number): number =>
  tableCount > 15 ? DENSE_TABLE_COLUMN_MIN_WIDTH_PX : DEFAULT_TABLE_COLUMN_MIN_WIDTH_PX;

// Keep the schedule grouped by area first, then cluster combinable tables together inside each area.
const orderTablesForSchedule = (tables: Table[]): Table[] => {
  const sortByTableNumber = (a: Table, b: Table) => a.table_number - b.table_number;
  const tablesByNumber = new Map(tables.map((table) => [table.table_number, table]));

  const orderAreaTables = (area: "inside" | "terrace"): Table[] => {
    const areaTables = tables
      .filter((table) => normalizeTableArea(table.area) === area)
      .sort(sortByTableNumber);

    const areaTableNumbers = new Set(areaTables.map((table) => table.table_number));
    const adjacency = new Map<number, Set<number>>();

    areaTables.forEach((table) => {
      adjacency.set(table.table_number, new Set<number>());
    });

    areaTables.forEach((table) => {
      (table.pairing || []).forEach((pairedTableNumber) => {
        if (!areaTableNumbers.has(pairedTableNumber)) return;

        adjacency.get(table.table_number)?.add(pairedTableNumber);
        adjacency.get(pairedTableNumber)?.add(table.table_number);
      });
    });

    const visited = new Set<number>();
    const orderedTables: Table[] = [];

    areaTables.forEach((table) => {
      if (visited.has(table.table_number)) return;

      const componentNumbers: number[] = [];
      const queue = [table.table_number];
      visited.add(table.table_number);

      while (queue.length > 0) {
        const currentTableNumber = queue.shift();
        if (currentTableNumber === undefined) continue;

        componentNumbers.push(currentTableNumber);

        const neighbors = Array.from(adjacency.get(currentTableNumber) || []).sort((a, b) => a - b);
        neighbors.forEach((neighborTableNumber) => {
          if (visited.has(neighborTableNumber)) return;
          visited.add(neighborTableNumber);
          queue.push(neighborTableNumber);
        });
      }

      componentNumbers
        .sort((a, b) => a - b)
        .forEach((tableNumber) => {
          const groupedTable = tablesByNumber.get(tableNumber);
          if (groupedTable) {
            orderedTables.push(groupedTable);
          }
        });
    });

    return orderedTables;
  };

  return [...orderAreaTables("inside"), ...orderAreaTables("terrace")];
};

const DayCalendar = ({ selectedDate, onDateChange, onEdit, isFullscreen = false, onSlotClick }: DayCalendarProps) => {
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [rowHeightPx, setRowHeightPx] = useState(DEFAULT_MAJOR_ROW_HEIGHT_PX);
  const queryClient = useQueryClient();
  const { selectedRestaurant } = useRestaurant();
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();
  const appointmentsQueryKey = getAppointmentsQueryKey(selectedRestaurant?.id);

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

  // Adaptive grid density: attempt full-day fit while preserving readability.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const recomputeRowHeight = () => {
      const containerHeight = container.clientHeight;
      if (!containerHeight) return;

      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 36;
      const availableHeight = containerHeight - headerHeight - 8;
      if (availableHeight <= 0) return;

      const minorRatio = isFullscreen ? 1 : NON_LABEL_ROW_RATIO_COMPACT;
      const targetEndIndex = timeSlots.indexOf(NON_FULLSCREEN_TARGET_END_TIME);
      const targetSlots = !isFullscreen && targetEndIndex > 0
        ? timeSlots.slice(0, targetEndIndex + 1)
        : timeSlots;

      const majorSlotsCount = targetSlots.filter(shouldShowTimeLabel).length;
      const minorSlotsCount = targetSlots.length - majorSlotsCount;
      const weightedUnits = majorSlotsCount + minorSlotsCount * minorRatio;
      const candidateHeight = Math.floor(availableHeight / weightedUnits);
      const scaledCandidateHeight = isFullscreen
        ? candidateHeight
        : Math.floor(candidateHeight * NON_FULLSCREEN_MAJOR_ROW_SCALE);
      const minMajorHeight = isFullscreen ? MIN_MAJOR_ROW_HEIGHT_FULLSCREEN_PX : MIN_MAJOR_ROW_HEIGHT_COMPACT_PX;
      setRowHeightPx(Math.max(minMajorHeight, scaledCandidateHeight));
    };

    recomputeRowHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(recomputeRowHeight);
      resizeObserver.observe(container);
      if (headerRef.current) {
        resizeObserver.observe(headerRef.current);
      }
    }

    window.addEventListener("resize", recomputeRowHeight);

    return () => {
      window.removeEventListener("resize", recomputeRowHeight);
      resizeObserver?.disconnect();
    };
  }, [isFullscreen]);

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useAppointmentsQuery({
    refetchInterval: 30000,
  });

  const seatedMutation = useMutation({
    mutationFn: markAppointmentSeated,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.refetchQueries({ queryKey: appointmentsQueryKey, exact: true });

      const delayMsg = data.delay_minutes
        ? ` (${data.delay_minutes > 0 ? '+' : ''}${data.delay_minutes} min)`
        : '';
      toast.success(`✅ ${t("calendar.seated")}${delayMsg}`);

      const appointments = queryClient.getQueryData<Appointment[]>(appointmentsQueryKey) || [];
      const updated = appointments.find((apt) => apt.id === selectedReservation?.id);
      if (updated) {
        setSelectedReservation(updated);
      }
    },
    onError: () => {
      toast.error(`❌ ${tCommon("error")}`);
    },
  });

  const leftMutation = useMutation({
    mutationFn: markAppointmentLeft,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.refetchQueries({ queryKey: appointmentsQueryKey, exact: true });

      toast.success(`👋 ${t("calendar.left")} ${data.duration_minutes} min`);

      const appointments = queryClient.getQueryData<Appointment[]>(appointmentsQueryKey) || [];
      const updated = appointments.find((apt) => apt.id === selectedReservation?.id);
      if (updated) {
        setSelectedReservation(updated);
      }
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

  const { paymentEnabled } = useRestaurantConfig();

  const { data: selectedPayment } = useQuery({
    queryKey: ['appointment-payment', selectedReservation?.id],
    queryFn: () => getAppointmentPayment(selectedReservation!.id),
    enabled: detailsDialogOpen && !!selectedReservation && paymentEnabled,
  });

  const markPaidMutation = useMutation({
    mutationFn: markAppointmentPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(`✅ ${t("payments.markedAsPaid")}`);
      setDetailsDialogOpen(false);
    },
    onError: () => {
      toast.error(`❌ ${tCommon("error")}`);
    },
  });

  const reservations = allAppointments?.filter((r) => {
    if (r.status !== 'confirmed' && r.status !== 'completed' && r.status !== 'pending_payment') return false;

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
  const orderedTables = orderTablesForSchedule(tables || []);
  const tableColumnMinWidth = `${getTableColumnMinWidthPx(orderedTables.length)}px`;
  const wideScheduleMinWidth = orderedTables.length > 15
    ? `${orderedTables.length * DENSE_TABLE_COLUMN_MIN_WIDTH_PX + 48}px`
    : undefined;

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
      return "bg-blue-400/90 hover:bg-blue-500 border-blue-300/20 text-white";
    }

    switch (status) {
      case "confirmed":
        return "bg-orange-500/90 hover:bg-orange-600 border-orange-400/20 text-white";
      case "pending_payment":
        return "bg-yellow-400/90 hover:bg-yellow-500 border-yellow-300/20 text-white";
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
        const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
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

  const getRowHeightPx = (time: string): number => {
    if (shouldShowTimeLabel(time)) {
      return rowHeightPx;
    }
    if (isFullscreen) {
      return rowHeightPx;
    }
    return Math.max(MIN_MINOR_ROW_HEIGHT_PX, Math.floor(rowHeightPx * NON_LABEL_ROW_RATIO_COMPACT));
  };

  const getReservationHeightPx = (reservation: any): number => {
    try {
      const startTime = format(parseAsLocalTime(reservation.start_time), "HH:mm");
      const startIndex = timeSlots.indexOf(startTime);
      const rowSpan = getReservationRowSpan(reservation);

      if (startIndex === -1 || rowSpan <= 0) {
        return rowSpan * rowHeightPx;
      }

      const endIndex = Math.min(startIndex + rowSpan, timeSlots.length);
      let totalHeight = 0;
      for (let i = startIndex; i < endIndex; i++) {
        totalHeight += getRowHeightPx(timeSlots[i]);
      }
      return totalHeight;
    } catch (e) {
      console.error("Error calculating reservation height:", reservation, e);
      return getReservationRowSpan(reservation) * rowHeightPx;
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
      ) : orderedTables.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("tables.noTables")}
        </div>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card relative" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '70vh' }}>
          <div ref={scrollContainerRef} className="overflow-auto relative h-full">
            <table className="border-collapse table-fixed w-full" style={{ minWidth: wideScheduleMinWidth }}>
              <thead ref={headerRef} className="sticky top-0 z-20 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b border-border/50">
                  <th className="w-12 px-1 py-1.5 text-[10px] font-semibold border-r border-border/50 sticky left-0 bg-muted/95 backdrop-blur-sm z-30">
                    {tCommon("time")}
                  </th>
                  {orderedTables.map((table) => {
                    const isTerrace = table.area === "terrace";
                    const isDisabledTable = table.status === "unavailable";
                    const tableSymbol = isDisabledTable
                      ? (isTerrace ? "🚫☀" : "🚫T")
                      : (isTerrace ? "☀" : "T");

                    return (
                      <th
                        key={table.id}
                        className={`px-1 py-1.5 text-[10px] font-semibold text-center border-r ${
                          isDisabledTable
                            ? "border-rose-300/90 bg-rose-100/90 text-rose-900"
                            : isTerrace
                            ? "border-amber-200/80 bg-amber-100/90 text-amber-900"
                            : "border-border/50 bg-muted/95"
                        }`}
                        style={{ minWidth: tableColumnMinWidth }}
                      >
                        <div>{tableSymbol}{table.table_number}</div>
                        <div className={`text-[9px] font-normal ${
                          isDisabledTable
                            ? "text-rose-700"
                            : isTerrace
                              ? "text-amber-700"
                              : "text-muted-foreground"
                        }`}>
                          {table.capacity}p
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {timeSlots.map((time, index) => (
                  <tr key={time} className="relative" style={{ height: `${getRowHeightPx(time)}px` }}>
                    <td className="w-12 px-1 py-0.5 text-[9px] font-medium border-r border-border/50 bg-muted/30 sticky left-0 z-10 relative">
                      {shouldShowTimeLabel(time) ? time : ""}
                      {/* Current time indicator line */}
                      {currentTimePosition !== null && index === Math.floor(currentTimePosition) && (
                        <div
                          className="absolute left-0 border-t-2 border-red-500 z-40 pointer-events-none"
                          style={{
                            top: `${(currentTimePosition - Math.floor(currentTimePosition)) * getRowHeightPx(time)}px`,
                            width: '100vw',
                          }}
                        />
                      )}
                    </td>
                    {orderedTables.map((table) => {
                      const tableReservations = getReservationsForTableAndTime(table.id, time);
                      const reservation = tableReservations[0];
                      const isStart = reservation && isReservationStart(reservation, time);

                      const isMultiTable = reservation && reservation.table_ids && reservation.table_ids.length > 1;
                      const hasNotes = !!reservation?.notes;

                      let colorClass;
                      if (isMultiTable) {
                        if (reservation?.status === 'completed') {
                          colorClass = 'bg-emerald-600/90 hover:bg-emerald-700 border-emerald-500/20 text-white';
                        } else if (reservation?.status === 'cancelled') {
                          colorClass = 'bg-destructive/90 hover:bg-destructive border-destructive/20 text-destructive-foreground';
                        } else {
                          colorClass = hasNotes
                            ? 'bg-blue-600/90 hover:bg-blue-700 border-blue-500/20 text-white'
                            : 'bg-yellow-500/90 hover:bg-yellow-600 border-yellow-400/20 text-white';
                        }
                      } else {
                        colorClass = getStatusColor(reservation?.status, hasNotes);
                      }

                      const canClickSlot = !reservation && !!onSlotClick;

                      return (
                        <td
                          key={table.id}
                          className={`border-r border-border/50 relative ${canClickSlot ? 'cursor-pointer hover:bg-primary/10' : ''}`}
                          style={{ minWidth: tableColumnMinWidth, height: `${getRowHeightPx(time)}px` }}
                          onClick={() => canClickSlot && onSlotClick(time, table.id)}
                        >
                          {isStart && (
                            <div
                              className={`absolute inset-0 m-0.5 px-1 py-0.5 rounded text-[9px] cursor-pointer transition-all z-10 flex flex-col justify-center ${colorClass}`}
                              style={{
                                height: `${Math.max(4, getReservationHeightPx(reservation) - 4)}px`,
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
                {paymentEnabled && selectedReservation.status === 'pending_payment' && (
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    💳 {tCommon("reservationStatus.pending_payment")}
                  </Badge>
                )}
                {paymentEnabled && selectedPayment?.status === 'completed' && (
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    💳 {t("payments.status.completed")} · {selectedPayment.amount} {selectedPayment.currency}
                  </Badge>
                )}
                {paymentEnabled && selectedPayment?.status === 'refunded' && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    💳 {t("payments.status.refunded")}
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

              {paymentEnabled && selectedReservation.status === 'pending_payment' && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => markPaidMutation.mutate(selectedReservation.id)}
                    disabled={markPaidMutation.isPending}
                  >
                    💳 {t("payments.markAsPaid")}
                  </Button>
                </div>
              )}

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
