import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useCreatePickupWarning, usePickupWarnings } from "@/hooks/use-pickup-warnings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState, useEffect } from "react";
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

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return phone;
}

export default function PickupWarningsPage() {
  const { data: orders = [], isLoading } = usePickupWarnings();
  const { mutateAsync: createPickupWarning, isPending } = useCreatePickupWarning();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"oldest" | "daysPending">("oldest");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = orders.filter((order) => {
      if (!normalizedSearch) return true;

      const orderNumber = (order.orderNumber || `OS #${order.id}`).toLowerCase();
      const customerName = order.customer.name.toLowerCase();
      const phone = (order.customer.phone || "").replace(/\D/g, "");
      const rawPhone = (order.customer.phone || "").toLowerCase();

      return (
        orderNumber.includes(normalizedSearch) ||
        customerName.includes(normalizedSearch) ||
        rawPhone.includes(normalizedSearch) ||
        phone.includes(normalizedSearch.replace(/\D/g, ""))
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === "daysPending") {
        return b.daysPending - a.daysPending;
      }

      const aDate = a.entryDate ? new Date(a.entryDate).getTime() : 0;
      const bDate = b.entryDate ? new Date(b.entryDate).getTime() : 0;
      return aDate - bDate;
    });
  }, [orders, search, sortBy]);

  function formatDateTime(value: string | Date) {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  }

  function formatCountdown(deadline: string | Date) {
    const diffMs = new Date(deadline).getTime() - now;

    if (diffMs <= 0) {
      return "Tempo expirado";
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes}min ${seconds}s`;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Avisos de retirada</h2>
        <p className="text-muted-foreground mt-2">
          OS com mais de 90 dias desde a entrada, ainda sem baixa e sem retirada.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border bg-background/80 p-4 shadow-sm md:grid-cols-[1fr_240px]">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Busca
          </p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por OS, cliente ou telefone"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Ordenacao
          </p>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as "oldest" | "daysPending")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oldest">Mais antiga primeiro</SelectItem>
              <SelectItem value="daysPending">Mais dias parado primeiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-40 rounded-2xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-dashed border-orange-200 bg-orange-50/40">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 rounded-full border border-orange-200 bg-white p-4 shadow-sm">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
            {orders.length === 0 ? (
              <>
                <h3 className="text-xl font-semibold tracking-tight">Nenhum aviso pendente</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  No momento, não há ordens de serviço com mais de 90 dias aguardando baixa ou retirada do cliente.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold tracking-tight">Nenhum resultado encontrado</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Ajuste a busca ou a ordenacao para visualizar as ordens disponiveis nesta lista.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => {
            const normalizedPhone = normalizePhone(order.customer.phone || "");
            const canSendWhatsapp = !!normalizedPhone;
            const warningSent = order.pickupWarning;
            const isExpired = warningSent ? new Date(warningSent.warningDeadlineAt).getTime() <= now : false;

            return (
              <Card key={order.id} className="overflow-hidden border-orange-200 bg-orange-50/30 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
                    <div className="flex-1 space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
                            Ordem de serviço
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-4 py-2 text-xl font-bold tracking-tight text-orange-900 shadow-sm ring-1 ring-orange-200">
                              {order.orderNumber || `OS #${order.id}`}
                            </span>
                            <Badge variant="secondary">{order.status}</Badge>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-orange-200 bg-white px-5 py-4 text-center shadow-sm lg:min-w-[180px]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                            Dias parados
                          </p>
                          <p className="mt-1 text-4xl font-black leading-none text-orange-700">
                            {order.daysPending}
                          </p>
                          {warningSent && (
                            <p className={`mt-3 text-xs font-semibold uppercase tracking-wide ${isExpired ? "text-red-700" : "text-orange-700"}`}>
                              {isExpired ? "Tempo expirado" : "Avisado"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Cliente
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {order.customer.name}
                          </p>
                          <div className="mt-3 rounded-xl bg-muted/40 px-3 py-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Telefone
                            </p>
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {order.customer.phone ? formatPhone(order.customer.phone) : "Nao informado"}
                            </p>
                          </div>
                          {!canSendWhatsapp && (
                            <p className="mt-3 text-sm font-medium text-red-700">
                              Telefone ausente ou invalido para WhatsApp.
                            </p>
                          )}
                        </div>

                        <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Aparelho
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {order.appliance.type}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {order.appliance.brand} {order.appliance.model}
                          </p>
                          <div className="mt-4 border-t pt-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Entrada
                            </p>
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {format(new Date(order.entryDate), "dd/MM/yyyy")}
                            </p>
                          </div>
                          <div className="mt-4 border-t pt-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Aviso
                            </p>
                            {warningSent ? (
                              <div className="mt-2 space-y-2">
                                <p className="text-sm text-foreground">
                                  <span className="font-medium">Enviado em:</span>{" "}
                                  {formatDateTime(warningSent.warningSentAt)}
                                </p>
                                <p className="text-sm text-foreground">
                                  <span className="font-medium">Prazo final:</span>{" "}
                                  {formatDateTime(warningSent.warningDeadlineAt)}
                                </p>
                                <p className={`text-sm font-medium ${isExpired ? "text-red-700" : "text-orange-700"}`}>
                                  {formatCountdown(warningSent.warningDeadlineAt)}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Nenhum aviso registrado ainda.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[220px] flex-col justify-end gap-3">
                      <Button
                        className="h-11 bg-green-600 text-sm font-semibold hover:bg-green-700"
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
                        {warningSent ? "Abrir WhatsApp" : "Registrar e avisar"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Use este atalho para abrir a conversa com a mensagem pronta.
                      </p>
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
