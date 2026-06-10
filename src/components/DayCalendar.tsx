import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { getAppointmentsQueryKey, useAppointmentsQuery } from "@/hooks/useAppointmentsQuery";
import { useTenantKey } from "@/hooks/useTenantKey";
import { Pencil, Trash2, User, UserCheck, XCircle } from "lucide-react";
import { CustomerIdentifier } from "@/components/CustomerIdentifier";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteAppointment, getTables, markAppointmentSeated, markAppointmentLeft, markAppointmentNoShow, markAppointmentPaid, getAppointmentPayment, type Appointment, type Table } from "@/services/api";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";
import { toast } from "sonner";
import DeleteReservationDialog from "@/components/DeleteReservationDialog";

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
const DEFAULT_MAJOR_ROW_HEIGHT_PX = 17;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reopenDetailsAfterDeleteCancel, setReopenDetailsAfterDeleteCancel] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolledRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  // Total body height. Rows are derived from this so the body fills the
  // visible area exactly — no leftover pixels at the bottom.
  const [bodyHeight, setBodyHeight] = useState(DEFAULT_MAJOR_ROW_HEIGHT_PX * 49);
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

  const tablesKey = useTenantKey(["tables"]);
  const customersKey = useTenantKey(["customers"]);
  const globalStatsKey = useTenantKey(["globalStats"]);
  const appointmentPaymentKey = useTenantKey(["appointment-payment", selectedReservation?.id]);

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: tablesKey,
    queryFn: getTables,
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useAppointmentsQuery({
    refetchInterval: 30000,
  });

  const seatedMutation = useMutation({
    mutationFn: markAppointmentSeated,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: appointmentsQueryKey });
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
      await queryClient.invalidateQueries({ queryKey: appointmentsQueryKey });
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
      queryClient.invalidateQueries({ queryKey: appointmentsQueryKey });
      queryClient.invalidateQueries({ queryKey: customersKey });
      queryClient.invalidateQueries({ queryKey: globalStatsKey });
      toast.success(`❌ ${t("calendar.noShowRegistered")}`);
      setDetailsDialogOpen(false);
    },
    onError: () => {
      toast.error(`❌ ${tCommon("error")}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, refund }: { id: number; refund: boolean }) => deleteAppointment(id, refund),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: appointmentsQueryKey });
      await queryClient.refetchQueries({ queryKey: appointmentsQueryKey, exact: true });
      await queryClient.invalidateQueries({ queryKey: customersKey });
      await queryClient.invalidateQueries({ queryKey: globalStatsKey });
      toast.success(t("reservations.deleteSuccess"));
      setDeleteDialogOpen(false);
      setDetailsDialogOpen(false);
      setReopenDetailsAfterDeleteCancel(false);
      setSelectedReservation(null);
    },
    onError: (error: Error) => {
      toast.error(t("reservations.deleteError") + ": " + error.message);
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
    queryKey: appointmentPaymentKey,
    queryFn: () => getAppointmentPayment(selectedReservation!.id),
    enabled: detailsDialogOpen && !!selectedReservation && paymentEnabled,
  });

  const markPaidMutation = useMutation({
    mutationFn: markAppointmentPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsQueryKey });
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

  // Adaptive grid density: attempt full-day fit while preserving readability.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const recomputeRowHeight = () => {
      // Skip recompute while the tab is hidden — clientHeight can be 0 or stale.
      if (typeof document !== "undefined" && document.hidden) return;
      const containerHeight = container.clientHeight;
      if (!containerHeight || containerHeight < 200) return;

      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 36;
      const availableHeight = containerHeight - headerHeight - 8;
      if (availableHeight <= 0) return;

      // Body fills the visible area exactly. No floor-based row size — slot
      // offsets are computed by distributing pixels evenly across all 49 slots,
      // so the body height matches the container down to the pixel.
      const minPerRow = isFullscreen ? MIN_MAJOR_ROW_HEIGHT_FULLSCREEN_PX : MIN_MAJOR_ROW_HEIGHT_COMPACT_PX;
      const minBody = timeSlots.length * minPerRow;
      setBodyHeight(Math.max(minBody, availableHeight));
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
    document.addEventListener("visibilitychange", recomputeRowHeight);

    return () => {
      window.removeEventListener("resize", recomputeRowHeight);
      document.removeEventListener("visibilitychange", recomputeRowHeight);
      resizeObserver?.disconnect();
    };
  }, [isFullscreen]);

  // Reset auto-scroll latch whenever the user picks a different date.
  useEffect(() => {
    hasAutoScrolledRef.current = false;
  }, [selectedDate]);

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

  const handleDeleteClick = () => {
    if (!selectedReservation) return;
    setReopenDetailsAfterDeleteCancel(true);
    setDetailsDialogOpen(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = (refund: boolean) => {
    if (!selectedReservation) return;
    deleteMutation.mutate({ id: selectedReservation.id, refund });
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);

    if (reopenDetailsAfterDeleteCancel && selectedReservation) {
      setDetailsDialogOpen(true);
    }

    setReopenDetailsAfterDeleteCancel(false);
  };

  const getStatusColor = (status: string, hasNotes: boolean = false, isSeated: boolean = false) => {
    if (status === "completed") {
      return "bg-green-500/90 hover:bg-green-600 border-green-400/20 text-white";
    }

    if (isSeated) {
      return "bg-red-500/90 hover:bg-red-600 border-red-400/20 text-white";
    }

    if (hasNotes) {
      return "bg-blue-400/90 hover:bg-blue-500 border-blue-300/20 text-white";
    }

    switch (status) {
      case "confirmed":
        return "bg-orange-500/90 hover:bg-orange-600 border-orange-400/20 text-white";
      case "pending_payment":
        return "bg-gray-300/90 hover:bg-gray-400 border-gray-200/20 text-gray-700";
      case "cancelled":
        return "bg-destructive/90 hover:bg-destructive border-destructive/20 text-destructive-foreground";
      default:
        return "bg-muted hover:bg-muted/80 border-border text-foreground";
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

  // Single source of truth: slotOffsets[i] is the cumulative top px of slot i.
  // Pixels are distributed evenly across all 49 slots so slotOffsets[49] === bodyHeight,
  // i.e. the body fills the visible area exactly with no leftover white space.
  const slotOffsets = useMemo(() => {
    const offsets: number[] = [];
    for (let i = 0; i <= timeSlots.length; i++) {
      offsets.push(Math.round((bodyHeight * i) / timeSlots.length));
    }
    return offsets;
  }, [bodyHeight]);

  const totalBodyHeight = slotOffsets[timeSlots.length];

  // Scroll to current time once the schedule is laid out (today only).
  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    if (todayStr !== selectedDateStr) return;
    const hour = now.getHours();
    if (hour < 12 || hour >= 24) return;
    const slotIndex = (hour - 12) * 4 + Math.floor(now.getMinutes() / 15);
    if (slotIndex < 0 || slotIndex >= slotOffsets.length) return;
    const targetTop = Math.max(0, slotOffsets[slotIndex] - 100);
    container.scrollTo({ top: targetTop, behavior: "auto" });
    hasAutoScrolledRef.current = true;
  }, [selectedDate, slotOffsets]);

  const getReservationSlotRange = (reservation: any): { startIndex: number; endIndex: number } | null => {
    try {
      // Round start time to the nearest 15-min slot (matches the previous
      // isReservationStart behavior — a reservation at 19:07 still shows at 19:00).
      const start = parseAsLocalTime(reservation.start_time);
      const startMinutesFromNoon = (start.getHours() - 12) * 60 + start.getMinutes();
      const startIndex = Math.round(startMinutesFromNoon / 15);
      const rowSpan = getReservationRowSpan(reservation);
      if (startIndex < 0 || startIndex >= timeSlots.length || rowSpan <= 0) return null;
      const endIndex = Math.min(startIndex + rowSpan, timeSlots.length);
      return { startIndex, endIndex };
    } catch (e) {
      console.error("Error computing reservation slot range:", reservation, e);
      return null;
    }
  };

  const getReservationTopPx = (reservation: any): number => {
    const range = getReservationSlotRange(reservation);
    return range ? slotOffsets[range.startIndex] : 0;
  };

  const getReservationHeightPx = (reservation: any): number => {
    const range = getReservationSlotRange(reservation);
    if (!range) {
      const perRow = bodyHeight / timeSlots.length;
      return getReservationRowSpan(reservation) * perRow;
    }
    return slotOffsets[range.endIndex] - slotOffsets[range.startIndex];
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

  const currentTimeTopPx = (() => {
    if (currentTimePosition === null) return null;
    const baseIndex = Math.floor(currentTimePosition);
    if (baseIndex < 0 || baseIndex >= timeSlots.length) return null;
    const fraction = currentTimePosition - baseIndex;
    const slotHeight = slotOffsets[baseIndex + 1] - slotOffsets[baseIndex];
    return slotOffsets[baseIndex] + fraction * slotHeight;
  })();

  const getReservationColorClass = (reservation: any) => {
    const isMultiTable = !!(reservation.table_ids && reservation.table_ids.length > 1);
    const hasNotes = !!reservation.notes;
    const isSeated = !!reservation.seated_at;
    if (isMultiTable) {
      if (reservation.status === 'completed') return 'bg-emerald-600/90 hover:bg-emerald-700 border-emerald-500/20 text-white';
      if (isSeated) return 'bg-red-700/90 hover:bg-red-800 border-red-600/20 text-white';
      if (reservation.status === 'cancelled') return 'bg-destructive/90 hover:bg-destructive border-destructive/20 text-destructive-foreground';
      if (reservation.status === 'pending_payment') return 'bg-gray-400/90 hover:bg-gray-500 border-gray-300/20 text-white';
      return hasNotes
        ? 'bg-blue-600/90 hover:bg-blue-700 border-blue-500/20 text-white'
        : 'bg-yellow-500/90 hover:bg-yellow-600 border-yellow-400/20 text-white';
    }
    return getStatusColor(reservation.status, hasNotes, isSeated);
  };

  const gridTemplateColumns = `48px repeat(${orderedTables.length}, minmax(${tableColumnMinWidth}, 1fr))`;

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
            <div style={{ minWidth: wideScheduleMinWidth }}>
              {/* Header */}
              <div
                ref={headerRef}
                className="sticky top-0 z-20 bg-muted/95 backdrop-blur-sm grid border-b border-border/50"
                style={{ gridTemplateColumns }}
              >
                <div className="px-1 py-1.5 text-[10px] font-semibold border-r border-border/50 sticky left-0 bg-muted/95 backdrop-blur-sm z-30 text-center">
                  {tCommon("time")}
                </div>
                {orderedTables.map((table) => {
                  const isTerrace = table.area === "terrace";
                  const isDisabledTable = table.status === "unavailable";
                  const tableSymbol = isDisabledTable
                    ? (isTerrace ? "🚫☀" : "🚫T")
                    : (isTerrace ? "☀" : "T");

                  return (
                    <div
                      key={table.id}
                      className={`px-1 py-1.5 text-[10px] font-semibold text-center border-r ${
                        isDisabledTable
                          ? "border-rose-300/90 bg-rose-100/90 text-rose-900"
                          : isTerrace
                          ? "border-amber-200/80 bg-amber-100/90 text-amber-900"
                          : "border-border/50 bg-muted/95"
                      }`}
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
                    </div>
                  );
                })}
              </div>

              {/* Body — single source of truth: slotOffsets drives both grid lines and reservation cards */}
              <div
                className="grid relative"
                style={{ gridTemplateColumns, height: `${totalBodyHeight}px` }}
              >
                {/* Time column (sticky-left). Major slot labels centered vertically inside their row. */}
                <div
                  className="sticky left-0 z-[15] bg-muted/95 backdrop-blur-sm border-r border-border/50 relative"
                  style={{ height: `${totalBodyHeight}px` }}
                >
                  {timeSlots.map((time, i) =>
                    shouldShowTimeLabel(time) ? (
                      <div
                        key={time}
                        className="absolute left-0 right-0 px-1 text-[9px] font-medium flex items-center justify-center"
                        style={{ top: `${slotOffsets[i]}px`, height: `${slotOffsets[i + 1] - slotOffsets[i]}px` }}
                      >
                        {time}
                      </div>
                    ) : null
                  )}
                </div>

                {/* Per-table columns */}
                {orderedTables.map((table) => {
                  const tableReservations = (reservations || []).filter(
                    (r) => r.table_ids && Array.isArray(r.table_ids) && r.table_ids.includes(table.id)
                  );

                  const coveredSlots = new Set<number>();
                  tableReservations.forEach((r) => {
                    const range = getReservationSlotRange(r);
                    if (!range) return;
                    for (let i = range.startIndex; i < range.endIndex; i++) {
                      coveredSlots.add(i);
                    }
                  });

                  return (
                    <div
                      key={table.id}
                      className="relative border-r border-border/50"
                      style={{ height: `${totalBodyHeight}px` }}
                    >
                      {/* Empty-slot click targets */}
                      {onSlotClick && timeSlots.map((time, i) => {
                        if (coveredSlots.has(i)) return null;
                        return (
                          <div
                            key={time}
                            className="absolute left-0 right-0 cursor-pointer hover:bg-primary/10"
                            style={{
                              top: `${slotOffsets[i]}px`,
                              height: `${slotOffsets[i + 1] - slotOffsets[i]}px`,
                            }}
                            onClick={() => onSlotClick(time, table.id)}
                          />
                        );
                      })}

                      {/* Reservations */}
                      {tableReservations.map((reservation) => {
                        const range = getReservationSlotRange(reservation);
                        if (!range) return null;
                        const top = slotOffsets[range.startIndex];
                        const height = slotOffsets[range.endIndex] - slotOffsets[range.startIndex];
                        const colorClass = getReservationColorClass(reservation);
                        const isMultiTable = reservation.table_ids && reservation.table_ids.length > 1;

                        return (
                          <div
                            key={reservation.id}
                            className={`absolute left-0 right-0 m-0.5 px-1 py-0.5 rounded text-[9px] cursor-pointer transition-all z-10 flex flex-col justify-center ${colorClass}`}
                            style={{
                              top: `${top}px`,
                              height: `${Math.max(4, height - 4)}px`,
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
                        );
                      })}
                    </div>
                  );
                })}

                {/* Body-level horizontal grid lines spanning all columns.
                    Solid for major (:00, :30) boundaries, dashed for minor (:15, :45). */}
                {timeSlots.map((time, i) => {
                  if (i === 0) return null;
                  const isMajor = shouldShowTimeLabel(time);
                  return (
                    <div
                      key={`gridline-${time}`}
                      className={`absolute left-0 right-0 pointer-events-none ${
                        isMajor
                          ? "border-t border-border/50"
                          : "border-t border-dashed border-border/30"
                      }`}
                      style={{ top: `${slotOffsets[i]}px`, height: 0 }}
                    />
                  );
                })}

                {/* Body-level current time line */}
                {currentTimeTopPx !== null && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-40 pointer-events-none"
                    style={{ top: `${currentTimeTopPx}px`, height: 0 }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reservations.details")}</DialogTitle>
            <DialogDescription>
              {selectedReservation
                ? `${selectedReservation.client_name} · ${format(parseISO(selectedReservation.date), "d MMMM yyyy", { locale: dateLocale })}`
                : t("reservations.details")}
            </DialogDescription>
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
                  <Badge className="bg-gray-100 text-gray-600 border-gray-300">
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
                  <CustomerIdentifier phone={selectedReservation.phone} bsuid={(selectedReservation as any).bsuid} showIcon={false} />
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
                    {selectedReservation.table_numbers
                      ? (() => {
                          const parts = String(selectedReservation.table_numbers).split('+');
                          const label = parts.length > 4
                            ? `${parts.length} ${t("reservations.tables").toLowerCase()}`
                            : `${t("reservations.table")} ${selectedReservation.table_numbers}`;
                          return `${label}${selectedReservation.table_capacity > 0 ? ` (${selectedReservation.table_capacity})` : ''}`;
                        })()
                      : 'N/A'}
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

              <div className="flex gap-2 justify-between pt-4 border-t">
                <Button variant="destructive" onClick={handleDeleteClick}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tCommon("delete")}
                </Button>
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                    {tCommon("close")}
                  </Button>
                  <Button onClick={handleEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {tCommon("edit")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteReservationDialog
        open={deleteDialogOpen}
        appointmentId={selectedReservation?.id ?? null}
        appointmentName={selectedReservation?.client_name}
        appointmentDate={selectedReservation?.date}
        appointmentTime={selectedReservation?.start_time}
        paymentEnabled={paymentEnabled}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};

export default DayCalendar;
