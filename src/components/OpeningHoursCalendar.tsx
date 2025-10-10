import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Eye, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOpeningHoursRange, getAppointments } from "@/services/api";
import OpeningHoursDialog from "./OpeningHoursDialog";

interface OpeningHoursCalendarProps {
  onViewDay?: (date: Date) => void;
}

const OpeningHoursCalendar = ({ onViewDay }: OpeningHoursCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfMonth = monthStart.getDay();
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  // Obtenir horaris del mes
  const { data: openingHoursData } = useQuery({
    queryKey: ["opening-hours", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: () => getOpeningHoursRange(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")),
  });

  // Obtenir reserves
  const { data: allAppointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Crear mapa de dates amb horaris
  const hoursMap = new Map();
  openingHoursData?.forEach((hours) => {
    hoursMap.set(hours.date, hours);
  });

  // Comptar reserves per dia
  const getReservationsForDay = (day: Date) => {
    if (!allAppointments) return 0;
    
    const dayStr = format(day, "yyyy-MM-dd");
    return allAppointments.filter((apt) => {
      if (apt.status !== 'confirmed') return false;
      try {
        const aptDate = parseISO(apt.date);
        const aptDateStr = format(aptDate, "yyyy-MM-dd");
        return aptDateStr === dayStr;
      } catch {
        return false;
      }
    }).length;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleEditClick = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(day);
    setDialogOpen(true);
  };

  const handleViewDayClick = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewDay) {
      onViewDay(day);
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDialogOpen(true);
  };

  const getStatusForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const hours = hoursMap.get(dayStr);
    return hours?.status || "full_day";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "closed":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50";
      case "lunch_only":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50";
      case "dinner_only":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50";
      case "full_day":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50";
      default:
        return "hover:bg-accent/10";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "closed":
        return "🔴";
      case "lunch_only":
        return "🍽️";
      case "dinner_only":
        return "🌙";
      case "full_day":
        return "🟢";
      default:
        return "";
    }
  };

  const getHoursForSelectedDay = () => {
    if (!selectedDate) return undefined;
    const dayStr = format(selectedDate, "yyyy-MM-dd");
    return hoursMap.get(dayStr);
  };

  const isToday = (day: Date) => {
    return isSameDay(day, new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header amb navegació */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Llegenda */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span>Todo el día</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span>Solo comida</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500" />
          <span>Solo cena</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>Cerrado</span>
        </div>
      </div>

      {/* Calendari */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
        {/* Dies de la setmana */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/50">
          {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Dies del mes */}
        <div className="grid grid-cols-7">
          {/* Espais buits abans del primer dia */}
          {Array.from({ length: startingDayIndex }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square border-r border-b border-border/30 bg-muted/20" />
          ))}

          {/* Dies del mes */}
          {daysInMonth.map((day) => {
            const status = getStatusForDay(day);
            const dayStr = format(day, "yyyy-MM-dd");
            const hours = hoursMap.get(dayStr);
            const reservationsCount = getReservationsForDay(day);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`aspect-square border-r border-b border-border/30 p-2 cursor-pointer transition-all relative group ${getStatusColor(
                  status
                )} ${today ? "ring-2 ring-primary ring-inset" : ""}`}
                onClick={() => handleDayClick(day)}
              >
                <div className="flex flex-col h-full">
                  {/* Header del dia */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-lg font-semibold ${today ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </span>
                    <span className="text-xl">{getStatusIcon(status)}</span>
                  </div>

                  {/* Nombre de reserves */}
                  {reservationsCount > 0 && (
                    <div className="mb-2">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {reservationsCount} {reservationsCount === 1 ? "reserva" : "reserves"}
                      </Badge>
                    </div>
                  )}

                  {/* Horaris */}
                  {hours && (status === "full_day" || status === "lunch_only" || status === "dinner_only") && (
                    <div className="mt-auto space-y-0.5">
                      {(status === "full_day" || status === "lunch_only") && hours.lunch_start && (
                        <div className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{hours.lunch_start}-{hours.lunch_end}</span>
                        </div>
                      )}
                      {(status === "full_day" || status === "dinner_only") && hours.dinner_start && (
                        <div className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{hours.dinner_start}-{hours.dinner_end}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {hours?.notes && (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {hours.notes.substring(0, 15)}
                        {hours.notes.length > 15 ? "..." : ""}
                      </Badge>
                    </div>
                  )}

                  {/* Botons d'acció (apareixen en hover) */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => handleEditClick(day, e)}
                      className="text-xs w-full"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => handleViewDayClick(day, e)}
                      className="text-xs w-full"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ver día
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Informació addicional */}
      <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
        <p className="font-semibold mb-2">ℹ️ Información:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Pasa el cursor por encima de cualquier día para ver las opciones</li>
          <li><strong>Editar</strong>: Configura los horarios de apertura del restaurante</li>
          <li><strong>Ver día</strong>: Ver el horario detallado de reservas de ese día</li>
          <li>Los días sin configuración utilizarán el horario por defecto (12:00-15:00 y 19:00-22:30)</li>
        </ul>
      </div>

      {/* Diàleg d'edició */}
      {selectedDate && (
        <OpeningHoursDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          date={selectedDate}
          initialData={getHoursForSelectedDay()}
        />
      )}
    </div>
  );
};

export default OpeningHoursCalendar;
