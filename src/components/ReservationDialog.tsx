import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Trash2, Loader2 } from "lucide-react";
import { format, addHours, parse } from "date-fns";
import { getTables, getCustomers, getAppointments, createAppointment, updateAppointment, deleteAppointment, updateCustomer, markAppointmentSeated } from "@/services/api";
import DeleteReservationDialog from "@/components/DeleteReservationDialog";
import CustomerAutocomplete from "@/components/CustomerAutocomplete";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";
import { useDefaultPhoneCountry } from "@/hooks/useDefaultPhoneCountry";
import { useTenantKey } from "@/hooks/useTenantKey";
import { Checkbox } from "@/components/ui/checkbox";

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: any;
  defaultTime?: string | null;
  defaultTableId?: number | null;
  defaultDate?: Date;
}

// Funció per generar time slots
const generateTimeSlots = (mode: string, intervalMinutes: number, fixedLunch: string, fixedDinner: string): string[] => {
  const slots: string[] = [];

  if (mode === 'fixed') {
    // Time slots fixos
    const lunchSlots = fixedLunch.split(',').map(s => s.trim()).filter(s => s);
    const dinnerSlots = fixedDinner.split(',').map(s => s.trim()).filter(s => s);
    return [...lunchSlots, ...dinnerSlots].sort();
  } else {
    // Time slots per intervals (de 12:00 a 23:45)
    for (let hour = 12; hour < 24; hour++) {
      for (let min = 0; min < 60; min += intervalMinutes) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  }
};

const ReservationDialog = ({ open, onOpenChange, reservation, defaultTime, defaultTableId, defaultDate }: ReservationDialogProps) => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const {
    maxPeoplePerBooking,
    defaultBookingDuration,
    timeSlotsMode,
    timeSlotIntervalMinutes,
    fixedTimeSlotsLunch,
    fixedTimeSlotsDinner,
    paymentEnabled,
    restaurantDefaultLanguage,
    isLoading: configLoading,
  } = useRestaurantConfig();
  const defaultCountry = useDefaultPhoneCountry();

  // Generar time slots disponibles
  const availableTimeSlots = generateTimeSlots(
    timeSlotsMode,
    timeSlotIntervalMinutes,
    fixedTimeSlotsLunch,
    fixedTimeSlotsDinner
  );

  // DEBUG: Mostrar valors del hook
  console.log("🔍 [ReservationDialog] Valors del hook:", {
    maxPeoplePerBooking,
    defaultBookingDuration,
    timeSlotsMode,
    availableTimeSlots: availableTimeSlots.length
  });

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [numPeople, setNumPeople] = useState("");
  const [reservationDate, setReservationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reservationTime, setReservationTime] = useState(availableTimeSlots[0] || "20:00");
  const [endTime, setEndTime] = useState("");
  const [autoEndTime, setAutoEndTime] = useState(true);
  const [language, setLanguage] = useState("");
  // Whether staff actually picked a language in this dialog session.
  //
  // On EDIT the field is only sent when this is true. Displaying a value is not
  // consent to write it: an old reservation can hold a stale language (the
  // customer has since switched, and save_customer_language updates only the
  // customer row), and the PUT cascades whatever it receives to BOTH the
  // appointment and the customer. Sending an untouched value would destroy the
  // newer preference. On CREATE we always send, since there is nothing to clobber
  // and the backend would otherwise fall back to 'es' rather than the
  // restaurant's configured language.
  const [languageTouched, setLanguageTouched] = useState(false);
  const [areaPreference, setAreaPreference] = useState<"auto" | "inside" | "terrace">("auto");
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInArea, setWalkInArea] = useState<"all" | "inside" | "terrace">("all");

  const tablesKey = useTenantKey(["tables"]);
  const customersKey = useTenantKey(["customers"]);

  const { data: tables } = useQuery({
    queryKey: tablesKey,
    queryFn: getTables,
  });

  // DEBUG: Mostrar taules disponibles
  console.log("🔍 [ReservationDialog] Taules disponibles:", {
    total: tables?.length || 0,
    available: tables?.filter(t => t.status === 'available').length || 0,
    tables: tables
  });

  // Obtenir clients per autocompletat
  const { data: customers } = useQuery({
    queryKey: customersKey,
    queryFn: getCustomers,
  });

  const appointmentsKey = useTenantKey(["appointments"]);
  const { data: todayAppointments } = useQuery({
    queryKey: appointmentsKey,
    queryFn: getAppointments,
    enabled: isWalkIn,
  });

  const busyTableIds = useMemo(() => {
    if (!isWalkIn || !todayAppointments) return new Set<number>();
    const now = new Date();
    const walkInEnd = new Date(now.getTime() + defaultBookingDuration * 60 * 60 * 1000);
    const todayStr = format(now, "yyyy-MM-dd");
    const occupied = new Set<number>();
    for (const appt of todayAppointments) {
      if (appt.date !== todayStr) continue;
      // Actually seated right now
      const isSeated = !!(appt.seated_at && !appt.left_at);
      // Has a confirmed reservation overlapping the walk-in window (now → now + defaultDuration)
      let overlaps = false;
      if (!isSeated && (appt.status === "confirmed" || appt.status === "pending_payment")) {
        try {
          const rStart = new Date(appt.start_time.split("+")[0].split("Z")[0]);
          const rEnd = new Date(appt.end_time.split("+")[0].split("Z")[0]);
          overlaps = rStart < walkInEnd && rEnd > now;
        } catch {}
      }
      if (isSeated || overlaps) {
        (appt.table_ids || (appt.table_id ? [appt.table_id] : [])).forEach((id: number) => occupied.add(id));
      }
    }
    return occupied;
  }, [isWalkIn, todayAppointments, defaultBookingDuration]);

  // Efecte per calcular automàticament l'hora final
  useEffect(() => {
    if (autoEndTime && reservationTime) {
      try {
        const startDate = parse(reservationTime, "HH:mm", new Date());
        const endDate = addHours(startDate, defaultBookingDuration);
        setEndTime(format(endDate, "HH:mm"));
      } catch (e) {
        console.error("Error calculant hora final:", e);
      }
    }
  }, [reservationTime, autoEndTime, defaultBookingDuration]);

  useEffect(() => {
    console.log("🔍 DEBUG: reservation changed:", reservation);

    if (reservation) {
      const currentTableIds =
        Array.isArray(reservation.table_ids) && reservation.table_ids.length > 0
          ? reservation.table_ids.map((id: number | string) => Number(id)).filter((id: number) => Number.isFinite(id))
          : (reservation.table_id ? [Number(reservation.table_id)] : []);

      console.log("📝 Carregant dades de la reserva:", {
        id: reservation.id,
        client_name: reservation.client_name,
        table_ids: currentTableIds,
        table_number: reservation.table_numbers || reservation.table_number
      });

      setClientName(reservation.client_name || "");
      setPhone(reservation.phone || "");
      setNumPeople(reservation.num_people?.toString() || "");
      setSelectedTableIds(currentTableIds);
      setAreaPreference((reservation.area_preference as "auto" | "inside" | "terrace") || "auto");
      // customer -> booking -> restaurant config. Never a hardcoded language.
      //
      // Customer first, deliberately: the booking's language is a snapshot from
      // when it was made and can only go stale, while the customer's record
      // self-corrects whenever they write. Every reservation edited via the
      // dashboard before 2026-07-31 also had 'ca' written onto it by the bug this
      // fixes, so preferring the booking would keep showing that wrong value.
      setLanguage(
        reservation.customer_language || reservation.language || restaurantDefaultLanguage
      );
      setLanguageTouched(false);

      if (reservation.date) {
        const date = new Date(reservation.date);
        setReservationDate(format(date, "yyyy-MM-dd"));
      }

      if (reservation.start_time) {
        try {
          const withoutTz = reservation.start_time.split('+')[0].split('Z')[0];
          const time = new Date(withoutTz);
          setReservationTime(format(time, "HH:mm"));
        } catch (e) {
          console.error("❌ Error parsing time:", e);
          setReservationTime("20:00");
        }
      }

      if (reservation.end_time) {
        try {
          const withoutTz = reservation.end_time.split('+')[0].split('Z')[0];
          const time = new Date(withoutTz);
          setEndTime(format(time, "HH:mm"));
          setAutoEndTime(false); // Si hi ha end_time manual, desactivem l'automàtic
        } catch (e) {
          console.error("❌ Error parsing end time:", e);
        }
      } else {
        setAutoEndTime(true);
      }

      console.log("✅ Valors carregats:", {
        selectedTableIds: currentTableIds,
        date: reservation.date,
        time: reservation.start_time,
        endTime: reservation.end_time,
        language: reservation.language
      });
    } else {
      console.log("🆕 Nova reserva - resetejant camps");
      setClientName("");
      setPhone("");
      setNumPeople("");
      setSelectedTableIds(defaultTableId ? [defaultTableId] : []);
      setReservationDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setReservationTime(defaultTime || "20:00");
      setEndTime("");
      setAutoEndTime(true);
      // New reservation, customer not yet known: the restaurant's configured
      // language, not a hardcoded "ca". If staff then pick an existing customer,
      // handleSelectCustomer overrides this with that customer's language.
      setLanguage(restaurantDefaultLanguage);
      setLanguageTouched(false);
      setAreaPreference("auto");
      setIsWalkIn(false);
      setWalkInArea("all");
    }
    // NOTE: restaurantDefaultLanguage is deliberately NOT a dependency here.
    // It arrives asynchronously (react-query), and adding it makes this whole
    // effect re-run when the config resolves — wiping name, phone, party size,
    // tables, date, time and languageTouched while staff are typing. The late
    // config is handled by the narrow effect below instead.
  }, [reservation, open, defaultTime, defaultTableId, defaultDate]);

  // Fill in the language only once, and only if nothing is set yet — covers the
  // dialog opening before the restaurant config query resolves. Never overwrites
  // a stored value or a staff selection, and touches no other field.
  useEffect(() => {
    if (!languageTouched && !language && restaurantDefaultLanguage) {
      setLanguage(restaurantDefaultLanguage);
    }
  }, [restaurantDefaultLanguage, languageTouched, language]);

  // The config is normally already cached, so the spinner below should never be
  // visible in practice. If it is, something is wrong (slow network, failing
  // /api/client-configs, cache miss) — say so, because the symptom otherwise is
  // just "the dialog feels stuck" with nothing to point at.
  useEffect(() => {
    if (!open || !configLoading) return;
    const timer = setTimeout(() => {
      console.warn(
        "[ReservationDialog] restaurant config still loading after 1s — " +
          "form is blocked until it arrives so the language field cannot show a wrong default."
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [open, configLoading]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("🚀 Enviant petició:", data);

      if (reservation) {
        // If staff changed the phone (or the name) on an existing reservation,
        // cascade the change at the customer level FIRST. The customer endpoint
        // updates appointments.phone + conversations.phone in the same transaction,
        // keeping everything consistent. Then we update the rest of the
        // appointment fields (date/time/people/etc).
        const originalPhone: string | undefined = reservation.phone;
        const originalName: string | undefined = reservation.client_name;
        const phoneChanged = originalPhone && data.phone && data.phone !== originalPhone;
        const nameChanged = originalName !== data.client_name;
        if (phoneChanged || (nameChanged && originalPhone)) {
          await updateCustomer(originalPhone!, {
            ...(phoneChanged ? { phone: data.phone } : {}),
            ...(nameChanged ? { name: data.client_name } : {}),
          } as any);
        }
        console.log(`📤 PUT /api/appointments/${reservation.id}`, data);
        return updateAppointment(reservation.id, data);
      } else {
        console.log("📤 POST /api/appointments", data);
        return createAppointment(data);
      }
    },
    onSuccess: async (response) => {
      console.log("✅ Resposta del servidor:", response);
      let seatingFailed = false;
      if (isWalkIn && response?.appointment_id) {
        try {
          await markAppointmentSeated(response.appointment_id);
        } catch (e) {
          console.error("Error marking walk-in as seated:", e);
          seatingFailed = true;
        }
      }
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "appointments",
      });
      queryClient.invalidateQueries({ queryKey: customersKey });
      if (seatingFailed) {
        toast.warning(t("reservations.walkInSeatingFailed"));
      } else {
        toast.success(reservation ? t("reservations.updateSuccess") : t("reservations.createSuccess"));
      }
      onOpenChange(false);
    },
    onError: (error: Error & { status?: number }) => {
      console.error("❌ Error:", error);
      if (error.status === 409) {
        toast.error(t("customers.phoneAlreadyExists"));
        return;
      }
      toast.error(tCommon("error") + ": " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, refund }: { id: number; refund: boolean }) => deleteAppointment(id, refund),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "appointments",
      });
      toast.success(t("reservations.deleteSuccess"));
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t("reservations.deleteError") + ": " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const now = new Date();
    const walkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const walkInName = "Walk-in";
    const walkInPhone = "walkin";

    if (isWalkIn) {
      if (!numPeople) {
        toast.error(t("reservations.fillRequiredFields"));
        return;
      }
    } else if (!clientName || !phone || !numPeople) {
      toast.error(t("reservations.fillRequiredFields"));
      return;
    }

    const requestedPeople = Number.parseInt(numPeople, 10);
    if (!Number.isFinite(requestedPeople) || requestedPeople < 1) {
      toast.error(t("reservations.fillRequiredFields"));
      return;
    }

    const dataToSend: any = {
      client_name: isWalkIn ? walkInName : clientName,
      phone: isWalkIn ? walkInPhone : phone,
      date: isWalkIn ? format(now, "yyyy-MM-dd") : reservationDate,
      time: isWalkIn ? walkInTime : reservationTime,
      num_people: requestedPeople,
      // CREATE: always send (nothing to clobber, and omitting would make the
      // backend fall back to 'es' instead of the restaurant's configured language).
      // EDIT: send only if staff actually changed the field — the PUT cascades
      // language to both the appointment and the customer, so an untouched stale
      // value would overwrite a newer customer preference.
      ...(!reservation || languageTouched ? { language } : {}),
      area_preference: isWalkIn ? (walkInArea === "all" ? "auto" : walkInArea) : areaPreference,
    };

    // IMPORTANT: Calcular duration_hours per al backend
    // Walk-ins always use the default duration — endTime/reservationTime are stale state values
    // unrelated to the actual walk-in start time and must not be used here.
    if (isWalkIn) {
      dataToSend.duration_hours = defaultBookingDuration;
    } else if (endTime && reservationTime) {
      try {
        // Parsejar les hores
        const [startHour, startMin] = reservationTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        // Calcular minuts totals
        const startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;

        // Si end_time és menor que start_time, assumim que és l'endemà
        if (endMinutes <= startMinutes) {
          endMinutes += 24 * 60;
        }

        // Calcular duració en hores (decimal)
        const durationHours = (endMinutes - startMinutes) / 60;

        dataToSend.duration_hours = durationHours;
        dataToSend.end_time = endTime;

        console.log(`⏱️  Duració calculada: ${durationHours} hores (${reservationTime} → ${endTime})`);
      } catch (e) {
        console.error("Error calculant duració:", e);
        // Si hi ha error, usar duració per defecte
        dataToSend.duration_hours = defaultBookingDuration;
      }
    } else {
      // Si no hi ha end_time, usar duració per defecte
      dataToSend.duration_hours = defaultBookingDuration;
      console.log(`⏱️  Usant duració per defecte: ${defaultBookingDuration} hores`);
    }

    if (selectedTableIds.length === 1) {
      dataToSend.table_id = selectedTableIds[0];
      console.log(`📍 Taula seleccionada: ${selectedTableIds[0]}`);
    } else if (selectedTableIds.length > 1) {
      dataToSend.table_ids = selectedTableIds;
      console.log(`📍 Taules seleccionades: ${selectedTableIds.join(", ")}`);
    } else {
      console.log("🔄 Assignació automàtica de taula");
    }

    if (isManualOverCapacity) {
      toast.warning(
        t("reservations.warningOverCapacity", { 
          people: parsedNumPeople, 
          seats: selectedManualCapacity, 
          over: overCapacityBy 
        })
      );
    }
    if (requestedPeople > maxPeoplePerBooking) {
      toast.warning(
        t("reservations.warningAboveConfiguredMax", {
          people: requestedPeople,
          max: maxPeoplePerBooking,
        })
      );
    }

    console.log("📦 Dades finals a enviar:", dataToSend);
    updateMutation.mutate(dataToSend);
  };

  const handleDelete = (refund: boolean) => {
    if (reservation) {
      deleteMutation.mutate({ id: reservation.id, refund });
    }
  };

  // Callback quan es selecciona un client de l'autocompletat
  const handleSelectCustomer = (customer: any) => {
    console.log("✅ Client seleccionat:", customer);
    setClientName(customer.name);
    setPhone(customer.phone);
    // A stored customer language is real evidence of what they speak, so it wins
    // over whatever is currently in the box.
    //
    // Only when they actually have one: falling back to restaurantDefaultLanguage
    // here would blank the field if the config is still loading, and could wipe a
    // language the staff member had already chosen.
    if (customer.language) {
      setLanguage(customer.language);
    }
  };

  const toggleTableSelection = (tableId: number, checked: boolean) => {
    setSelectedTableIds((prev) => {
      if (checked) {
        if (prev.includes(tableId)) return prev;
        return [...prev, tableId].sort((a, b) => a - b);
      }
      return prev.filter((id) => id !== tableId);
    });
  };

  const selectedManualCapacity = (tables || [])
    .filter((table) => selectedTableIds.includes(table.id))
    .reduce((sum, table) => sum + table.capacity, 0);
  const parsedNumPeople = Number.parseInt(numPeople || "0", 10) || 0;
  const isManualOverCapacity =
    selectedTableIds.length > 0 &&
    selectedManualCapacity > 0 &&
    parsedNumPeople > selectedManualCapacity;
  const overCapacityBy = isManualOverCapacity ? parsedNumPeople - selectedManualCapacity : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reservation ? t("reservations.edit") : t("reservations.create")}</DialogTitle>
            <DialogDescription>
              {reservation ? t("reservations.modifyReservation") : t("reservations.addNewReservation")}
            </DialogDescription>
          </DialogHeader>

          {/* The dialog opens immediately so the click always responds, but the
              form is withheld until the restaurant config has arrived. Otherwise
              the language field would render before its source is known and show
              a wrong default. In practice the config is cached and this never
              appears; if it lingers, the effect above logs why. */}
          {configLoading ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">{tCommon("loading", { defaultValue: "Loading…" })}</span>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!reservation && (
              <label className="flex items-center gap-2 cursor-pointer select-none rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={isWalkIn}
                  onCheckedChange={(checked) => setIsWalkIn(checked as boolean)}
                />
                🚶 {t("reservations.walkIn")}
                {isWalkIn && <span className="ml-auto text-xs text-muted-foreground">{t("reservations.walkInHint")}</span>}
              </label>
            )}

            {isWalkIn && (
              <div className="flex gap-2">
                {(["all", "inside", "terrace"] as const).map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setWalkInArea(area)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${walkInArea === area ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"}`}
                  >
                    {area === "all" ? `⌂☀ ${t("reservations.allTables")}` : area === "inside" ? `⌂ ${t("reservations.areaInside")}` : `☀ ${t("reservations.areaTerrace")}`}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Autocompletat per NOM */}
              {!isWalkIn && <CustomerAutocomplete
                customers={customers}
                value={clientName}
                onChange={setClientName}
                onSelectCustomer={handleSelectCustomer}
                label={t("reservations.customerName")}
                placeholder="Joan García"
                type="name"
                required
              />}

              {/* Autocompletat per TELÈFON */}
              {!isWalkIn && <CustomerAutocomplete
                customers={customers}
                value={phone}
                onChange={setPhone}
                onSelectCustomer={handleSelectCustomer}
                label={t("reservations.customerPhone")}
                placeholder="600 000 000"
                type="phone"
                required
                defaultCountry={defaultCountry}
              />}

              <div className="space-y-2">
                <Label htmlFor="numPeople">
                  {t("reservations.numPeople")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="numPeople"
                  type="number"
                  min="1"
                  value={numPeople}
                  onChange={(e) => setNumPeople(e.target.value)}
                  placeholder="4"
                  required
                />
                <p className={`text-xs ${parsedNumPeople > maxPeoplePerBooking ? "text-amber-700 font-medium" : "text-muted-foreground"}`}>
                  {t("reservations.configuredMax", { max: maxPeoplePerBooking })}
                  {parsedNumPeople > maxPeoplePerBooking
                    ? ` ${t("reservations.overrideActive", { people: parsedNumPeople })}`
                    : ""}
                </p>
              </div>

              {!isWalkIn && <div className="space-y-2">
                <Label htmlFor="reservationDate">
                  {t("reservations.date")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reservationDate"
                  type="date"
                  value={reservationDate}
                  onChange={(e) => setReservationDate(e.target.value)}
                  required
                />
              </div>}

              {!isWalkIn && <div className="space-y-2">
                <Label htmlFor="reservationTime">
                  {t("reservations.startTime")} <span className="text-destructive">*</span>
                </Label>
                <Select value={reservationTime} onValueChange={setReservationTime}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("reservations.selectTime")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>}

              {!isWalkIn && <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="endTime">{t("reservations.endTime")}</Label>
                  <Checkbox
                    id="autoEndTime"
                    checked={autoEndTime}
                    onCheckedChange={(checked) => setAutoEndTime(checked as boolean)}
                  />
                </div>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={autoEndTime}
                  placeholder="22:00"
                />
              </div>}

              {!isWalkIn && <div className="space-y-2">
                <Label htmlFor="language">
                  {t("reservations.language")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={language}
                  onValueChange={(v) => {
                    setLanguage(v);
                    setLanguageTouched(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("reservations.selectLanguage")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ca">🌍 Català</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                    <SelectItem value="pt">🇵🇹 Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>}

              {!isWalkIn && <div className="space-y-2">
                <Label htmlFor="areaPreference">{t("reservations.areaPreference")}</Label>
                <Select value={areaPreference} onValueChange={(value: "auto" | "inside" | "terrace") => setAreaPreference(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("reservations.areaAuto")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("reservations.areaAuto")}</SelectItem>
                    <SelectItem value="inside">{t("reservations.areaInside")}</SelectItem>
                    <SelectItem value="terrace">{t("reservations.areaTerrace")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>}

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tableSelection">
                    {t("reservations.table")} {reservation && (reservation.table_numbers || reservation.table_number) && t("reservations.currentTable", { number: reservation.table_numbers || reservation.table_number })}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTableIds([])}
                  >
                    {t("reservations.automatic")}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedTableIds.length > 0
                    ? t("reservations.manualTablesSelected", { tables: selectedTableIds.join(", ") })
                    : t("reservations.autoAssignHelp")}
                </div>
                {selectedTableIds.length > 0 && (
                  <div className={`text-xs ${isManualOverCapacity ? "text-amber-700 font-medium" : "text-muted-foreground"}`}>
                    {t("reservations.capacityCheck", { people: parsedNumPeople || 0, seats: selectedManualCapacity })}
                    {isManualOverCapacity ? ` ${t("reservations.overBy", { count: overCapacityBy })}` : ""}
                  </div>
                )}
                <div className="max-h-44 overflow-y-auto space-y-2 rounded-md border p-2">
                  <div className="flex flex-wrap gap-2 px-1 pb-1 text-[11px]">
                    <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">☀ {t("reservations.areaTerrace")}</span>
                    <span className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700">⌂ {t("reservations.areaInside")}</span>
                    <span className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-800">🚫 {t("reservations.disabledManual")}</span>
                  </div>
                  {tables
                    ?.filter((t) => !isWalkIn || walkInArea === "all" || t.area === walkInArea)
                    .slice()
                    .sort((a, b) => {
                      // 1. busy (currently occupied) last
                      const aBusy = isWalkIn && busyTableIds.has(a.id) ? 1 : 0;
                      const bBusy = isWalkIn && busyTableIds.has(b.id) ? 1 : 0;
                      if (aBusy !== bBusy) return aBusy - bBusy;
                      // 2. available before unavailable
                      if (a.status !== b.status) return a.status === "available" ? -1 : 1;
                      // 3. inside before terrace
                      const areaOrder = (area: string) => area === "terrace" ? 1 : 0;
                      if (a.area !== b.area) return areaOrder(a.area) - areaOrder(b.area);
                      // 4. table number ascending
                      return a.table_number - b.table_number;
                    })
                    .map((table) => {
                      const isTerrace = table.area === "terrace";
                      const isDisabled = table.status !== "available";
                      const isBusy = isWalkIn && busyTableIds.has(table.id);
                      const isSelected = selectedTableIds.includes(table.id);
                      const areaSymbol = isTerrace ? "☀" : "⌂";
                      const tablePrefix = isDisabled ? `🚫${areaSymbol}` : isBusy ? `🔴${areaSymbol}` : areaSymbol;

                      const baseClass = isTerrace
                        ? "border-amber-200 bg-amber-50/60"
                        : "border-slate-200 bg-slate-50/50";
                      const disabledClass = isTerrace
                        ? "border-rose-300 bg-gradient-to-r from-rose-50 to-amber-50 text-rose-900"
                        : "border-rose-300 bg-rose-50/90 text-rose-900";
                      const busyClass = "border-orange-300 bg-orange-50/80 text-orange-900";
                      const selectedClass = isSelected
                        ? isTerrace
                          ? "ring-2 ring-amber-400 border-amber-400"
                          : "ring-2 ring-sky-400 border-sky-400"
                        : "";

                      return (
                        <label
                          key={table.id}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${isDisabled ? disabledClass : isBusy ? busyClass : baseClass} ${selectedClass}`}
                        >
                          <span>
                            {tablePrefix} {tCommon("table")} {table.table_number} ({table.capacity} {t("tables.people")}) ·{" "}
                            <span className={isTerrace ? "text-amber-700 font-medium" : "text-slate-700 font-medium"}>
                              {table.area === "terrace" ? t("reservations.areaTerrace") : t("reservations.areaInside")}
                            </span>{" "}
                            · {isDisabled ? t("reservations.disabledManual") : isBusy ? t("reservations.tableBusy") : table.status}
                          </span>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleTableSelection(table.id, checked === true)}
                          />
                        </label>
                      );
                    })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("reservations.staffCanSelectTables")}
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-between pt-4">
              {/* Botó eliminar a l'esquerra (només si s'està editant) */}
              {reservation && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tCommon("delete")}
                </Button>
              )}

              {/* Botons cancel·lar i guardar a la dreta */}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon("cancel")}
                </Button>
                {/* Blocked while the restaurant config is loading: until it
                    arrives the language box can still be empty, and saving would
                    send language:"" — which the backend resolves to the customer's
                    language or a hardcoded "es", never the restaurant's. */}
                <Button type="submit" disabled={updateMutation.isPending || configLoading}>
                  {updateMutation.isPending ? tCommon("saving") : reservation ? t("tables.saveChanges") : t("reservations.create")}
                </Button>
              </div>
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Diàleg de confirmació per eliminar */}
      <DeleteReservationDialog
        open={deleteDialogOpen}
        appointmentId={reservation?.id ?? null}
        appointmentName={clientName}
        appointmentDate={reservationDate}
        appointmentTime={reservationTime}
        paymentEnabled={paymentEnabled}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
};

export default ReservationDialog;
