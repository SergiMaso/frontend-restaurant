import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Save, AlertCircle } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getWeeklyDefaults, updateWeeklyDefault, type WeeklyDefault } from "@/services/api";

const WeeklyScheduleManager = () => {
  const queryClient = useQueryClient();

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
      toast.success(response.message || `✅ Configuració actualitzada! ${response.days_updated || 0} dies afectats.`);
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

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
        <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
          <p className="font-semibold mb-2">🔧 Solución:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Asegúrate de que el backend esté corriendo (puerto 5000)</li>
            <li>Verifica la consola del navegador para ver errores</li>
            <li>Comprueba que la variable VITE_API_URL esté configurada correctamente</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>ℹ️ Cómo funciona:</strong> Cuando cambias el horario de un día de la semana (por ejemplo, "todos los lunes"),
          el sistema aplicará este horario a <strong>todos los lunes futuros</strong> que NO hayan sido editados manualmente
          desde el calendario individual. Los días con configuración personalizada NO se modificarán.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {weeklyDefaults?.map((day) => (
          <DayScheduleRow
            key={day.day_of_week}
            day={day}
            onUpdate={(data) => mutation.mutate({ dayOfWeek: day.day_of_week, data })}
            isLoading={mutation.isPending}
          />
        ))}
      </div>
    </div>
  );
};

interface DayScheduleRowProps {
  day: WeeklyDefault;
  onUpdate: (data: any) => void;
  isLoading: boolean;
}

const DayScheduleRow = ({ day, onUpdate, isLoading }: DayScheduleRowProps) => {
  const [status, setStatus] = useState(day.status);
  const [lunchStart, setLunchStart] = useState(day.lunch_start || "12:00");
  const [lunchEnd, setLunchEnd] = useState(day.lunch_end || "15:00");
  const [dinnerStart, setDinnerStart] = useState(day.dinner_start || "19:00");
  const [dinnerEnd, setDinnerEnd] = useState(day.dinner_end || "22:30");

  // Actualitzar quan canviï la prop
  useEffect(() => {
    setStatus(day.status);
    setLunchStart(day.lunch_start || "12:00");
    setLunchEnd(day.lunch_end || "15:00");
    setDinnerStart(day.dinner_start || "19:00");
    setDinnerEnd(day.dinner_end || "22:30");
  }, [day]);

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

    onUpdate(data);
  };

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "closed":
        return "🔴 Cerrado";
      case "lunch_only":
        return "🟡 Solo comida";
      case "dinner_only":
        return "🟡 Solo cena";
      case "full_day":
        return "🟢 Todo el día";
      default:
        return value;
    }
  };

  const getStatusColor = (value: string) => {
    switch (value) {
      case "closed":
        return "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20";
      case "lunch_only":
      case "dinner_only":
        return "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20";
      case "full_day":
        return "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20";
      default:
        return "";
    }
  };

  return (
    <Card className={`transition-all ${getStatusColor(status)}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {day.day_name}
        </CardTitle>
        <CardDescription>Configuración por defecto para todos los {day.day_name.toLowerCase()}s</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor={`status-${day.day_of_week}`}>Estado del restaurante</Label>
          <Select value={status} onValueChange={(value: any) => setStatus(value)}>
            <SelectTrigger id={`status-${day.day_of_week}`}>
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
                <Label htmlFor={`lunch-start-${day.day_of_week}`}>Apertura</Label>
                <Input
                  id={`lunch-start-${day.day_of_week}`}
                  type="time"
                  value={lunchStart}
                  onChange={(e) => setLunchStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`lunch-end-${day.day_of_week}`}>Cierre</Label>
                <Input
                  id={`lunch-end-${day.day_of_week}`}
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
                <Label htmlFor={`dinner-start-${day.day_of_week}`}>Apertura</Label>
                <Input
                  id={`dinner-start-${day.day_of_week}`}
                  type="time"
                  value={dinnerStart}
                  onChange={(e) => setDinnerStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`dinner-end-${day.day_of_week}`}>Cierre</Label>
                <Input
                  id={`dinner-end-${day.day_of_week}`}
                  type="time"
                  value={dinnerEnd}
                  onChange={(e) => setDinnerEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Botó desar */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyScheduleManager;
