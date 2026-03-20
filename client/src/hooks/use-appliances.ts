import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertAppliance } from "@shared/schema";

export function useAppliances(customerId: number) {
  return useQuery({
    queryKey: [api.appliances.list.path, customerId],
    queryFn: async () => {
      const url = buildUrl(api.appliances.list.path, { customerId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appliances");
      return api.appliances.list.responses[200].parse(await res.json());
    },
    enabled: !!customerId,
  });
}

export function useCreateAppliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAppliance) => {
      const res = await fetch(api.appliances.create.path, {
        method: api.appliances.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create appliance");
      return api.appliances.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => queryClient.invalidateQueries({ 
      queryKey: [api.appliances.list.path, variables.customerId] 
    }),
  });
}
