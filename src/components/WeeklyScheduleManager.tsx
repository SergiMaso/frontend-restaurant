import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Save, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getWeeklyDefaults, updateWeeklyDefault, type WeeklyDefault } from "@/services/api";

const WeeklyScheduleManager = () => {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<WeeklyDefault | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Carregar configuració setmanal
  const { data: weeklyDefaults, isLoading } = useQuery({
    queryKey: ["weekly-defaults"],
    queryFn: getWeeklyDefaults,
  });

  const mutation = useMutation({
    mutationFn: ({ dayOfWeek, data }: { dayOfWeek: number; data: any }) =>
      updateWeeklyDefault(dayOfWeek, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["weekly-defaults"] });
      queryClient.invalidateQueries({ queryKey: ["opening-hours"] });
      toast.success(response.message || `✅ Configuración actualizada! ${response.days_updated || 0} días afectados.`);
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const handleDayClick = (day: WeeklyDefault) => {
    setSelectedDay(day);
    setDialogOpen(true);
  };

  const getDayColor = (status: string) => {
    switch (status) {
      case "closed":
        return "bg-red-100 hover:bg-red-200 text-red-700 border-red-300";
      case "lunch_only":
      case "dinner_only":
        return "bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border-yellow-300";
      case "full_day":
        return "bg-green-100 hover:bg-green-200 text-green-700 border-green-300";
      default:
        return "bg-gray-100 hover:bg-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "closed": return "🔴";
      case "lunch_only": return "🍽️";
      case "dinner_only": return "🌙";
      case "full_day": return "🟢";
      default: return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!weeklyDefaults || weeklyDefaults.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>⚠️ Error:</strong> No se pudo cargar la configuración semanal. 
            Verifica que el backend esté funcionando correctamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>ℹ️ Cómo funciona:</strong> Selecciona un día de la semana para configurar su horario por defecto. 
          Los cambios se aplicarán a todos los días futuros del mismo tipo que no tengan configuración personalizada.
        </AlertDescription>
      </Alert>

      {/* Grid de botons amb els dies */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {weeklyDefaults?.map((day) => (
          <Button
            key={day.day_of_week}
            onClick={() => handleDayClick(day)}
            variant="outline"
            className={`h-auto py-4 flex flex-col items-center gap-2 transition-all ${getDayColor(day.status)}`}
          >
            <span className="text-2xl">{getStatusIcon(day.status)}</span>
            <span className="font-semibold">{day.day_name}</span>
            <span className="text-xs opacity-75">
              {day.status === "closed" ? "Cerrado" : 
               day.status === "lunch_only" ? "Solo comida" :
               day.status === "dinner_only" ? "Solo cena" : "Todo el día"}
            </span>
          </Button>
        ))}
      </div>

      {/* Modal d'edició */}
      {selectedDay && (
        <DayEditorDialog
          day={selectedDay}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={(data) => mutation.mutate({ dayOfWeek: selectedDay.day_of_week, data })}
          isLoading={mutation.isPending}
        />
      )}
    </div>
  );
};

interface DayEditorDialogProps {
  day: WeeklyDefault;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}

const DayEditorDialog = ({ day, open, onOpenChange, onSave, isLoading }: DayEditorDialogProps) => {
  const [status, setStatus] = useState(day.status);
  const [lunchStart, setLunchStart] = useState(day.lunch_start || "12:00");
  const [lunchEnd, setLunchEnd] = useState(day.lunch_end || "15:00");
  const [dinnerStart, setDinnerStart] = useState(day.dinner_start || "19:00");
  const [dinnerEnd, setDinnerEnd] = useState(day.dinner_end || "22:30");

  const handleSave = () => {
    const data: any = { status };

    if (status === "full_day" || status === "lunch_only") {
      data.lunch_start = lunchStart;
      data.lunch_end = lunchEnd;
    }

    if (status === "full_day" || status === "dinner_only") {
      data.dinner_start = dinnerStart;
      data.dinner_end = dinnerEnd;
    }

    onSave(data);
  };

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "closed": return "🔴 Cerrado";
      case "lunch_only": return "🟡 Solo comida";
      case "dinner_only": return "🟡 Solo cena";
      case "full_day": return "🟢 Todo el día";
      default: return value;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configurar todos los {day.day_name.toLowerCase()}s
          </DialogTitle>
          <DialogDescription>
            Define el horario por defecto para este día de la semana
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Estado del restaurante</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_day">{getStatusLabel("full_day")}</SelectItem>
                <SelectItem value="lunch_only">{getStatusLabel("lunch_only")}</SelectItem>
                <SelectItem value="dinner_only">{getStatusLabel("dinner_only")}</SelectItem>
                <SelectItem value="closed">{getStatusLabel("closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Horaris de dinar */}
          {(status === "full_day" || status === "lunch_only") && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">🍽️ Horario de comida</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lunch-start">Apertura</Label>
                  <Input
                    id="lunch-start"
                    type="time"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunch-end">Cierre</Label>
                  <Input
                    id="lunch-end"
                    type="time"
                    value={lunchEnd}
                    onChange={(e) => setLunchEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Horaris de sopar */}
          {(status === "full_day" || status === "dinner_only") && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">🌙 Horario de cena</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dinner-start">Apertura</Label>
                  <Input
                    id="dinner-start"
                    type="time"
                    value={dinnerStart}
                    onChange={(e) => setDinnerStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinner-end">Cierre</Label>
                  <Input
                    id="dinner-end"
                    type="time"
                    value={dinnerEnd}
                    onChange={(e) => setDinnerEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botons */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyScheduleManager;
