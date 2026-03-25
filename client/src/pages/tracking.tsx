import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wrench, CheckCircle2, Clock, Package, AlertCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  "Recebido": { color: "bg-blue-100 text-blue-800", icon: Package, label: "Recebido" },
  "Em análise": { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Em Análise" },
  "Aguardando peça": { color: "bg-orange-100 text-orange-800", icon: AlertCircle, label: "Aguardando Peça" },
  "Em reparo": { color: "bg-purple-100 text-purple-800", icon: Wrench, label: "Em Reparo" },
  "Pronto": { color: "bg-green-100 text-green-800", icon: CheckCircle2, label: "Pronto para Retirada" },
  "Entregue": { color: "bg-gray-100 text-gray-800", icon: CheckCircle2, label: "Entregue" },
};

export default function Tracking() {
  const [, params] = useRoute("/acompanhamento/:token");
  const token = params?.token;

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      return res.json();
    },
  });

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["/api/tracking", token],
    queryFn: async () => {
      const res = await fetch(`/api/tracking/${token}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch order");
      }
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">OS não encontrada</h2>
            <p className="text-muted-foreground">
              O link de acompanhamento não é válido ou a ordem de serviço não existe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG["Recebido"];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="mx-auto max-w-lg space-y-5 py-5 sm:space-y-6 sm:py-8">
        <div className="text-center">
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt="Logo" className="h-12 mx-auto mb-2 object-contain" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{settings?.businessName || "TechRepair"}</h1>
          <p className="text-muted-foreground">Acompanhamento de Serviço</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="break-words text-2xl font-bold sm:text-3xl">{order.orderNumber}</CardTitle>
              <Badge className={`${statusConfig.color} w-fit px-3 py-1`}>
                <StatusIcon className="h-4 w-4 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="break-words font-medium sm:text-right">{order.customer.name}</span>
              </div>
              
              <div className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">Aparelho</span>
                <span className="break-words font-medium sm:text-right">
                  {order.appliance.type} {order.appliance.brand}
                </span>
              </div>

              <div className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">Modelo</span>
                <span className="break-words font-medium sm:text-right">{order.appliance.model}</span>
              </div>
              
              <div className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">Data de Entrada</span>
                <span className="font-medium sm:text-right">
                  {order.entryDate && format(new Date(order.entryDate), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>

              {order.exitDate && (
                <div className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">Data de Saída</span>
                  <span className="font-medium sm:text-right">
                    {format(new Date(order.exitDate), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Problema Relatado</h4>
              <p className="text-foreground">{order.defect}</p>
            </div>

            {order.diagnosis && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Diagnóstico</h4>
                <p className="text-foreground">{order.diagnosis}</p>
              </div>
            )}

            {order.finalStatus && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-800 mb-2">Finalização</h4>
                <p className="text-green-900">{order.finalStatus}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Dúvidas? Entre em contato conosco.</p>
        </div>
      </div>
    </div>
  );
}
