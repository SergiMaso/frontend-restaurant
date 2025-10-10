import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { format, addMonths } from "date-fns";

interface RecurringHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecurringHoursDialog = ({ open, onOpenChange }: RecurringHoursDialogProps) => {
  const queryClient = useQueryClient();
  const [dayOfWeek, setDayOfWeek] = useState<string>("1");
  const [status, setStatus] = useState<string>("full_day");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("15:00");
  const [dinnerStart, setDinnerStart] = useState("19:00");
  const [dinnerEnd, setDinnerEnd] = useState("22:30");
  const [applyMonths, setApplyMonths] = useState("3");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/opening-hours/recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardant horaris recurrents');
      }
      
      return response.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["opening-hours"] });
      toast.success(`Horaris aplicats a ${response.days_updated} dies`);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      day_of_week: parseInt(dayOfWeek),
      status: status,
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(addMonths(new Date(), parseInt(applyMonths)), "yyyy-MM-dd"),
    };

    // Només afegir horaris si el restaurant està obert
    if (status === "full_day" || status === "lunch_only") {
      data.lunch_start = lunchStart;
      data.lunch_end = lunchEnd;
    }

    if (status === "full_day" || status === "dinner_only") {
      data.dinner_start = dinnerStart;
      data.dinner_end = dinnerEnd;
    }

    mutation.mutate(data);
  };

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "closed":
        return "🔴 Tancat";
      case "lunch_only":
        return "🟡 Només dinar";
      case "dinner_only":
        return "🟡 Només sopar";
      case "full_day":
        return "🟢 Tot el dia";
      default:
        return value;
    }
  };

  const getDayName = (value: string) => {
    const days = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];
    return days[parseInt(value)];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar horaris recurrents</DialogTitle>
          <DialogDescription>
            Aplica el mateix horari a tots els dies d'una setmana concreta
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dia de la setmana */}
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Dia de la setmana</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">📅 Dilluns</SelectItem>
                <SelectItem value="1">📅 Dimarts</SelectItem>
                <SelectItem value="2">📅 Dimecres</SelectItem>
                <SelectItem value="3">📅 Dijous</SelectItem>
                <SelectItem value="4">📅 Divendres</SelectItem>
                <SelectItem value="5">📅 Dissabte</SelectItem>
                <SelectItem value="6">📅 Diumenge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Període d'aplicació */}
          <div className="space-y-2">
            <Label htmlFor="applyMonths">Aplicar durant</Label>
            <Select value={applyMonths} onValueChange={setApplyMonths}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mes</SelectItem>
                <SelectItem value="3">3 mesos</SelectItem>
                <SelectItem value="6">6 mesos</SelectItem>
                <SelectItem value="12">1 any</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              S'aplicarà a tots els {getDayName(dayOfWeek).toLowerCase()}s des d'avui fins d'aquí {applyMonths} {parseInt(applyMonths) === 1 ? "mes" : "mesos"}
            </p>
          </div>

          {/* Estat del restaurant */}
          <div className="space-y-2">
            <Label htmlFor="status">Estat del restaurant</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
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
              <Label className="text-base font-semibold">🍽️ Horari de dinar</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lunchStart">Obertura</Label>
                  <Input
                    id="lunchStart"
                    type="time"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunchEnd">Tancament</Label>
                  <Input
                    id="lunchEnd"
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
              <Label className="text-base font-semibold">🌙 Horari de sopar</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dinnerStart">Obertura</Label>
                  <Input
                    id="dinnerStart"
                    type="time"
                    value={dinnerStart}
                    onChange={(e) => setDinnerStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinnerEnd">Tancament</Label>
                  <Input
                    id="dinnerEnd"
                    type="time"
                    value={dinnerEnd}
                    onChange={(e) => setDinnerEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advertència */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Atenció:</strong> Això sobreescriurà la configuració existent per a tots els {getDayName(dayOfWeek).toLowerCase()}s en el període seleccionat.
            </p>
          </div>

          {/* Botons */}
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Aplicant..." : "Aplicar horaris"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringHoursDialog;
