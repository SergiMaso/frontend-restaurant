import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Users, UtensilsCrossed, Plus, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DayCalendar from "@/components/DayCalendar";
import TablesList from "@/components/TablesList";
import ReservationsList from "@/components/ReservationsList";
import TableDialog from "@/components/TableDialog";
import ReservationDialog from "@/components/ReservationDialog";
import TableLayoutView from "@/components/TableLayoutView";

const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [editingReservation, setEditingReservation] = useState<any>(null);

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
                Gestión de Reservas
              </h1>
              <p className="text-muted-foreground">Sistema de gestión para tu restaurante</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Fecha Seleccionada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{format(selectedDate, "d 'de' MMMM", { locale: es })}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => setReservationDialogOpen(true)} className="flex-1" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Reserva
              </Button>
              <Button onClick={() => setTableDialogOpen(true)} variant="outline" className="flex-1" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Mesa
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-success" />
                Vista del Día
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gestiona mesas y reservas para hoy
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
            <TabsTrigger value="calendar">
              <Calendar className="h-4 w-4 mr-2" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="layout">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="tables">Mesas</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>Vista del Día</CardTitle>
                <CardDescription>
                  Gestiona las reservas para {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DayCalendar selectedDate={selectedDate} onDateChange={setSelectedDate} />
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
                  onEdit={(reservation) => {
                    setEditingReservation(reservation);
                    setReservationDialogOpen(true);
                  }}
                />
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
