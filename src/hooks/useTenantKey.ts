import { useRestaurant } from "@/contexts/RestaurantContext";

/**
 * Build a React Query key scoped to the currently selected restaurant.
 *
 * Pass the tenant-agnostic key parts; the active restaurant id is appended
 * automatically. Queries from different tenants therefore never share a
 * cache entry, so a tenant switch (or a stale fetch racing one) can't
 * surface another restaurant's data.
 *
 *   const customersKey = useTenantKey(["customers"]);
 *   useQuery({ queryKey: customersKey, ... });
 *   queryClient.invalidateQueries({ queryKey: customersKey });
 *
 * Note: if no restaurant is selected (e.g. during the initial load), the
 * key still includes `null` as the discriminator — callers should rely on
 * the `enabled` flag (driven by the same `selectedRestaurant` value) to
 * defer the fetch until a tenant is set.
 */
export function useTenantKey(parts: readonly unknown[]): readonly unknown[] {
  const { selectedRestaurant } = useRestaurant();
  return [...parts, selectedRestaurant?.id ?? null];
}
