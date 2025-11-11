import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  Users,
  UtensilsCrossed,
  Plus,
  LayoutGrid,
  Clock,
  FileImage,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import DayCalendar from "@/components/DayCalendar";
import OpeningHoursCalendar from "@/components/OpeningHoursCalendar";
import WeeklyScheduleManager from "@/components/WeeklyScheduleManager";
import TablesList from "@/components/TablesList";
import ReservationsList from "@/components/ReservationsList";
import CustomersList from "@/components/CustomersList";
import MediaManager from "@/components/MediaManager";
import StatsView from "@/components/StatsView";
import UserManagement from "@/components/UserManagement";
import ClientConfigManager from "@/components/ClientConfigManager";
import ReservationDialog from "@/components/ReservationDialog";
import TableLayoutView from "@/components/TableLayoutView";
import { getAppointments } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";

const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("horario");

  const { user, logout } = useAuth();
  const { restaurantName } = useRestaurantConfig();

  // DEBUG: Mostrar nom del restaurant
  console.log("🔍 [Index] Nom del restaurant:", restaurantName);

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Obtenir reserves per calcular les d'avui
  const { data: allAppointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Comptar reserves d'avui (confirmed + completed)
  const todayReservations =
    allAppointments?.filter((apt: any) => {
      if (apt.status !== "confirmed" && apt.status !== "completed") return false;
      try {
        const aptDate = new Date(apt.date);
        return isSameDay(aptDate, new Date());
      } catch {
        return false;
      }
    }).length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-elegant">
                <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {restaurantName}
                </h1>
                <p className="text-muted-foreground">
                  Sistema de gestión de reservas
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user ? getInitials(user.full_name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.full_name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      Rol:{" "}
                      {user?.role === "owner"
                        ? "Propietari"
                        : user?.role === "admin"
                        ? "Administrador"
                        : "Personal"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Tancar Sessió</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Fecha Seleccionada */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Fecha Seleccionada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {format(selectedDate, "d 'de' MMMM", { locale: es })}
              </p>
            </CardContent>
          </Card>

          {/* Acción Rápida */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5 text-accent" />
                Acción Rápida
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Button
                onClick={() => setReservationDialogOpen(true)}
                size="lg"
                className="w-full max-w-xs"
              >
                <Plus className="h-5 w-5 mr-2" />
                Nueva Reserva
              </Button>
            </CardContent>
          </Card>

          {/* Reservas de Hoy */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-success" />
                Reservas de Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-primary">
                  {todayReservations}
                </p>
                <p className="text-sm text-muted-foreground">
                  {todayReservations === 1 ? "reserva" : "reservas"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList
            className={`grid w-full ${
              user?.role === "owner" ? "grid-cols-9" : "grid-cols-7"
            } max-w-6xl mx-auto`}
          >
            <TabsTrigger value="calendario">
              <Calendar className="h-4 w-4 mr-2" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="horario">
              <Clock className="h-4 w-4 mr-2" />
              Horario
            </TabsTrigger>
            <TabsTrigger value="layout">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="tables">Mesas</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="media">
              <FileImage className="h-4 w-4 mr-2" />
              Media
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="h-4 w-4 mr-2" />
              Estadísticas
            </TabsTrigger>

            {user?.role === "owner" && (
              <>
                <TabsTrigger value="users">
                  <UserCog className="h-4 w-4 mr-2" />
                  Usuarios
                </TabsTrigger>
                <TabsTrigger value="config">
                  <Settings className="h-4 w-4 mr-2" />
                  Config
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* CALENDARIO */}
          <TabsContent value="calendario" className="space-y-6">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Configuración Semanal</CardTitle>
                <CardDescription>
                  Define los horarios por defecto para cada día de la semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyScheduleManager />
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Calendario y Excepciones</CardTitle>
                <CardDescription>
                  Gestiona los horarios de apertura y visualiza las reservas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OpeningHoursCalendar
                  onViewDay={(date) => {
                    setSelectedDate(date);
                    setActiveTab("horario");
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* HORARIO */}
          <TabsContent value="horario" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Horario del Día</CardTitle>
                <CardDescription>
                  Gestiona las reservas para{" "}
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DayCalendar
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onEdit={(reservation) => {
                    setEditingReservation(reservation);
                    setReservationDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* LAYOUT */}
          <TabsContent value="layout" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <TableLayoutView />
              </CardContent>
            </Card>
          </TabsContent>

          {/* MESAS */}
          <TabsContent value="tables" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <div>
                  <CardTitle>Gestión de Mesas</CardTitle>
                  <CardDescription>
                    Administra las mesas del restaurante
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <TablesList />
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESERVAS */}
          <TabsContent value="reservations" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Reservas</CardTitle>
                    <CardDescription>
                      Administra las reservas del restaurante
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingReservation(null);
                      setReservationDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Reserva
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ReservationsList
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onEdit={(reservation) => {
                    setEditingReservation(reservation);
                    setReservationDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CLIENTES */}
          <TabsContent value="customers" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Clientes</CardTitle>
                <CardDescription>
                  Lista de clientes registrados y conversaciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomersList />
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIA */}
          <TabsContent value="media" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <MediaManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ESTADÍSTICAS */}
          <TabsContent value="stats" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Estadísticas</CardTitle>
                <CardDescription>
                  Visión general del rendimiento del restaurante
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatsView />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SOLO OWNER */}
          {user?.role === "owner" && (
            <>
              <TabsContent value="users" className="space-y-4">
                <UserManagement />
              </TabsContent>

              <TabsContent value="config" className="space-y-4">
                <ClientConfigManager />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* DIALOGS */}
      <ReservationDialog
        open={reservationDialogOpen}
        onOpenChange={(open) => {
          setReservationDialogOpen(open);
          if (!open) setEditingReservation(null);
        }}
        reservation={editingReservation}
      />
    </div>
  );
};

export default Index;
