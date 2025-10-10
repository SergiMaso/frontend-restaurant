import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { ca } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAppointments } from "@/services/api";

interface MonthCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDateClick?: (date: Date) => void;
}

const MonthCalendar = ({ selectedDate, onDateChange, onDateClick }: MonthCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  const { data: allAppointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Obtenir tots els dies del mes
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Obtenir el dia de la setmana del primer dia (0 = diumenge, 1 = dilluns, etc.)
  const firstDayOfMonth = monthStart.getDay();
  // Ajustar perquè dilluns sigui 0
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  // Comptar reserves per cada dia
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
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onDateChange(today);
  };

  const handleDayClick = (day: Date) => {
    onDateChange(day);
    if (onDateClick) {
      onDateClick(day);
    }
  };

  const isToday = (day: Date) => {
    return isSameDay(day, new Date());
  };

  const isSelected = (day: Date) => {
    return isSameDay(day, selectedDate);
  };

  return (
    <div className="space-y-4">
      {/* Header amb navegació */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
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

      {/* Calendari */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
        {/* Dies de la setmana */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/50">
          {["Dl", "Dm", "Dc", "Dj", "Dv", "Ds", "Dg"].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-semibold text-muted-foreground"
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
            const reservationsCount = getReservationsForDay(day);
            const today = isToday(day);
            const selected = isSelected(day);

            return (
              <div
                key={day.toISOString()}
                className={`aspect-square border-r border-b border-border/30 p-2 cursor-pointer transition-colors hover:bg-accent/10 ${
                  selected ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""
                } ${today ? "bg-accent/5" : ""}`}
                onClick={() => handleDayClick(day)}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        today
                          ? "text-primary font-bold"
                          : selected
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {reservationsCount > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {reservationsCount}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Indicador visual de reserves */}
                  {reservationsCount > 0 && (
                    <div className="mt-auto">
                      <div className="flex gap-0.5 flex-wrap">
                        {Array.from({ length: Math.min(reservationsCount, 8) }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-primary"
                          />
                        ))}
                        {reservationsCount > 8 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            +{reservationsCount - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Llegenda */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Avui</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm ring-2 ring-primary" />
          <span>Seleccionat</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            3
          </Badge>
          <span>Nombre de reserves</span>
        </div>
      </div>
    </div>
  );
};

export default MonthCalendar;
