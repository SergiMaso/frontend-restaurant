import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { getTables, createAppointment, updateAppointment, deleteAppointment } from "@/services/api";
import CustomerAutocomplete from "@/components/CustomerAutocomplete";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";
import { Checkbox } from "@/components/ui/checkbox";

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: any;
}

const ReservationDialog = ({ open, onOpenChange, reservation }: ReservationDialogProps) => {
  const queryClient = useQueryClient();
  const { maxPeoplePerBooking, defaultBookingDuration } = useRestaurantConfig();

  // DEBUG: Mostrar valors del hook
  console.log("🔍 [ReservationDialog] Valors del hook:", {
    maxPeoplePerBooking,
    defaultBookingDuration
  });

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [numPeople, setNumPeople] = useState("");
  const [reservationDate, setReservationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reservationTime, setReservationTime] = useState("20:00");
  const [endTime, setEndTime] = useState("");
  const [autoEndTime, setAutoEndTime] = useState(true);
  const [language, setLanguage] = useState("ca");
  const [selectedTableId, setSelectedTableId] = useState<string>("auto");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: tables } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  // Obtenir clients per autocompletat
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customers`);
      if (!response.ok) throw new Error('Error obtenint clients');
      return response.json();
    },
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
      console.log("📝 Carregant dades de la reserva:", {
        id: reservation.id,
        client_name: reservation.client_name,
        table_id: reservation.table_id,
        table_number: reservation.table_number
      });

      setClientName(reservation.client_name || "");
      setPhone(reservation.phone || "");
      setNumPeople(reservation.num_people?.toString() || "");
      setSelectedTableId(reservation.table_id ? reservation.table_id.toString() : "auto");
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
        selectedTableId: reservation.table_id ? reservation.table_id.toString() : "auto",
        date: reservationDate,
        time: reservationTime,
        endTime: reservation.end_time,
        language: reservation.language
      });
    } else {
      console.log("🆕 Nova reserva - resetejant camps");
      setClientName("");
      setPhone("");
      setNumPeople("");
      setSelectedTableId("auto");
      setReservationDate(format(new Date(), "yyyy-MM-dd"));
      setReservationTime("20:00");
      setEndTime("");
      setAutoEndTime(true);
      setLanguage("ca");
    }
  }, [reservation, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("🚀 Enviant petició:", data);
      
      if (reservation) {
        console.log(`📤 PUT /api/appointments/${reservation.id}`, data);
        return updateAppointment(reservation.id, data);
      } else {
        console.log("📤 POST /api/appointments", data);
        return createAppointment(data);
      }
    },
    onSuccess: (response) => {
      console.log("✅ Resposta del servidor:", response);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(reservation ? "Reserva actualizada correctamente" : "Reserva creada correctamente");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("❌ Error:", error);
      toast.error("Error: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Reserva eliminada correctamente");
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Error eliminando la reserva: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName || !phone || !numPeople) {
      toast.error("Por favor, completa todos los campos obligatorios");
      return;
    }

    const dataToSend: any = {
      client_name: clientName,
      phone: phone,
      date: reservationDate,
      time: reservationTime,
      num_people: parseInt(numPeople),
      language: language,
    };

    // Afegir end_time si està disponible
    if (endTime) {
      dataToSend.end_time = endTime;
    }

    if (selectedTableId && selectedTableId !== "auto") {
      dataToSend.table_id = parseInt(selectedTableId);
      console.log(`📍 Taula seleccionada: ${selectedTableId}`);
    } else {
      console.log("🔄 Assignació automàtica de taula");
    }

    console.log("📦 Dades finals a enviar:", dataToSend);
    updateMutation.mutate(dataToSend);
  };

  const handleDelete = () => {
    if (reservation) {
      deleteMutation.mutate(reservation.id);
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reservation ? "Editar Reserva" : "Nueva Reserva"}</DialogTitle>
            <DialogDescription>
              {reservation ? "Modifica los datos de la reserva" : "Añade una nueva reserva"}
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
                label="Nombre del Cliente"
                placeholder="Joan García"
                type="name"
                disabled={!!reservation}
                required
              />

              {/* Autocompletat per TELÈFON */}
              <CustomerAutocomplete
                customers={customers}
                value={phone}
                onChange={setPhone}
                onSelectCustomer={handleSelectCustomer}
                label="Teléfono"
                placeholder="+34 600 000 000"
                type="phone"
                disabled={!!reservation}
                required
              />

              <div className="space-y-2">
                <Label htmlFor="numPeople">
                  Número de Personas <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="numPeople"
                  type="number"
                  min="1"
                  max={maxPeoplePerBooking}
                  value={numPeople}
                  onChange={(e) => setNumPeople(e.target.value)}
                  placeholder="4"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reservationDate">
                  Fecha <span className="text-destructive">*</span>
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
                  Hora d'Inici <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reservationTime"
                  type="time"
                  value={reservationTime}
                  onChange={(e) => setReservationTime(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="endTime">Hora Final</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="autoEndTime"
                      checked={autoEndTime}
                      onCheckedChange={(checked) => setAutoEndTime(checked as boolean)}
                    />
                    <label
                      htmlFor="autoEndTime"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Automàtic
                    </label>
                  </div>
                </div>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={autoEndTime}
                  placeholder="22:00"
                />
                {autoEndTime && (
                  <p className="text-xs text-muted-foreground">
                    Duració automàtica: {defaultBookingDuration}h
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">
                  Idioma <span className="text-destructive">*</span>
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona idioma" />
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
                <Label htmlFor="tableId">
                  Mesa {reservation && reservation.table_number && `(actual: Mesa ${reservation.table_number})`}
                </Label>
                <Select 
                  value={selectedTableId} 
                  onValueChange={(value) => {
                    console.log("🎯 Taula seleccionada:", value);
                    setSelectedTableId(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Asignación automática" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático</SelectItem>
                    {tables?.filter(t => t.status === 'available').map((table) => (
                      <SelectItem key={table.id} value={table.id.toString()}>
                        Mesa {table.table_number} ({table.capacity} personas)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecciona "Automático" para asignar la mesa automáticamente.
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
                  Eliminar
                </Button>
              )}
              
              {/* Botons cancel·lar i guardar a la dreta */}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Guardando..." : reservation ? "Guardar Cambios" : "Crear Reserva"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diàleg de confirmació per eliminar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la reserva de{" "}
              <span className="font-semibold">{clientName}</span> para el{" "}
              <span className="font-semibold">{reservationDate}</span> a las{" "}
              <span className="font-semibold">{reservationTime}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReservationDialog;
