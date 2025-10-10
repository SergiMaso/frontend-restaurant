import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { ca } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOpeningHoursRange } from "@/services/api";
import OpeningHoursDialog from "./OpeningHoursDialog";

const OpeningHoursCalendar = () => {
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

  // Crear mapa de dates amb horaris
  const hoursMap = new Map();
  openingHoursData?.forEach((hours) => {
    hoursMap.set(hours.date, hours);
  });

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDialogOpen(true);
  };

  const getStatusForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const hours = hoursMap.get(dayStr);
    return hours?.status || "full_day"; // Per defecte: obert tot el dia
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "closed":
        return "Tancat";
      case "lunch_only":
        return "Només dinar";
      case "dinner_only":
        return "Només sopar";
      case "full_day":
        return "Tot el dia";
      default:
        return "";
    }
  };

  const getHoursForSelectedDay = () => {
    if (!selectedDate) return undefined;
    const dayStr = format(selectedDate, "yyyy-MM-dd");
    return hoursMap.get(dayStr);
  };

  return (
    <div className="space-y-6">
      {/* Header amb navegació */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ca })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Avui
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
          <span>Tot el dia</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span>Només dinar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500" />
          <span>Només sopar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>Tancat</span>
        </div>
      </div>

      {/* Calendari */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
        {/* Dies de la setmana */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/50">
          {["Dl", "Dm", "Dc", "Dj", "Dv", "Ds", "Dg"].map((day) => (
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

            return (
              <div
                key={day.toISOString()}
                className={`aspect-square border-r border-b border-border/30 p-3 cursor-pointer transition-all ${getStatusColor(
                  status
                )}`}
                onClick={() => handleDayClick(day)}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold">{format(day, "d")}</span>
                    <span className="text-xl">{getStatusIcon(status)}</span>
                  </div>

                  {/* Informació addicional */}
                  {hours && (
                    <div className="mt-auto space-y-1">
                      {(status === "full_day" || status === "lunch_only") && hours.lunch_start && (
                        <div className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {hours.lunch_start} - {hours.lunch_end}
                          </span>
                        </div>
                      )}
                      {(status === "full_day" || status === "dinner_only") && hours.dinner_start && (
                        <div className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {hours.dinner_start} - {hours.dinner_end}
                          </span>
                        </div>
                      )}
                      {hours.notes && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {hours.notes.substring(0, 20)}
                          {hours.notes.length > 20 ? "..." : ""}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Informació addicional */}
      <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
        <p className="font-semibold mb-2">ℹ️ Informació:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Clica en qualsevol dia per configurar els horaris</li>
          <li>Els dies sense configuració específica utilitzaran l'horari per defecte (12:00-15:00 i 19:00-22:30)</li>
          <li>Les notes només són visibles internament</li>
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
