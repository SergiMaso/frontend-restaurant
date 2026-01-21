import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Key,
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
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import RestaurantSelector from "@/components/RestaurantSelector";
import LanguageSelector from "@/components/LanguageSelector";
import { getAppointments } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRestaurant } from "@/contexts/RestaurantContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("horario");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const { user, logout } = useAuth();
  const { selectedRestaurant, loading: restaurantLoading } = useRestaurant();
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();

  const restaurantName = selectedRestaurant?.name || tCommon("loading");

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

  const getRoleLabel = (role: string | undefined) => {
    if (!role) return "";
    return tCommon(`roles.${role}`);
  };

  const { data: allAppointments } = useQuery({
    queryKey: ["appointments", selectedRestaurant?.id],
    queryFn: getAppointments,
    enabled: !!selectedRestaurant,
  });

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

  if (restaurantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{tCommon("loading")}</p>
        </div>
      </div>
    );
  }

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
                  {t("header.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSelector />
              <RestaurantSelector />

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
                        {t("header.role")}: {getRoleLabel(user?.role)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setChangePasswordOpen(true)}
                    className="cursor-pointer"
                  >
                    <Key className="mr-2 h-4 w-4" />
                    <span>{t("userMenu.changePassword")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t("userMenu.logout")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <ChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Selected Date */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t("stats.selectedDate")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {format(selectedDate, "d MMMM yyyy", { locale: dateLocale })}
              </p>
            </CardContent>
          </Card>

          {/* Quick Action */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5 text-accent" />
                {t("stats.quickAction")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Button
                onClick={() => setReservationDialogOpen(true)}
                size="lg"
                className="w-full max-w-xs"
              >
                <Plus className="h-5 w-5 mr-2" />
                {t("stats.newReservation")}
              </Button>
            </CardContent>
          </Card>

          {/* Today's Reservations */}
          <Card className="border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-success" />
                {t("stats.todayReservations")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-primary">
                  {todayReservations}
                </p>
                <p className="text-sm text-muted-foreground">
                  {todayReservations === 1 ? t("stats.reservation") : t("stats.reservations")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="w-full max-w-6xl mx-auto overflow-x-auto">
            <TabsList className="inline-flex w-full flex-nowrap">
              <TabsTrigger value="calendario">
                <Calendar className="h-4 w-4 mr-2" />
                {t("tabs.calendar")}
              </TabsTrigger>
              <TabsTrigger value="horario">
                <Clock className="h-4 w-4 mr-2" />
                {t("tabs.schedule")}
              </TabsTrigger>
              <TabsTrigger value="layout">
                <LayoutGrid className="h-4 w-4 mr-2" />
                {t("tabs.layout")}
              </TabsTrigger>
              <TabsTrigger value="tables">{t("tabs.tables")}</TabsTrigger>
              <TabsTrigger value="reservations">{t("tabs.reservations")}</TabsTrigger>
              <TabsTrigger value="customers">
                <Users className="h-4 w-4 mr-2" />
                {t("tabs.customers")}
              </TabsTrigger>
              <TabsTrigger value="media">
                <FileImage className="h-4 w-4 mr-2" />
                {t("tabs.media")}
              </TabsTrigger>
              <TabsTrigger value="stats">
                <BarChart3 className="h-4 w-4 mr-2" />
                {t("tabs.stats")}
              </TabsTrigger>

              {(user?.role === "owner" || user?.role === "superadmin") && (
                <>
                  <TabsTrigger value="users">
                    <UserCog className="h-4 w-4 mr-2" />
                    {t("tabs.users")}
                  </TabsTrigger>
                  <TabsTrigger value="config">
                    <Settings className="h-4 w-4 mr-2" />
                    {t("tabs.config")}
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {/* CALENDAR TAB */}
          <TabsContent value="calendario" className="space-y-6">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>{t("calendarTab.weeklyConfig")}</CardTitle>
                <CardDescription>
                  {t("calendarTab.weeklyConfigDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyScheduleManager />
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>{t("calendarTab.calendarExceptions")}</CardTitle>
                <CardDescription>
                  {t("calendarTab.calendarExceptionsDesc")}
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

          {/* SCHEDULE TAB */}
          <TabsContent value="horario" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>{t("scheduleTab.title")}</CardTitle>
                <CardDescription>
                  {t("scheduleTab.description", {
                    date: format(selectedDate, "EEEE d MMMM", { locale: dateLocale })
                  })}
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

          {/* LAYOUT TAB */}
          <TabsContent value="layout" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <TableLayoutView />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TABLES TAB */}
          <TabsContent value="tables" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <div>
                  <CardTitle>{t("tablesTab.title")}</CardTitle>
                  <CardDescription>
                    {t("tablesTab.description")}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <TablesList />
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESERVATIONS TAB */}
          <TabsContent value="reservations" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t("reservationsTab.title")}</CardTitle>
                    <CardDescription>
                      {t("reservationsTab.description")}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingReservation(null);
                      setReservationDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("stats.newReservation")}
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

          {/* CUSTOMERS TAB */}
          <TabsContent value="customers" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>{t("customersTab.title")}</CardTitle>
                <CardDescription>
                  {t("customersTab.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomersList />
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIA TAB */}
          <TabsContent value="media" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <MediaManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader>
                <CardTitle>{t("statsTab.title")}</CardTitle>
                <CardDescription>
                  {t("statsTab.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatsView />
              </CardContent>
            </Card>
          </TabsContent>

          {/* OWNER / SUPERADMIN ONLY */}
          {(user?.role === "owner" || user?.role === "superadmin") && (
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
