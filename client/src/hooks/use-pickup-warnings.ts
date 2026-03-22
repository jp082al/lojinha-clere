import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

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

export function useCreatePickupWarning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const res = await fetch(buildUrl(api.serviceOrders.createPickupWarning.path, { id }), {
        method: api.serviceOrders.createPickupWarning.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Erro ao registrar aviso" }));
        throw new Error(errorData.message || "Erro ao registrar aviso");
      }

      return api.serviceOrders.createPickupWarning.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.serviceOrders.pickupWarnings.path] });
    },
  });
}
