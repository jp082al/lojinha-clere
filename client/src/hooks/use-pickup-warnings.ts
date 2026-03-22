import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function usePickupWarnings() {
  return useQuery({
    queryKey: [api.serviceOrders.pickupWarnings.path],
    queryFn: async () => {
      const res = await fetch(api.serviceOrders.pickupWarnings.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pickup warnings");
      return api.serviceOrders.pickupWarnings.responses[200].parse(await res.json());
    },
  });
}
