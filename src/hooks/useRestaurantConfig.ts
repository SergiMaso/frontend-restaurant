import { useQuery } from "@tanstack/react-query";
import { getClientConfigs } from "@/services/api";
import { useTenantKey } from "@/hooks/useTenantKey";

/**
 * Hook personalitzat per accedir a les configuracions del restaurant
 */
export const useRestaurantConfig = () => {
  const { data: configs, isLoading, error } = useQuery({
    queryKey: useTenantKey(["client-configs"]),
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

  // Restaurant's own default language = first of supported_languages, mirroring
  // the backend (voice_handler._get_default_language and
  // ai_processor.get_default_language both use supported_languages[0]).
  // Never hardcode a language in the UI: the reservation dialog used to default
  // to "ca" for every restaurant, so staff saved without touching the field and
  // silently overwrote the customer's real language.
  const supportedLanguages = getConfigValue("supported_languages", "es")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Empty while the config query is still in flight — "not known yet" must be
  // distinguishable from a real answer. Returning a provisional "es" meant the
  // dialog filled the field with it, and its "only fill if empty" rule then
  // blocked the real value from ever replacing it: a Catalan restaurant would
  // show Spanish purely because the placeholder won the race.
  const restaurantDefaultLanguage = isLoading ? "" : supportedLanguages[0] || "es";

  return {
    supportedLanguages,
    restaurantDefaultLanguage,
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
