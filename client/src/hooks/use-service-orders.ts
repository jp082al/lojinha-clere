import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertServiceOrder, ServiceOrder } from "@shared/schema";

export function useServiceOrders() {
  return useQuery({
    queryKey: [api.serviceOrders.list.path],
    queryFn: async () => {
      const res = await fetch(api.serviceOrders.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch service orders");
      return api.serviceOrders.list.responses[200].parse(await res.json());
    },
  });
}

export function useServiceOrder(id: number) {
  return useQuery({
    queryKey: [api.serviceOrders.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.serviceOrders.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch service order");
      return api.serviceOrders.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateServiceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertServiceOrder) => {
      const res = await fetch(api.serviceOrders.create.path, {
        method: api.serviceOrders.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create service order");
      return api.serviceOrders.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.serviceOrders.list.path] }),
  });
}

export function useUpdateServiceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertServiceOrder> & { exitDate?: Date | string | null, finalizedBy?: string | null }) => {
      const url = buildUrl(api.serviceOrders.update.path, { id });
      const payload = {
        ...data,
        exitDate: data.exitDate instanceof Date ? data.exitDate.toISOString() : data.exitDate,
      };
      const res = await fetch(url, {
        method: api.serviceOrders.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Erro ao atualizar OS" }));
        throw new Error(errorData.message || "Erro ao atualizar OS");
      }
      return api.serviceOrders.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.serviceOrders.list.path] }),
  });
}

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
  });
}
