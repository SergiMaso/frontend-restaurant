import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Clock, Users, XCircle, TrendingUp, Award, AlertCircle, Calendar as CalendarIcon, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

const StatsView = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const { data: globalStats, isLoading: globalLoading } = useQuery({
    queryKey: ["globalStats"],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/stats/global`);
      if (!response.ok) throw new Error('Error obteniendo estadísticas');
      return response.json();
    },
  });

  // Obtener todas las reservas para filtros
  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/appointments`);
      if (!response.ok) throw new Error('Error obteniendo reservas');
      return response.json();
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customers`);
      if (!response.ok) throw new Error('Error obteniendo clientes');
      return response.json();
    },
  });

  // Calcular rango de fechas según filtro
  const getDateRange = () => {
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date(now);
        endToday.setHours(23, 59, 59, 999);
        return { start: startToday, end: endToday };
      case 'week':
        return { start: startOfWeek(now, { locale: es }), end: endOfWeek(now, { locale: es }) };
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
  };

  // Filtrar appointments
  const filteredAppointments = useMemo(() => {
    if (!allAppointments) return [];

    let filtered = allAppointments.filter((apt: any) => apt.status !== 'cancelled' && apt.status !== 'no_show');

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

    // Filtro por cliente
    if (customerFilter.trim()) {
      const query = customerFilter.toLowerCase();
      filtered = filtered.filter((apt: any) => 
        apt.client_name?.toLowerCase().includes(query) ||
        apt.phone?.includes(query)
      );
    }

    return filtered;
  }, [allAppointments, timeFilter, customerFilter, dateRange]);

  // Calcular estadísticas filtradas
  const stats = useMemo(() => {
    // Si no hay filtros, usar estadísticas globales del backend
    if (timeFilter === 'all' && !customerFilter.trim()) {
      return globalStats;
    }

    // Si hay filtros, calcular desde appointments filtrados
    const completed = filteredAppointments.filter((apt: any) => apt.duration_minutes && !apt.no_show);
    const noShows = filteredAppointments.filter((apt: any) => apt.no_show);
    const withDelay = filteredAppointments.filter((apt: any) => apt.delay_minutes !== null && apt.delay_minutes !== undefined);

    // Calcular retrasos
    const delays = withDelay.map((apt: any) => apt.delay_minutes);
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
      const stats = customerStats.get(apt.phone);
      if (apt.no_show) {
        stats.no_shows++;
      } else if (apt.duration_minutes) {
        stats.visits++;
        stats.durations.push(apt.duration_minutes);
      } else if (apt.status === 'confirmed' && !apt.no_show) {
        // Contar visitas confirmadas aunque no tengan duración aún
        stats.visits++;
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
  }, [filteredAppointments, globalStats, timeFilter, customerFilter]);

  const getFilterLabel = () => {
    switch (timeFilter) {
      case 'today': return 'Hoy';
      case 'week': return 'Esta semana';
      case 'month': return 'Este mes';
      case 'year': return 'Este año';
      case 'custom': 
        if (dateRange.from && dateRange.to) {
          return `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}`;
        }
        return 'Rango personalizado';
      default: return 'Siempre';
    }
  };

  if (globalLoading || appointmentsLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando estadísticas...</div>;
  }

  if (!stats) {
    return <div className="text-center py-8 text-muted-foreground">No hay datos disponibles</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
            <SelectTrigger>
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período de tiempo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Siempre</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
              <SelectItem value="custom">Rango personalizado</SelectItem>
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
                  'Seleccionar rango'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range: any) => setDateRange(range || {})}
                locale={es}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar cliente..."
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {(timeFilter !== 'all' || customerFilter) && (
          <Button 
            variant="outline" 
            onClick={() => {
              setTimeFilter('all');
              setCustomerFilter('');
              setDateRange({});
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Indicador de filtro activo */}
      {(timeFilter !== 'all' || customerFilter) && (
        <Badge variant="secondary" className="text-sm">
          📊 Mostrando datos de: {getFilterLabel()}
          {customerFilter && ` | Cliente: "${customerFilter}"`}
        </Badge>
      )}

      {/* Cards de métricas principales - TODOS EN UNA FILA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Duración Media
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_duration} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Min: {stats.min_duration} | Max: {stats.max_duration}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Retraso Medio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avg_delay > 0 ? '+' : ''}{stats.avg_delay || 0} min
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total_with_delay || 0} analizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              Visitas Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_completed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Con tiempo registrado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              No-shows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_no_shows}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total registrado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Tasa de Asistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_completed + stats.total_no_shows > 0
                ? Math.round((stats.total_completed / (stats.total_completed + stats.total_no_shows)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Clientes que vinieron
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Top 10 Clientes
          </CardTitle>
          <CardDescription>Clientes con más visitas en el período seleccionado</CardDescription>
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
                      {customer.visits} visitas
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
                No hay datos de clientes para este período
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsView;
