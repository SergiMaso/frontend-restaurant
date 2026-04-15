import { useQuery } from "@tanstack/react-query";
import { getClientConfigs } from "@/services/api";

/**
 * Hook personalitzat per accedir a les configuracions del restaurant
 */
export const useRestaurantConfig = () => {
  const { data: configs, isLoading, error } = useQuery({
    queryKey: ["client-configs"],
    queryFn: getClientConfigs,
    staleTime: 5 * 60 * 1000, // 5 minuts
    refetchOnWindowFocus: false,
  });

  // Helper per obtenir un valor de configuració
  const getConfigValue = (key: string, defaultValue: string = ""): string => {
    const config = configs?.find((c) => c.key === key);
    return config?.value || defaultValue;
  };

  // Helper per obtenir un valor numèric
  const getConfigNumber = (key: string, defaultValue: number = 0): number => {
    const value = getConfigValue(key, defaultValue.toString());
    // Usar parseFloat per suportar decimals (ex: 1.5 hores)
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // Helper per obtenir un valor booleà
  const getConfigBoolean = (key: string, defaultValue: boolean = false): boolean => {
    const value = getConfigValue(key, defaultValue.toString());
    return value.toLowerCase() === "true" || value === "1";
  };

  const paymentEnabled = getConfigBoolean("payment_enabled", false);
  const restaurantName = getConfigValue("restaurant_name", "Restaurant");
  const maxPeoplePerBooking = getConfigNumber("max_people_per_booking", 8);
  // Config stores minutes, convert to hours for the frontend
  const defaultBookingDurationMinutes = getConfigNumber("default_booking_duration_minutes", 90);
  const defaultBookingDuration = defaultBookingDurationMinutes / 60;

  // Time slots configuration
  const timeSlotsMode = getConfigValue("time_slots_mode", "interval");
  const timeSlotIntervalMinutes = getConfigNumber("time_slot_interval_minutes", 30);
  const fixedTimeSlotsLunch = getConfigValue("fixed_time_slots_lunch", "13:00,15:00");
  const fixedTimeSlotsDinner = getConfigValue("fixed_time_slots_dinner", "20:00,21:30");

  return {
    configs,
    isLoading,
    error,
    getConfigValue,
    getConfigNumber,
    getConfigBoolean,
    // Configuracions específiques
    paymentEnabled,
    restaurantName,
    maxPeoplePerBooking,
    defaultBookingDuration,
    timeSlotsMode,
    timeSlotIntervalMinutes,
    fixedTimeSlotsLunch,
    fixedTimeSlotsDinner,
  };
};
