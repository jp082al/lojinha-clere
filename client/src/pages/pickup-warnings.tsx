import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useCreatePickupWarning, usePickupWarnings } from "@/hooks/use-pickup-warnings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return withCountryCode.length >= 12 ? withCountryCode : null;
}

function buildWhatsappMessage(order: any) {
  const orderLabel = order.orderNumber || `OS #${order.id}`;

  return `Olá ${order.customer.name}!\n\nA OS ${orderLabel} está aguardando retirada em nossa assistência.\n\nSolicitamos a retirada do aparelho em até 48 horas a partir deste aviso.\n\nApós esse prazo, poderão ser adotados os procedimentos internos cabíveis.\n\nEm caso de dúvida, entre em contato conosco.\n\nA lojinha Clere`;
}

export default function PickupWarningsPage() {
  const { data: orders = [], isLoading } = usePickupWarnings();
  const { mutateAsync: createPickupWarning, isPending } = useCreatePickupWarning();
  const { toast } = useToast();

  function formatCountdown(deadline: string | Date) {
    const diffMs = new Date(deadline).getTime() - Date.now();
    if (diffMs <= 0) return "Tempo expirado";

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}min restantes`;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Avisos de retirada</h2>
        <p className="text-muted-foreground mt-2">
          OS com mais de 90 dias desde a entrada, ainda sem baixa e sem retirada.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Nenhuma OS com mais de 90 dias pendente de baixa ou retirada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => {
            const normalizedPhone = normalizePhone(order.customer.phone || "");
            const canSendWhatsapp = !!normalizedPhone;
            const hasWarning = !!order.pickupWarning;
            const warningExpired = !!order.pickupWarning?.isExpired;

            return (
              <Card key={order.id} className="border-orange-200 bg-orange-50/30">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">{order.orderNumber || `OS #${order.id}`}</span>
                        <Badge variant="secondary">{order.status}</Badge>
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium">{order.customer.name}</p>
                        <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                        {!canSendWhatsapp && (
                          <p className="text-sm text-red-700">
                            Telefone ausente ou inválido para WhatsApp.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Aparelho:</span>{" "}
                          {order.appliance.type} {order.appliance.brand} {order.appliance.model}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Entrada:</span>{" "}
                          {format(new Date(order.entryDate), "dd/MM/yyyy")}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Aviso:</span>{" "}
                          {hasWarning ? "Registrado" : "Pendente"}
                        </p>
                        {order.pickupWarning && (
                          <>
                            <p className="text-sm">
                              <span className="font-medium">Enviado em:</span>{" "}
                              {format(new Date(order.pickupWarning.warningSentAt), "dd/MM/yyyy HH:mm")}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">Prazo final:</span>{" "}
                              {format(new Date(order.pickupWarning.warningDeadlineAt), "dd/MM/yyyy HH:mm")}
                            </p>
                            <p className={`text-sm ${warningExpired ? "font-medium text-red-700" : "text-muted-foreground"}`}>
                              <span className="font-medium text-foreground">Temporizador:</span>{" "}
                              {warningExpired ? "Tempo expirado" : formatCountdown(order.pickupWarning.warningDeadlineAt)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[180px]">
                      <div className="rounded-lg border bg-background p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Dias parados</p>
                        <p className="text-2xl font-bold text-orange-700">{order.daysPending}</p>
                      </div>
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        disabled={!canSendWhatsapp || isPending}
                        onClick={async () => {
                          if (!normalizedPhone) return;
                          try {
                            await createPickupWarning({ id: order.id });
                          } catch (error) {
                            toast({
                              title: "Erro ao registrar aviso",
                              description: error instanceof Error ? error.message : "Erro desconhecido",
                              variant: "destructive",
                            });
                            return;
                          }

                          const message = buildWhatsappMessage(order);
                          window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, "_blank");
                        }}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {hasWarning ? "Abrir WhatsApp" : "Registrar e avisar"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
