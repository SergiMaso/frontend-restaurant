import { useQuery } from "@tanstack/react-query";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { getAppointments, type Appointment } from "@/services/api";

interface UseAppointmentsQueryOptions {
  refetchInterval?: number | false;
  enabled?: boolean;
}

export const getAppointmentsQueryKey = (restaurantId?: number | null) =>
  ["appointments", restaurantId ?? null] as const;

export function useAppointmentsQuery(options: UseAppointmentsQueryOptions = {}) {
  const { selectedRestaurant } = useRestaurant();
  const restaurantId = selectedRestaurant?.id ?? null;

  return useQuery<Appointment[]>({
    queryKey: getAppointmentsQueryKey(restaurantId),
    queryFn: getAppointments,
    enabled: (options.enabled ?? true) && !!selectedRestaurant,
    refetchInterval: options.refetchInterval,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}
