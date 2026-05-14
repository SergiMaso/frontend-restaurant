import { useState, useEffect } from "react";
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
import { Trash2 } from "lucide-react";
import { format, addHours, parse } from "date-fns";
import { getTables, getCustomers, createAppointment, updateAppointment, deleteAppointment, updateCustomer } from "@/services/api";
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
  const [language, setLanguage] = useState("ca");
  const [areaPreference, setAreaPreference] = useState<"auto" | "inside" | "terrace">("auto");
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
      setLanguage(reservation.language || "ca");

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
      setLanguage("ca");
      setAreaPreference("auto");
    }
  }, [reservation, open, defaultTime, defaultTableId, defaultDate]);

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
    onSuccess: (response) => {
      console.log("✅ Resposta del servidor:", response);
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "appointments",
      });
      queryClient.invalidateQueries({ queryKey: customersKey });
      toast.success(reservation ? t("reservations.updateSuccess") : t("reservations.createSuccess"));
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

    if (!clientName || !phone || !numPeople) {
      toast.error(t("reservations.fillRequiredFields"));
      return;
    }
    const requestedPeople = Number.parseInt(numPeople, 10);
    if (!Number.isFinite(requestedPeople) || requestedPeople < 1) {
      toast.error(t("reservations.fillRequiredFields"));
      return;
    }

    const dataToSend: any = {
      client_name: clientName,
      phone: phone,
      date: reservationDate,
      time: reservationTime,
      num_people: requestedPeople,
      language: language,
      area_preference: areaPreference,
    };

    // IMPORTANT: Calcular duration_hours per al backend
    if (endTime && reservationTime) {
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
    // Si el client ja té idioma definit, el carreguem
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Autocompletat per NOM */}
              <CustomerAutocomplete
                customers={customers}
                value={clientName}
                onChange={setClientName}
                onSelectCustomer={handleSelectCustomer}
                label={t("reservations.customerName")}
                placeholder="Joan García"
                type="name"
                required
              />

              {/* Autocompletat per TELÈFON */}
              <CustomerAutocomplete
                customers={customers}
                value={phone}
                onChange={setPhone}
                onSelectCustomer={handleSelectCustomer}
                label={t("reservations.customerPhone")}
                placeholder="600 000 000"
                type="phone"
                required
                defaultCountry={defaultCountry}
              />

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

              <div className="space-y-2">
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
              </div>

              <div className="space-y-2">
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
              </div>

              <div className="space-y-2">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">
                  {t("reservations.language")} <span className="text-destructive">*</span>
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("reservations.selectLanguage")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ca">Català</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
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
              </div>

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
                    ?.slice()
                    .sort((a, b) => {
                      // 1. available before unavailable
                      if (a.status !== b.status) return a.status === "available" ? -1 : 1;
                      // 2. inside before terrace
                      const areaOrder = (area: string) => area === "terrace" ? 1 : 0;
                      if (a.area !== b.area) return areaOrder(a.area) - areaOrder(b.area);
                      // 3. table number ascending
                      return a.table_number - b.table_number;
                    })
                    .map((table) => {
                      const isTerrace = table.area === "terrace";
                      const isDisabled = table.status !== "available";
                      const isSelected = selectedTableIds.includes(table.id);
                      const areaSymbol = isTerrace ? "☀" : "⌂";
                      const tablePrefix = isDisabled ? `🚫${areaSymbol}` : areaSymbol;

                      const baseClass = isTerrace
                        ? "border-amber-200 bg-amber-50/60"
                        : "border-slate-200 bg-slate-50/50";
                      const disabledClass = isTerrace
                        ? "border-rose-300 bg-gradient-to-r from-rose-50 to-amber-50 text-rose-900"
                        : "border-rose-300 bg-rose-50/90 text-rose-900";
                      const selectedClass = isSelected
                        ? isTerrace
                          ? "ring-2 ring-amber-400 border-amber-400"
                          : "ring-2 ring-sky-400 border-sky-400"
                        : "";

                      return (
                        <label
                          key={table.id}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${isDisabled ? disabledClass : baseClass} ${selectedClass}`}
                        >
                          <span>
                            {tablePrefix} {tCommon("table")} {table.table_number} ({table.capacity} {t("tables.people")}) ·{" "}
                            <span className={isTerrace ? "text-amber-700 font-medium" : "text-slate-700 font-medium"}>
                              {table.area === "terrace" ? t("reservations.areaTerrace") : t("reservations.areaInside")}
                            </span>{" "}
                            · {isDisabled ? t("reservations.disabledManual") : table.status}
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
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? tCommon("saving") : reservation ? t("tables.saveChanges") : t("reservations.create")}
                </Button>
              </div>
            </div>
          </form>
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
