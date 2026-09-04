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
import { getTables, getCustomers, getAppointments, createAppointment, updateAppointment, deleteAppointment, updateCustomer, markAppointmentSeated, getPaymentTerms, getSlotCapacity, getTimeSlots } from "@/services/api";
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
  const configuredTimeSlots = generateTimeSlots(
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
    availableTimeSlots: configuredTimeSlots.length
  });

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [numPeople, setNumPeople] = useState("");
  const [reservationDate, setReservationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  // The configured list, not the day's: the day's sittings are fetched for a date that
  // does not exist yet at this point, and the effect below snaps the time onto them the
  // moment they arrive. Reaching for them here is a temporal dead zone — the whole
  // dialog throws before it renders, which no source-reading test can see.
  const [reservationTime, setReservationTime] = useState(configuredTimeSlots[0] || "20:00");
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

  // The sittings for the DATE, not the restaurant's global list. A date or weekday can
  // set its own, and the save resolves that cascade — so building the dropdown from the
  // global config listed times the save would reject and hid the ones it would accept.
  //
  // Only in fixed mode. Interval mode has no sitting list to resolve, and the grid
  // generated here covers hours staff are allowed to book outside opening times, so
  // replacing it would take something away.
  const { data: daySittings } = useQuery({
    queryKey: useTenantKey(["time-slots", reservationDate]),
    queryFn: () => getTimeSlots(reservationDate),
    enabled: open && timeSlotsMode === "fixed" && !!reservationDate,
    staleTime: 5 * 60 * 1000,
  });

  const availableTimeSlots =
    timeSlotsMode === "fixed" && daySittings?.slots?.length
      ? daySittings.slots
      : configuredTimeSlots;

  // Deposit controls. `depositTouched` keeps a staff-typed figure from being
  // overwritten when the suggested amount arrives or the date/time changes.
  const [askForDeposit, setAskForDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositTouched, setDepositTouched] = useState(false);
  const [walkInArea, setWalkInArea] = useState<"all" | "inside" | "terrace">("all");

  const tablesKey = useTenantKey(["tables"]);
  const customersKey = useTenantKey(["customers"]);

  const { data: tables } = useQuery({
    queryKey: tablesKey,
    queryFn: getTables,
  });

  // What the day's rules would charge for this booking. Only used to suggest a figure
  // and to decide whether the deposit controls exist at all — staff can type anything
  // over it. Editing an existing reservation is out of scope: this is for new bookings.
  // Walk-ins are excluded on purpose: the customer is already standing at the door,
  // so a deposit link they would have to open on their phone before being seated is
  // not a thing anyone wants. (They also compute their own time inside the submit
  // handler, which is not in scope here.)
  const peopleForTerms = Number.parseInt(numPeople, 10) || 1;
  const { data: paymentTerms } = useQuery({
    queryKey: useTenantKey([
      "payment-terms", reservationDate, reservationTime, String(peopleForTerms),
    ]),
    queryFn: () => getPaymentTerms(reservationDate, reservationTime, peopleForTerms),
    enabled: !reservation && !isWalkIn && open && !!reservationDate && !!reservationTime,
    staleTime: 60 * 1000,
  });

  // Staff bookings bypass the arrival cap on purpose — the phone rings, it is a
  // regular — so the create call will not refuse and there is nothing to react to
  // afterwards. This is the only moment the cap can be mentioned at all.
  //
  // A walk-in does NOT book reservationTime: the submit handler builds its own date and
  // time from the clock, so asking about reservationTime would warn about a slot the
  // booking never touches. Mirrored here, and re-read while the dialog sits open so a
  // walk-in typed at 13:29 and confirmed at 13:31 is judged on the right slot.
  const [walkInNow, setWalkInNow] = useState(() => new Date());
  useEffect(() => {
    if (!open || !isWalkIn) return;
    setWalkInNow(new Date());
    const tick = setInterval(() => setWalkInNow(new Date()), 60 * 1000);
    return () => clearInterval(tick);
  }, [open, isWalkIn]);

  const capDate = isWalkIn ? format(walkInNow, "yyyy-MM-dd") : reservationDate;
  const capTime = isWalkIn
    ? `${String(walkInNow.getHours()).padStart(2, "0")}:${String(walkInNow.getMinutes()).padStart(2, "0")}`
    : reservationTime;

  // What the save will use: an explicit end time when staff set one, otherwise the
  // restaurant's default. Previewing with the default while the booking carries its own
  // puts the warning and the booking on different lengths — and a longer table reaches a
  // sitting a shorter one does not.
  const capStayMinutes = (() => {
    if (autoEndTime || !endTime || !capTime) return undefined;
    const [startH, startM] = capTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    if ([startH, startM, endH, endM].some(Number.isNaN)) return undefined;
    const minutes = (endH * 60 + endM) - (startH * 60 + startM);
    return minutes > 0 ? minutes : undefined;
  })();

  const { data: slotCapacity } = useQuery({
    queryKey: useTenantKey([
      "slot-capacity", capDate, capTime, String(peopleForTerms),
      String(reservation?.id ?? ""), String(isWalkIn), String(capStayMinutes ?? ""),
    ]),
    queryFn: () => getSlotCapacity(capDate, capTime, peopleForTerms, reservation?.id,
                                   isWalkIn, capStayMinutes),
    enabled: open && !!capDate && !!capTime,
    staleTime: 30 * 1000,
  });

  // Only worth a word when this booking is the one going over. A slot that is merely
  // busy is the restaurant's normal state and saying so every time trains staff to
  // click past the warning that matters.
  const capWarning = (() => {
    if (!slotCapacity?.applies || slotCapacity.unavailable) return null;
    // A walk-in is moved onto a real sitting, so say where they are actually going —
    // staff are looking at 13:20 on screen and the booking will read 13:30.
    if (slotCapacity.snapped_from) {
      if (slotCapacity.overflow) {
        return t(
          "reservations.walkInSnappedOver",
          "S'apuntarà al torn de les {{slot}}, que quedarà {{n}} persones per sobre.",
        )
          .replace("{{slot}}", slotCapacity.assigned ?? capTime)
          .replace("{{n}}", String(slotCapacity.over_by ?? 0));
      }
      return t("reservations.walkInSnapped", "S'apuntarà al torn de les {{slot}}.")
        .replace("{{slot}}", slotCapacity.assigned ?? capTime);
    }

    // Said before the capacity messages because it is not a warning at all: the save
    // will fail. How full a sitting is has nothing to say about a time that is not one.
    if (slotCapacity.bookable === false) {
      return t(
        "reservations.capNotASitting",
        "Aquesta hora no és cap dels torns ({{sittings}}), i el sistema no la desarà.",
      ).replace("{{sittings}}", (slotCapacity.sittings || []).join(", "));
    }
    if (slotCapacity.overflow) {
      return t(
        "reservations.capOverflow",
        "Aquesta hora no és cap dels torns i cap dels dos del costat té lloc. Es pot fer, però el torn de les {{slot}} quedarà {{n}} persones per sobre.",
      )
        .replace("{{slot}}", slotCapacity.assigned ?? capTime)
        .replace("{{n}}", String(slotCapacity.over_by ?? 0));
    }
    if (slotCapacity.would_exceed) {
      const left = slotCapacity.remaining ?? 0;
      return t("reservations.capExceeded", "El torn de les {{slot}} només té {{left}} places lliures.")
        .replace("{{slot}}", slotCapacity.assigned ?? capTime)
        .replace("{{left}}", String(left));
    }
    return null;
  })();

  // Every deposit control hangs off this. Nothing about payments is rendered when the
  // restaurant has no Stripe set up — an unusable box invites staff to tick it and then
  // wonder why nothing happened.
  const depositAvailable = !isWalkIn && !reservation && !!paymentTerms?.payments_available;

  // Suggest the day's amount, but never overwrite a figure staff have typed.
  useEffect(() => {
    if (!depositAvailable || depositTouched) return;
    const suggested = paymentTerms?.amount_per_person;
    setDepositAmount(suggested != null && suggested > 0 ? String(suggested) : "");
    setAskForDeposit(!!paymentTerms?.would_apply);
  }, [depositAvailable, paymentTerms?.amount_per_person, paymentTerms?.would_apply, depositTouched]);

  // A fresh dialog starts from the day's rules again.
  useEffect(() => {
    if (!open) {
      setDepositTouched(false);
      setAskForDeposit(false);
      setDepositAmount("");
    }
  }, [open]);

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
      // The first slot the restaurant actually offers, not a hardcoded 20:00. In fixed
      // mode the dropdown lists only the configured sittings, so a restaurant whose
      // lunch is 13:00/14:30 opened this dialog showing a time absent from its own
      // list — and saving without touching it booked off-slot, which is precisely the
      // case the arrival cap then has to treat as a deliberate override.
      setReservationTime(defaultTime || availableTimeSlots[0] || "20:00");
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

  // The restaurant's config arrives asynchronously, and the reset above does not wait
  // for it: opening the dialog first computes availableTimeSlots from whatever the hook
  // returns while loading, so the time can settle on a provisional 12:00 (interval
  // default) or 20:00 and stay there once the real slots arrive. In fixed mode the
  // backend rejects any time outside the configured sittings, so that provisional value
  // is not merely odd — the save fails with "l'hora no està disponible".
  //
  // Only ever corrects a value the dropdown does not offer, so a time staff picked
  // themselves is never moved. Skipped when editing: an existing booking may sit on an
  // off-slot time from before the sittings were configured, and snapping it would
  // silently reschedule somebody.
  useEffect(() => {
    if (!open || reservation || configLoading) return;
    if (!availableTimeSlots.length) return;
    if (availableTimeSlots.includes(reservationTime)) return;
    setReservationTime(defaultTime || availableTimeSlots[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation, configLoading, availableTimeSlots.join(','), defaultTime]);

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
      } else if (response?.payment_error) {
        // The booking saved; only the deposit failed. Said explicitly and left on
        // screen, because "reservation created" alone would hide it and staff would
        // believe a deposit was requested when none was.
        toast.warning(
          t("reservations.createdButDepositFailed", { reason: response.payment_error }),
          { duration: 12000 },
        );
      } else if (response?.requires_payment) {
        toast.success(
          response.payment_link_sent
            ? t("reservations.depositLinkSent", {
                amount: response.payment_amount,
                currency: response.payment_currency,
              })
            // The link is real either way — staff can read it out — so this is a
            // warning, not an error, and it must not claim delivery.
            : t("reservations.depositLinkNotSent", { url: response.payment_short_url }),
          { duration: response.payment_link_sent ? 6000 : 20000 },
        );
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
      // Told explicitly rather than inferred from the "Walk-in" name and "walkin"
      // phone: the backend moves the arrival onto the nearest sitting, and deciding
      // that from a name a person could type themselves is not a rule anyone can rely
      // on. In fixed mode this is also what lets the booking through at all.
      ...(isWalkIn ? { walk_in: true } : {}),
    };

    // Only sent when the box is both available and ticked. The amount goes as typed;
    // the server refuses a blank or zero rather than reading it as "no deposit",
    // because ticking the box says a deposit IS wanted — unticking is how you say no.
    if (depositAvailable && askForDeposit) {
      dataToSend.send_payment_link = true;
      dataToSend.deposit_amount_per_person = Number.parseFloat(depositAmount);
    }

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

              {/* Deposit. Rendered ONLY when the restaurant can actually take one —
                  payments enabled AND Stripe onboarding finished. A box that cannot
                  work invites staff to tick it and then wonder why nothing happened. */}
              {depositAvailable && (
                <div className="w-full space-y-3 rounded-lg border border-border/50 p-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="ask-deposit"
                      checked={askForDeposit}
                      onCheckedChange={(checked) => {
                        setAskForDeposit(checked === true);
                        setDepositTouched(true);
                      }}
                    />
                    <Label htmlFor="ask-deposit" className="cursor-pointer">
                      {t("reservations.askForDeposit")}
                    </Label>
                  </div>

                  {askForDeposit && (
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount">
                        {t("reservations.depositPerPerson")}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="deposit-amount"
                          type="number"
                          /* Per person, but Stripe's floor applies to the TOTAL. A
                             per-person minimum of 0.50 keeps even a party of one above
                             it, so the server-side refusal stays unreachable in
                             practice. It remains as a backstop: the floor varies by
                             currency and the API can be called directly. */
                          min="0.50"
                          /* 0.01, not a coarser step: the input sits in a native form,
                             so the browser enforces step alignment and step="0.50"
                             would reject 10.10 or 18.75 with a stepMismatch — amounts
                             the backend explicitly accepts (two decimals, matching
                             DECIMAL(10,2)). The minimum is the guard here; the step is
                             only a spinner increment. */
                          step="0.01"
                          value={depositAmount}
                          onChange={(e) => {
                            setDepositAmount(e.target.value);
                            setDepositTouched(true);
                          }}
                          className="max-w-[140px]"
                        />
                        <span className="text-sm text-muted-foreground">
                          {paymentTerms?.currency || "EUR"}
                        </span>
                        {Number.parseFloat(depositAmount) > 0 && peopleForTerms > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {t("reservations.depositTotal", {
                              total: (Number.parseFloat(depositAmount) * peopleForTerms).toFixed(2),
                              currency: paymentTerms?.currency || "EUR",
                              people: peopleForTerms,
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("reservations.depositHelp")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Next to the confirm button on purpose: the cap does not block the
                  save, so this is information for the person about to click, not a
                  validation error. Worded as what it costs, never as a refusal. */}
              {capWarning && (
                <p
                  role="status"
                  className="text-sm text-amber-600 dark:text-amber-500 basis-full sm:basis-auto sm:mr-auto"
                >
                  ⚠️ {capWarning}
                </p>
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
