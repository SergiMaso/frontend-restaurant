import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Clock, Users, XCircle, TrendingUp, Award, AlertCircle, Calendar as CalendarIcon, User, Phone } from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { getGlobalStats, getCustomers } from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppointmentsQuery } from "@/hooks/useAppointmentsQuery";
import { useTenantKey } from "@/hooks/useTenantKey";

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

const StatsView = () => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { dateLocale } = useLanguage();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [filteredCustomersDropdown, setFilteredCustomersDropdown] = useState<any[]>([]);
  const customerInputRef = useRef<HTMLDivElement>(null);

  const { data: globalStats, isLoading: globalLoading } = useQuery({
    queryKey: useTenantKey(["globalStats"]),
    queryFn: getGlobalStats,
  });

  // Obtener todas las reservas para filtros
  const { data: allAppointments, isLoading: appointmentsLoading } = useAppointmentsQuery();

  const { data: customers } = useQuery({
    queryKey: useTenantKey(["customers"]),
    queryFn: getCustomers,
  });

  // Filtrar clients pel dropdown quan canvia el text
  useEffect(() => {
    if (!customerFilter || customerFilter.length < 2) {
      setFilteredCustomersDropdown([]);
      setCustomerDropdownOpen(false);
      return;
    }

    // Si ja hi ha un client seleccionat, no mostrar dropdown
    if (selectedCustomerPhone) {
      setCustomerDropdownOpen(false);
      return;
    }

    const query = customerFilter.toLowerCase().trim();
    
    const filtered = (customers || [])
      .filter((customer: any) => {
        if (customer.name === 'TEMP') return false;
        
        const cleanPhone = customer.phone.replace(/[\s-]/g, '');
        const cleanQuery = query.replace(/[\s-]/g, '');
        
        return customer.name.toLowerCase().includes(query) || 
               cleanPhone.includes(cleanQuery);
      })
      .slice(0, 5);

    setFilteredCustomersDropdown(filtered);
    setCustomerDropdownOpen(filtered.length > 0);
  }, [customerFilter, customers, selectedCustomerPhone]);

  // Tancar dropdown quan es fa clic fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerInputRef.current && !customerInputRef.current.contains(event.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calcular rango de fechas según filtro
  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (timeFilter) {
      case 'today': {
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date(now);
        endToday.setHours(23, 59, 59, 999);
        return { start: startToday, end: endToday };
      }
      case 'week':
        return { start: startOfWeek(now, { locale: dateLocale }), end: endOfWeek(now, { locale: dateLocale }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        if (dateRange.from && dateRange.to) {
          return { start: dateRange.from, end: dateRange.to };
        }
        return null;
      default:
        return null;
    }
  }, [timeFilter, dateRange, dateLocale]);

  // Filtrar appointments
  const filteredAppointments = useMemo(() => {
    if (!allAppointments) return [];

    // Keep no_show appointments for stats, only filter cancelled
    let filtered = allAppointments.filter((apt: any) => apt.status !== 'cancelled');

    // Filtro temporal
    const range = getDateRange();
    if (range) {
      filtered = filtered.filter((apt: any) => {
        try {
          const aptDate = parseISO(apt.date);
          return isWithinInterval(aptDate, range);
        } catch {
          return false;
        }
      });
    }

    // Filtro por cliente - MODIFICAT per usar el telèfon si està seleccionat
    if (selectedCustomerPhone) {
      // Si hi ha un client seleccionat, filtrar només per telèfon
      filtered = filtered.filter((apt: any) => apt.phone === selectedCustomerPhone);
    } else if (customerFilter.trim()) {
      // Si només hi ha text escrit (sense seleccionar), buscar per nom o telèfon
      const query = customerFilter.toLowerCase();
      filtered = filtered.filter((apt: any) => 
        apt.client_name?.toLowerCase().includes(query) ||
        apt.phone?.includes(query)
      );
    }

    return filtered;
  }, [allAppointments, getDateRange, selectedCustomerPhone, customerFilter]);

  // Calcular estadísticas filtradas
  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    // Helper to check if appointment is truly completed
    // Must have left_at to be considered finished (customer left the restaurant)
    const isCompleted = (apt: any) => {
      return !!apt.left_at;
    };

    // Helper to check if delay was actually recorded
    // Delay is only meaningful if seated_at exists (calculated from actual arrival)
    const hasActualDelay = (apt: any) => {
      return !!apt.seated_at;
    };

    // Only count appointments where customer has left (left_at exists)
    const completed = filteredAppointments.filter((apt: any) => {
      const aptDate = parseISO(apt.date);
      return isCompleted(apt) && !apt.no_show && aptDate <= now;
    });
    const noShows = filteredAppointments.filter((apt: any) => apt.no_show);

    // Only include completed appointments with ACTUAL recorded delay
    const withDelay = filteredAppointments.filter((apt: any) => {
      const aptDate = parseISO(apt.date);
      return hasActualDelay(apt) && !apt.no_show && aptDate <= now;
    });

    // Calcular retrasos (negative delays = early arrival, count as 0)
    const delays = withDelay.map((apt: any) => Math.max(0, apt.delay_minutes || 0));
    const avgDelay = delays.length > 0
      ? Math.round(delays.reduce((sum, d) => sum + d, 0) / delays.length)
      : 0;

    const avgDuration = completed.length > 0
      ? Math.round(completed.reduce((sum: number, apt: any) => sum + (apt.duration_minutes || 0), 0) / completed.length)
      : 0;

    const minDuration = completed.length > 0
      ? Math.min(...completed.map((apt: any) => apt.duration_minutes || 0))
      : 0;

    const maxDuration = completed.length > 0
      ? Math.max(...completed.map((apt: any) => apt.duration_minutes || 0))
      : 0;

    // Top customers del periodo filtrado
    const customerStats = new Map();
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    filteredAppointments.forEach((apt: any) => {
      if (!apt.phone) return;
      if (!customerStats.has(apt.phone)) {
        customerStats.set(apt.phone, {
          name: apt.client_name,
          phone: apt.phone,
          visits: 0,
          no_shows: 0,
          durations: [],
        });
      }
      const custStats = customerStats.get(apt.phone);
      const aptDate = parseISO(apt.date);

      if (apt.no_show) {
        custStats.no_shows++;
      } else if (isCompleted(apt) && aptDate <= today) {
        // Only count as visit if customer has left (left_at exists) and is in the past/today
        custStats.visits++;
        if (apt.duration_minutes) {
          custStats.durations.push(apt.duration_minutes);
        }
      }
    });

    const topCustomers = Array.from(customerStats.values())
      .map((c: any) => ({
        ...c,
        avg_duration: c.durations.length > 0 
          ? Math.round(c.durations.reduce((sum: number, d: number) => sum + d, 0) / c.durations.length)
          : null,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    return {
      avg_duration: avgDuration,
      min_duration: minDuration,
      max_duration: maxDuration,
      total_completed: completed.length,
      total_no_shows: noShows.length,
      avg_delay: avgDelay,
      total_with_delay: delays.length,
      top_customers: topCustomers,
    };
  }, [filteredAppointments]);

  const getFilterLabel = () => {
    switch (timeFilter) {
      case 'today': return t("stats.today");
      case 'week': return t("stats.thisWeek");
      case 'month': return t("stats.thisMonth");
      case 'year': return t("stats.thisYear");
      case 'custom':
        if (dateRange.from && dateRange.to) {
          return `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}`;
        }
        return t("stats.customRange");
      default: return t("stats.allTime");
    }
  };

  const handleSelectCustomer = (customer: any) => {
    console.log("✅ Client seleccionat per estadístiques:", customer);
    setCustomerFilter(`${customer.name} (${customer.phone})`);
    setSelectedCustomerPhone(customer.phone);
    setCustomerDropdownOpen(false);
  };

  const handleClearFilters = () => {
    setTimeFilter('all');
    setCustomerFilter('');
    setSelectedCustomerPhone(null);
    setDateRange({});
  };

  if (globalLoading || appointmentsLoading) {
    return <div className="text-center py-8 text-muted-foreground">{tCommon("loading")}</div>;
  }

  if (!stats) {
    return <div className="text-center py-8 text-muted-foreground">{t("stats.noData")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
            <SelectTrigger>
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t("stats.timePeriod")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("stats.allTime")}</SelectItem>
              <SelectItem value="today">{t("stats.today")}</SelectItem>
              <SelectItem value="week">{t("stats.thisWeek")}</SelectItem>
              <SelectItem value="month">{t("stats.thisMonth")}</SelectItem>
              <SelectItem value="year">{t("stats.thisYear")}</SelectItem>
              <SelectItem value="custom">{t("stats.customRange")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {timeFilter === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
                ) : (
                  t("stats.selectRange")
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range: any) => setDateRange(range || {})}
                locale={dateLocale}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Campo de búsqueda de cliente con autocompletar */}
        <div className="flex-1 relative" ref={customerInputRef}>
          <Input
            type="text"
            placeholder={t("stats.searchCustomer")}
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              // Si l'usuari esborra el text, netegem la selecció
              if (e.target.value === '') {
                setSelectedCustomerPhone(null);
              }
            }}
            onFocus={() => {
              if (customerFilter.length >= 2 && filteredCustomersDropdown.length > 0 && !selectedCustomerPhone) {
                setCustomerDropdownOpen(true);
              }
            }}
            className="w-full"
          />
          
          {/* Dropdown de resultats */}
          {customerDropdownOpen && filteredCustomersDropdown.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {filteredCustomersDropdown.map((customer) => (
                      <CommandItem
                        key={customer.phone}
                        value={customer.phone}
                        onSelect={() => handleSelectCustomer(customer)}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-medium">{customer.name}</span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>

        {(timeFilter !== 'all' || customerFilter) && (
          <Button
            variant="outline"
            onClick={handleClearFilters}
          >
            {t("stats.clearFilters")}
          </Button>
        )}
      </div>

      {/* Indicador de filtro activo */}
      {(timeFilter !== 'all' || customerFilter) && (
        <Badge variant="secondary" className="text-sm">
          {t("stats.showingData")}: {getFilterLabel()}
          {customerFilter && ` | ${t("stats.customer")}: "${customerFilter}"`}
        </Badge>
      )}

      {/* Cards de métricas principales - TODOS EN UNA FILA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              {t("stats.avgDuration")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_duration} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.min")}: {stats.min_duration} | {t("stats.max")}: {stats.max_duration}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              {t("stats.avgDelay")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avg_delay > 0 ? '+' : ''}{stats.avg_delay || 0} min
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.analyzed", { count: stats.total_with_delay || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              {t("stats.completedVisits")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_completed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.withTimeRecorded")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              {t("stats.noShows")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_no_shows}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.totalRecorded")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              {t("stats.attendanceRate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_completed + stats.total_no_shows > 0
                ? Math.round((stats.total_completed / (stats.total_completed + stats.total_no_shows)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.customersThatCame")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {t("stats.topCustomers")}
          </CardTitle>
          <CardDescription>{t("stats.topCustomersDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.top_customers && stats.top_customers.length > 0 ? (
              stats.top_customers.map((customer: any, index: number) => (
                <div
                  key={customer.phone}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">{customer.phone}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {customer.avg_duration && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {customer.avg_duration} min
                      </Badge>
                    )}
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {customer.visits} {t("stats.visits")}
                    </Badge>
                    {customer.no_shows > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {customer.no_shows}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t("stats.noCustomerData")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsView;
