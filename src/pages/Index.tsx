import { Suspense, lazy, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format, isSameDay, addDays, subDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
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
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  CreditCard,
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
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import RestaurantSelector from "@/components/RestaurantSelector";
import LanguageSelector from "@/components/LanguageSelector";
import { useAppointmentsQuery } from "@/hooks/useAppointmentsQuery";
import { useRestaurantConfig } from "@/hooks/useRestaurantConfig";
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

const DayCalendar = lazy(() => import("@/components/DayCalendar"));
const OpeningHoursCalendar = lazy(() => import("@/components/OpeningHoursCalendar"));
const WeeklyScheduleManager = lazy(() => import("@/components/WeeklyScheduleManager"));
const TablesList = lazy(() => import("@/components/TablesList"));
const ReservationsList = lazy(() => import("@/components/ReservationsList"));
const CustomersList = lazy(() => import("@/components/CustomersList"));
const MediaManager = lazy(() => import("@/components/MediaManager"));
const StatsView = lazy(() => import("@/components/StatsView"));
const UserManagement = lazy(() => import("@/components/UserManagement"));
const ClientConfigManager = lazy(() => import("@/components/ClientConfigManager"));
const PaymentsPage = lazy(() => import("@/components/PaymentsPage"));
const ReservationDialog = lazy(() => import("@/components/ReservationDialog"));
const TableLayoutView = lazy(() => import("@/components/TableLayoutView"));

const Index = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("horario");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [scheduleFullscreen, setScheduleFullscreen] = useState(false);
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  const [prefilledTableId, setPrefilledTableId] = useState<number | null>(null);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isOnline = useOnlineStatus();
  const { user, logout } = useAuth();
  const { selectedRestaurant, loading: restaurantLoading } = useRestaurant();
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();

  const restaurantName = selectedRestaurant?.name || tCommon("loading");
  const lazyContentFallback = (
    <div className="py-8 text-center text-muted-foreground">{tCommon("loading")}</div>
  );

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

  const { paymentEnabled } = useRestaurantConfig();
  const { data: allAppointments } = useAppointmentsQuery();

  // Handle Stripe Connect onboarding redirect
  useEffect(() => {
    const stripe = searchParams.get("stripe");
    if (!stripe) return;
    if (stripe === "success") {
      setActiveTab("config");
      toast.success(t("payments.stripeConnect.connected"), {
        description: t("payments.stripeConnect.connectSuccess"),
      });
    } else if (stripe === "refresh") {
      setActiveTab("config");
      toast.info(t("payments.stripeConnect.onboardingIncomplete"), {
        description: t("payments.stripeConnect.continueOnboarding"),
      });
    }
    // Clean the query param from the URL
    navigate("/", { replace: true });
  }, []);

  const selectedDateReservations =
    allAppointments?.filter((apt: any) => {
      if (apt.status !== "confirmed" && apt.status !== "completed") return false;
      try {
        const aptDate = new Date(apt.date);
        return isSameDay(aptDate, selectedDate);
      } catch {
        return false;
      }
    }).length || 0;

  const isToday = isSameDay(selectedDate, new Date());

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
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>{t("offline.banner")}</span>
        </div>
      )}

      <div className="container mx-auto p-3 md:p-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg overflow-hidden shadow-elegant">
                <img src="/logo.svg" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {restaurantName}
                </h1>
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

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="w-full overflow-x-auto scrollbar-hide -mx-3 px-3">
            <TabsList className="inline-flex w-max min-w-full">
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
                  {paymentEnabled && (
                    <TabsTrigger value="payments">
                      <CreditCard className="h-4 w-4 mr-2" />
                      {t("tabs.payments")}
                    </TabsTrigger>
                  )}
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
            <Suspense fallback={lazyContentFallback}>
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
            </Suspense>
          </TabsContent>

          {/* SCHEDULE TAB */}
          <TabsContent value="horario" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {/* Left: Date and reservations count */}
                  <div>
                    <h2 className="text-lg font-semibold capitalize">
                      {format(selectedDate, "EEEE, d MMMM yyyy", { locale: dateLocale })}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedDateReservations} {selectedDateReservations === 1 ? t("stats.reservation") : t("stats.reservations")}
                    </p>
                  </div>

                  {/* Center: New Reservation + Fullscreen buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setEditingReservation(null);
                        setPrefilledTime(null);
                        setPrefilledTableId(null);
                        setReservationDialogOpen(true);
                      }}
                      disabled={!isOnline}
                      title={!isOnline ? t("offline.actionDisabled") : undefined}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t("stats.newReservation")}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setScheduleFullscreen(true)}
                      title={t("layout.fullscreen")}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Right: Date navigation */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("calendar.previousMonth").split(' ')[0]}
                    </Button>
                    <Button
                      variant={isToday ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDate(new Date())}
                    >
                      {t("calendar.today")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                    >
                      {t("calendar.nextMonth").split(' ')[0]}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Suspense fallback={lazyContentFallback}>
                  <DayCalendar
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onEdit={(reservation) => {
                      setEditingReservation(reservation);
                      setReservationDialogOpen(true);
                    }}
                  />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LAYOUT TAB */}
          <TabsContent value="layout" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <Suspense fallback={lazyContentFallback}>
                  <TableLayoutView />
                </Suspense>
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
                <Suspense fallback={lazyContentFallback}>
                  <TablesList />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESERVATIONS TAB */}
          <TabsContent value="reservations" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {/* Left: Title and description */}
                  <div>
                    <CardTitle>{t("reservationsTab.title")}</CardTitle>
                    <CardDescription>
                      {t("reservationsTab.description")}
                    </CardDescription>
                  </div>

                  {/* Center: New Reservation button */}
                  <Button
                    onClick={() => {
                      setEditingReservation(null);
                      setPrefilledTime(null);
                      setPrefilledTableId(null);
                      setReservationDialogOpen(true);
                    }}
                    disabled={!isOnline}
                    title={!isOnline ? t("offline.actionDisabled") : undefined}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("stats.newReservation")}
                  </Button>

                  {/* Right: Date and navigation */}
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-medium capitalize">
                      {format(selectedDate, "EEEE, d MMMM", { locale: dateLocale })}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {t("calendar.previousMonth").split(' ')[0]}
                      </Button>
                      <Button
                        variant={isToday ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedDate(new Date())}
                      >
                        {t("calendar.today")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                      >
                        {t("calendar.nextMonth").split(' ')[0]}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Suspense fallback={lazyContentFallback}>
                  <ReservationsList
                    selectedDate={selectedDate}
                    onEdit={(reservation) => {
                      setEditingReservation(reservation);
                      setReservationDialogOpen(true);
                    }}
                  />
                </Suspense>
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
                <Suspense fallback={lazyContentFallback}>
                  <CustomersList />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIA TAB */}
          <TabsContent value="media" className="space-y-4">
            <Card className="border-border/50 shadow-card">
              <CardContent className="pt-6">
                <Suspense fallback={lazyContentFallback}>
                  <MediaManager />
                </Suspense>
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
                <Suspense fallback={lazyContentFallback}>
                  <StatsView />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OWNER / SUPERADMIN ONLY */}
          {(user?.role === "owner" || user?.role === "superadmin") && (
            <>
              {paymentEnabled && (
                <TabsContent value="payments" className="space-y-4">
                  <Card className="border-border/50 shadow-card">
                    <CardHeader>
                      <CardTitle>{t("paymentsTab.title")}</CardTitle>
                      <CardDescription>{t("paymentsTab.description")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PaymentsPage />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="users" className="space-y-4">
                <Suspense fallback={lazyContentFallback}>
                  <UserManagement />
                </Suspense>
              </TabsContent>

              <TabsContent value="config" className="space-y-4">
                <Suspense fallback={lazyContentFallback}>
                  <ClientConfigManager />
                </Suspense>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* DIALOGS */}
      {reservationDialogOpen && (
        <Suspense fallback={lazyContentFallback}>
          <ReservationDialog
            open={reservationDialogOpen}
            onOpenChange={(open) => {
              setReservationDialogOpen(open);
              if (!open) {
                setEditingReservation(null);
                setPrefilledTime(null);
                setPrefilledTableId(null);
              }
            }}
            reservation={editingReservation}
            defaultTime={prefilledTime}
            defaultTableId={prefilledTableId}
            defaultDate={selectedDate}
          />
        </Suspense>
      )}

      {/* Fullscreen Schedule Overlay */}
      {scheduleFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-full flex flex-col">
            {/* Fullscreen Header */}
            <div className="flex items-center justify-between p-3 border-b">
              <div>
                <h2 className="text-lg font-semibold capitalize">
                  {format(selectedDate, "EEEE, d MMMM yyyy", { locale: dateLocale })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("scheduleTab.fullscreenHint")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("calendar.previousMonth").split(' ')[0]}
                </Button>
                <Button
                  variant={isToday ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  {t("calendar.today")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                >
                  {t("calendar.nextMonth").split(' ')[0]}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setScheduleFullscreen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Fullscreen Grid */}
            <div className="flex-1 overflow-auto p-3">
              <Suspense fallback={lazyContentFallback}>
                <DayCalendar
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onEdit={(reservation) => {
                    setEditingReservation(reservation);
                    setReservationDialogOpen(true);
                  }}
                  isFullscreen={true}
                  onSlotClick={(time, tableId) => {
                    if (isOnline) {
                      setPrefilledTime(time);
                      setPrefilledTableId(tableId);
                      setEditingReservation(null);
                      setReservationDialogOpen(true);
                    }
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
