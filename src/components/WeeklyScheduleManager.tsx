import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";
import DayRulesEditor, { type DayRulesValue } from "@/components/DayRulesEditor";
import { useTenantKey } from "@/hooks/useTenantKey";

const WeeklyScheduleManager = () => {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<WeeklyDefault | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");

  // Map day_of_week (0=Monday, 6=Sunday) to translation keys
  const getDayName = (dayOfWeek: number) => {
    const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    return tCommon(`days.${dayKeys[dayOfWeek]}`);
  };

  const weeklyDefaultsKey = useTenantKey(["weekly-defaults"]);
  const openingHoursKey = useTenantKey(["opening-hours"]);

  // Carregar configuració setmanal
  const { data: weeklyDefaults, isLoading } = useQuery({
    queryKey: weeklyDefaultsKey,
    queryFn: getWeeklyDefaults,
  });

  const mutation = useMutation({
    mutationFn: ({ dayOfWeek, data }: { dayOfWeek: number; data: any }) =>
      updateWeeklyDefault(dayOfWeek, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: weeklyDefaultsKey });
      queryClient.invalidateQueries({ queryKey: openingHoursKey });
      toast.success(`✅ ${t("weeklySchedule.configUpdated")}! ${response.days_updated || 0} ${t("weeklySchedule.daysAffected")}.`);
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(tCommon("error") + ": " + error.message);
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
            <strong>⚠️ {tCommon("error")}:</strong> {t("weeklySchedule.loadError")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Grid de botons més petit i compacte */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {weeklyDefaults?.map((day) => (
          <Button
            key={day.day_of_week}
            onClick={() => handleDayClick(day)}
            variant="outline"
            className={`h-auto min-h-[80px] flex flex-col items-center justify-center gap-1 transition-all text-xs p-2 ${getDayColor(day.status)}`}
          >
            <span className="text-lg">{getStatusIcon(day.status)}</span>
            <span className="font-semibold text-xs">{getDayName(day.day_of_week)}</span>
            {day.status !== "closed" && (
              <div className="flex flex-col items-center text-[10px] opacity-80">
                {(day.status === "full_day" || day.status === "lunch_only") && day.lunch_start && (
                  <span>🍽️ {day.lunch_start?.slice(0,5)}-{day.lunch_end?.slice(0,5)}</span>
                )}
                {(day.status === "full_day" || day.status === "dinner_only") && day.dinner_start && (
                  <span>🌙 {day.dinner_start?.slice(0,5)}-{day.dinner_end?.slice(0,5)}</span>
                )}
              </div>
            )}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t("weeklySchedule.clickToConfig")}
      </p>

      {/* Modal d'edició */}
      {selectedDay && (
        <DayEditorDialog
          /* Remount per weekday. selectedDay changes without this component ever
             unmounting — it is never set back to null — so its useState initial
             values stay frozen at whichever weekday was opened FIRST. Clicking
             Monday, closing, then clicking Tuesday showed Monday's hours and
             Monday's slot caps, and saving wrote them onto Tuesday.

             Pre-existing for the hour fields; adding slot and deposit state made it
             a great deal more destructive. */
          key={selectedDay.day_of_week}
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
  // Slot caps and deposits for this weekday. Undefined stays undefined: sending a key
  // the user never touched would record this level as overriding it.
  const [dayRules, setDayRules] = useState<DayRulesValue>({
    slot_config: day.slot_config ?? null,
    payment_config: day.payment_config ?? null,
  });
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const {
    timeSlotsMode, fixedTimeSlotsLunch, fixedTimeSlotsDinner,
    paymentEnabled, getConfigNumber, getConfigValue,
  } = useRestaurantConfig();

  // Map day_of_week (0=Monday, 6=Sunday) to translation keys
  const getDayName = (dayOfWeek: number) => {
    const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    return tCommon(`days.${dayKeys[dayOfWeek]}`);
  };

  const handleSave = () => {
    // SEMPRE enviar TOTES les hores, independentment de l'estat
    const data: any = {
      status,
      lunch_start: lunchStart,
      lunch_end: lunchEnd,
      dinner_start: dinnerStart,
      dinner_end: dinnerEnd,
      // null clears the override so this weekday inherits global again — that is what
      // the reset control produces, and the backend treats null and {} differently.
      slot_config: dayRules.slot_config ?? null,
      payment_config: dayRules.payment_config ?? null,
    };

    onSave(data);
  };

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "closed": return "🔴 " + t("weeklySchedule.statusClosed");
      case "lunch_only": return "🟡 " + t("weeklySchedule.statusLunchOnly");
      case "dinner_only": return "🟡 " + t("weeklySchedule.statusDinnerOnly");
      case "full_day": return "🟢 " + t("weeklySchedule.statusFullDay");
      default: return value;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("weeklySchedule.configureAll", { day: getDayName(day.day_of_week).toLowerCase() })}
          </DialogTitle>
          <DialogDescription>
            {t("weeklySchedule.defaultScheduleDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">{t("weeklySchedule.restaurantStatus")}</Label>
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
              <Label className="text-base font-semibold">🍽️ {t("weeklySchedule.lunchSchedule")}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lunch-start">{t("weeklySchedule.openTime")}</Label>
                  <Input
                    id="lunch-start"
                    type="time"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunch-end">{t("weeklySchedule.closeTime")}</Label>
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
              <Label className="text-base font-semibold">🌙 {t("weeklySchedule.dinnerSchedule")}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dinner-start">{t("weeklySchedule.openTime")}</Label>
                  <Input
                    id="dinner-start"
                    type="time"
                    value={dinnerStart}
                    onChange={(e) => setDinnerStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinner-end">{t("weeklySchedule.closeTime")}</Label>
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
          {/* Slot caps and deposits for every Monday. Collapsed by default so someone
              who only came to change the hours never has to look at it. */}
          {status !== "closed" && (
            <DayRulesEditor
              value={dayRules}
              onChange={setDayRules}
              timeSlotsMode={timeSlotsMode}
              inheritedSlots={{
                lunch: fixedTimeSlotsLunch.split(",").map((x) => x.trim()).filter(Boolean),
                dinner: fixedTimeSlotsDinner.split(",").map((x) => x.trim()).filter(Boolean),
              }}
              /* Global config has a single deposit for the whole restaurant, so both
                 services legitimately inherit the same figure here. The per-service
                 shape matters one level down, where a weekday CAN differ. */
              inheritedPayment={(() => {
                const global = {
                  amount: getConfigNumber("payment_deposit_amount", 0),
                  minPeople: getConfigNumber("payment_min_people", 1),
                  currency: getConfigValue("payment_currency", "EUR"),
                };
                return { lunch: global, dinner: global };
              })()}
              paymentsAvailable={paymentEnabled}
              openServices={
                status === "lunch_only" ? ["lunch"]
                  : status === "dinner_only" ? ["dinner"]
                  : ["lunch", "dinner"]
              }
            />
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
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyScheduleManager;
