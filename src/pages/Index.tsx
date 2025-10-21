import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Users, UtensilsCrossed, Plus, LayoutGrid, Clock, FileImage, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import DayCalendar from "@/components/DayCalendar";
import OpeningHoursCalendar from "@/components/OpeningHoursCalendar";
import WeeklyScheduleManager from "@/components/WeeklyScheduleManager";
import TablesList from "@/components/TablesList";
import ReservationsList from "@/components/ReservationsList";
import CustomersList from "@/components/CustomersList";
import MediaManager from "@/components/MediaManager";
import StatsView from "@/components/StatsView";
import TableDialog from "@/components/TableDialog";
import ReservationDialog from "@/components/ReservationDialog";
import TableLayoutView from "@/components/TableLayoutView";
import { getAppointments } from "@/services/api";

const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("horario");

  // Obtenir reserves per calcular les d'avui
  const { data: allAppointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: getAppointments,
  });

  // Comptar reserves d'avui (confirmed + completed)
  const todayReservations = allAppointments?.filter((apt) => {
    if (apt.status !== 'confirmed' && apt.status !== 'completed') return false;
    try {
      const aptDate = new Date(apt.date);
      return isSameDay(aptDate, new Date());
    } catch {
      return false;
    }
  }).length || 0;

  // Nom restaurant
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-elegant">
              <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AMARU 
              </h1>
              <p className="text-muted-foreground">Sistema de gestión de reservas</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 1. Fecha Seleccionada */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Fecha Seleccionada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{format(selectedDate, "d 'de' MMMM", { locale: es })}</p>
            </CardContent>
          </Card>

          {/* 2. Acciones Rápidas - SOLO Nueva Reserva */}
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

          {/* 3. Reservas de Hoy */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-success" />
                Reservas de Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-primary">{todayReservations}</p>
                <p className="text-sm text-muted-foreground">
                  {todayReservations === 1 ? 'reserva' : 'reservas'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 max-w-6xl mx-auto">
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
          </TabsList>

          <TabsContent value="calendario" className="space-y-6">
            {/* Horaris per dia de la setmana */}
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

            {/* Calendari amb excepcions */}
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

          <TabsContent value="horario" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Horario del Día</CardTitle>
                <CardDescription>
                  Gestiona las reservas para {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
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

          <TabsContent value="layout" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <TableLayoutView />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Mesas</CardTitle>
                    <CardDescription>Administra las mesas del restaurante</CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingTable(null);
                    setTableDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Mesa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TablesList onEdit={(table) => {
                  setEditingTable(table);
                  setTableDialogOpen(true);
                }} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Reservas</CardTitle>
                    <CardDescription>Administra las reservas del restaurante</CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingReservation(null);
                    setReservationDialogOpen(true);
                  }}>
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

          <TabsContent value="customers" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Clientes</CardTitle>
                <CardDescription>Lista de clientes registrados y conversaciones</CardDescription>
              </CardHeader>
              <CardContent>
                <CustomersList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <MediaManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Estadísticas</CardTitle>
                <CardDescription>Visión general del rendimiento del restaurante</CardDescription>
              </CardHeader>
              <CardContent>
                <StatsView />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TableDialog 
        open={tableDialogOpen} 
        onOpenChange={(open) => {
          setTableDialogOpen(open);
          if (!open) setEditingTable(null);
        }}
        table={editingTable}
      />
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
