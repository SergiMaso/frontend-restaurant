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
import { useTranslation } from "react-i18next";

interface RecurringHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecurringHoursDialog = ({ open, onOpenChange }: RecurringHoursDialogProps) => {
  const { t } = useTranslation();
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
      toast.success(t('recurringHours.saveSuccess', { count: response.days_updated }));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t('recurringHours.saveError', { message: error.message }));
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
        return t('recurringHours.closed');
      case "lunch_only":
        return t('recurringHours.lunchOnly');
      case "dinner_only":
        return t('recurringHours.dinnerOnly');
      case "full_day":
        return t('recurringHours.fullDay');
      default:
        return value;
    }
  };

  const getDayName = (value: string) => {
    const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    return t(`recurringHours.${daysKeys[parseInt(value)]}`).replace("📅 ", "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('recurringHours.title')}</DialogTitle>
          <DialogDescription>
            {t('recurringHours.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">{t('recurringHours.dayOfWeek')}</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('recurringHours.monday')}</SelectItem>
                <SelectItem value="1">{t('recurringHours.tuesday')}</SelectItem>
                <SelectItem value="2">{t('recurringHours.wednesday')}</SelectItem>
                <SelectItem value="3">{t('recurringHours.thursday')}</SelectItem>
                <SelectItem value="4">{t('recurringHours.friday')}</SelectItem>
                <SelectItem value="5">{t('recurringHours.saturday')}</SelectItem>
                <SelectItem value="6">{t('recurringHours.sunday')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="applyMonths">{t('recurringHours.applyDuring')}</Label>
            <Select value={applyMonths} onValueChange={setApplyMonths}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t('recurringHours.oneMonth')}</SelectItem>
                <SelectItem value="3">{t('recurringHours.threeMonths')}</SelectItem>
                <SelectItem value="6">{t('recurringHours.sixMonths')}</SelectItem>
                <SelectItem value="12">{t('recurringHours.oneYear')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('recurringHours.applyInfo', {
                day: getDayName(dayOfWeek).toLowerCase(),
                months: applyMonths,
                monthsLabel: parseInt(applyMonths) === 1 ? t('recurringHours.month') : t('recurringHours.months')
              })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('recurringHours.restaurantStatus')}</Label>
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

          {(status === "full_day" || status === "lunch_only") && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">{t('recurringHours.lunchSchedule')}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lunchStart">{t('recurringHours.opening')}</Label>
                  <Input
                    id="lunchStart"
                    type="time"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunchEnd">{t('recurringHours.closing')}</Label>
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

          {(status === "full_day" || status === "dinner_only") && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">{t('recurringHours.dinnerSchedule')}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dinnerStart">{t('recurringHours.opening')}</Label>
                  <Input
                    id="dinnerStart"
                    type="time"
                    value={dinnerStart}
                    onChange={(e) => setDinnerStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinnerEnd">{t('recurringHours.closing')}</Label>
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

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('recurringHours.warning')} <strong>{t('recurringHours.warningTitle')}</strong> {t('recurringHours.warningMessage', { day: getDayName(dayOfWeek).toLowerCase() })}
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('recurringHours.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('recurringHours.applying') : t('recurringHours.apply')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringHoursDialog;
