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
import { setOpeningHours, getWeeklyDefaults, type SetOpeningHoursData, type SlotConfig, type PaymentConfig } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";
import DayRulesEditor, { type DayRulesValue } from "@/components/DayRulesEditor";
import { useTenantKey } from "@/hooks/useTenantKey";

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
    slot_config?: SlotConfig | null;
    payment_config?: PaymentConfig | null;
  };
}

const OpeningHoursDialog = ({ open, onOpenChange, date, initialData }: OpeningHoursDialogProps) => {
  const queryClient = useQueryClient();
  const openingHoursKey = useTenantKey(["opening-hours"]);
  const [status, setStatus] = useState<string>("full_day");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("15:00");
  const [dinnerStart, setDinnerStart] = useState("19:00");
  const [dinnerEnd, setDinnerEnd] = useState("22:30");
  const [notes, setNotes] = useState("");
  const [dayRules, setDayRules] = useState<DayRulesValue>({});
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();
  const {
    timeSlotsMode, fixedTimeSlotsLunch, fixedTimeSlotsDinner,
    paymentEnabled, getConfigNumber, getConfigValue,
  } = useRestaurantConfig();

  // A specific date inherits from its weekday, which may itself be inheriting global.
  // Fetching the weekday here is what makes the placeholders show what this date would
  // actually do if left alone, rather than the global default.
  const { data: weeklyDefaults } = useQuery({
    queryKey: useTenantKey(["weekly-defaults"]),
    queryFn: getWeeklyDefaults,
    enabled: open,
  });
  // JS getDay(): 0=Sunday. The API uses 0=Monday.
  const weekdayIndex = (date.getDay() + 6) % 7;
  const weekday = weeklyDefaults?.find((d) => d.day_of_week === weekdayIndex);

  const inheritedSlotsFor = (service: "lunch" | "dinner") => {
    const fromWeekday = weekday?.slot_config?.[service];
    if (fromWeekday) return Object.keys(fromWeekday).sort();
    const global = service === "lunch" ? fixedTimeSlotsLunch : fixedTimeSlotsDinner;
    return global.split(",").map((x) => x.trim()).filter(Boolean);
  };

  const inheritedPayment = (() => {
    const wd = weekday?.payment_config?.lunch || weekday?.payment_config?.dinner;
    return {
      amount: wd?.amount ?? getConfigNumber("payment_deposit_amount", 0),
      minPeople: wd?.min_people ?? getConfigNumber("payment_min_people", 1),
      currency: getConfigValue("payment_currency", "EUR"),
    };
  })();

  useEffect(() => {
    if (initialData) {
      setStatus(initialData.status || "full_day");
      setLunchStart(initialData.lunch_start || "12:00");
      setLunchEnd(initialData.lunch_end || "15:00");
      setDinnerStart(initialData.dinner_start || "19:00");
      setDinnerEnd(initialData.dinner_end || "22:30");
      setNotes(initialData.notes || "");
      setDayRules({
        slot_config: initialData.slot_config ?? null,
        payment_config: initialData.payment_config ?? null,
      });
    } else {
      setStatus("full_day");
      setLunchStart("12:00");
      setLunchEnd("15:00");
      setDinnerStart("19:00");
      setDinnerEnd("22:30");
      setNotes("");
      setDayRules({});
    }
  }, [initialData, open]);

  const mutation = useMutation({
    mutationFn: async (data: SetOpeningHoursData) => {
      return setOpeningHours(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: openingHoursKey });
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

    // null clears the override so this date inherits its weekday again.
    data.slot_config = dayRules.slot_config ?? null;
    data.payment_config = dayRules.payment_config ?? null;

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

          {/* Slot caps and deposits for THIS date only, overriding the weekday. */}
          {status !== "closed" && (
            <DayRulesEditor
              value={dayRules}
              onChange={setDayRules}
              timeSlotsMode={timeSlotsMode}
              inheritedSlots={{
                lunch: inheritedSlotsFor("lunch"),
                dinner: inheritedSlotsFor("dinner"),
              }}
              inheritedPayment={inheritedPayment}
              paymentsAvailable={paymentEnabled}
              openServices={
                status === "lunch_only" ? ["lunch"]
                  : status === "dinner_only" ? ["dinner"]
                  : ["lunch", "dinner"]
              }
            />
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
