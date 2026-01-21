import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { setOpeningHours, type SetOpeningHoursData } from "@/services/api";

interface OpeningHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  initialData?: {
    status: string;
    lunch_start?: string | null;
    lunch_end?: string | null;
    dinner_start?: string | null;
    dinner_end?: string | null;
    notes?: string | null;
  };
}

const OpeningHoursDialog = ({ open, onOpenChange, date, initialData }: OpeningHoursDialogProps) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("full_day");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("15:00");
  const [dinnerStart, setDinnerStart] = useState("19:00");
  const [dinnerEnd, setDinnerEnd] = useState("22:30");
  const [notes, setNotes] = useState("");
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();

  useEffect(() => {
    if (initialData) {
      setStatus(initialData.status || "full_day");
      setLunchStart(initialData.lunch_start || "12:00");
      setLunchEnd(initialData.lunch_end || "15:00");
      setDinnerStart(initialData.dinner_start || "19:00");
      setDinnerEnd(initialData.dinner_end || "22:30");
      setNotes(initialData.notes || "");
    } else {
      setStatus("full_day");
      setLunchStart("12:00");
      setLunchEnd("15:00");
      setDinnerStart("19:00");
      setDinnerEnd("22:30");
      setNotes("");
    }
  }, [initialData, open]);

  const mutation = useMutation({
    mutationFn: async (data: SetOpeningHoursData) => {
      return setOpeningHours(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opening-hours"] });
      toast.success(t("weeklySchedule.saveSuccess"));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(tCommon("error") + ": " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: SetOpeningHoursData = {
      date: format(date, "yyyy-MM-dd"),
      status: status as any,
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

    if (notes) {
      data.notes = notes;
    }

    mutation.mutate(data);
  };

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "closed":
        return "🔴 " + t("weeklySchedule.statusClosed");
      case "lunch_only":
        return "🟡 " + t("weeklySchedule.statusLunchOnly");
      case "dinner_only":
        return "🟡 " + t("weeklySchedule.statusDinnerOnly");
      case "full_day":
        return "🟢 " + t("weeklySchedule.statusFullDay");
      default:
        return value;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("weeklySchedule.configureHours")}</DialogTitle>
          <DialogDescription>
            {format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Estat del restaurant */}
          <div className="space-y-2">
            <Label htmlFor="status">{t("weeklySchedule.restaurantStatus")}</Label>
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
              <Label className="text-base font-semibold">🍽️ {t("weeklySchedule.lunchSchedule")}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lunchStart">{t("weeklySchedule.openTime")}</Label>
                  <Input
                    id="lunchStart"
                    type="time"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunchEnd">{t("weeklySchedule.closeTime")}</Label>
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
              <Label className="text-base font-semibold">🌙 {t("weeklySchedule.dinnerSchedule")}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dinnerStart">{t("weeklySchedule.openTime")}</Label>
                  <Input
                    id="dinnerStart"
                    type="time"
                    value={dinnerStart}
                    onChange={(e) => setDinnerStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinnerEnd">{t("weeklySchedule.closeTime")}</Label>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t("weeklySchedule.internalNotes")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("weeklySchedule.notesPlaceholder")}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t("weeklySchedule.notesHelp")}
            </p>
          </div>

          {/* Botons */}
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? tCommon("saving") : tCommon("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OpeningHoursDialog;
