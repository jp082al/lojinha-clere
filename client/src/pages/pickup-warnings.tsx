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
    <div className="space-y-6 md:space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Avisos de retirada</h2>
        <p className="text-muted-foreground mt-2">
          OS com mais de 90 dias desde a entrada, ainda sem baixa e sem retirada.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border bg-background/80 p-3 shadow-sm sm:p-4 md:grid-cols-[1fr_240px]">
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
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-2xl bg-muted/20 animate-pulse sm:h-40" />
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
        <div className="grid gap-2 sm:gap-3">
          {filteredOrders.map((order) => {
            const normalizedPhone = normalizePhone(order.customer.phone || "");
            const canSendWhatsapp = !!normalizedPhone;
            const warningSent = order.pickupWarning;
            const isExpired = warningSent ? new Date(warningSent.warningDeadlineAt).getTime() <= now : false;

            return (
              <Card key={order.id} className="overflow-hidden border-orange-200 bg-orange-50/20 shadow-sm">
                <CardContent className="p-2.5 sm:p-4">
                  <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold leading-none tracking-tight text-orange-900 shadow-sm ring-1 ring-orange-200 sm:text-sm lg:text-base">
                            {order.orderNumber || `OS #${order.id}`}
                          </span>
                          <Badge variant="secondary" className="h-5 px-2 text-[10px] sm:h-6 sm:text-[11px]">
                            {order.status}
                          </Badge>
                          {warningSent && (
                            <Badge
                              variant="outline"
                              className={`h-5 px-2 text-[10px] sm:h-6 sm:text-[11px] ${isExpired ? "border-red-300 text-red-700" : "border-orange-300 text-orange-700"}`}
                            >
                              {isExpired ? "Tempo expirado" : "Avisado"}
                            </Badge>
                          )}
                        </div>

                        <div className="flex w-fit items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-2 py-1 shadow-sm sm:self-start lg:self-auto">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Dias parados
                          </p>
                          <p className="text-base font-black leading-none text-orange-700 sm:text-xl">
                            {order.daysPending}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 sm:gap-3 xl:grid-cols-4">
                        <div className="rounded-xl border bg-background/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
                            Cliente
                          </p>
                          <p className="mt-0.5 line-clamp-2 break-words text-[11px] font-semibold leading-snug text-foreground sm:mt-1 sm:text-sm lg:text-base">
                            {order.customer.name}
                          </p>
                        </div>

                        <div className="rounded-xl border bg-background/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
                            Telefone
                          </p>
                          <p className="mt-0.5 break-words text-[11px] font-semibold leading-snug text-foreground sm:mt-1 sm:text-sm lg:text-base">
                            {order.customer.phone ? formatPhone(order.customer.phone) : "Nao informado"}
                          </p>
                          {!canSendWhatsapp && (
                            <p className="mt-0.5 text-[10px] font-medium leading-snug text-red-700 sm:mt-1 sm:text-[11px]">
                              Telefone ausente ou invalido para WhatsApp.
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl border bg-background/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
                            Aparelho
                          </p>
                          <p className="mt-0.5 line-clamp-2 break-words text-[11px] font-semibold leading-snug text-foreground sm:mt-1 sm:text-sm lg:text-base">
                            {order.appliance.type}
                          </p>
                          <p className="mt-0.5 line-clamp-2 break-words text-[10px] leading-snug text-muted-foreground sm:text-xs lg:text-sm">
                            {order.appliance.brand} {order.appliance.model}
                          </p>
                        </div>

                        <div className="rounded-xl border bg-background/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
                            Entrada
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-foreground sm:mt-1 sm:text-sm lg:text-base">
                            {format(new Date(order.entryDate), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-1.5 sm:gap-3 lg:grid-cols-[1.1fr_1.1fr_0.8fr]">
                        <div className="rounded-xl border bg-background/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
                            Aviso enviado
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-foreground sm:mt-1 sm:text-sm">
                            {warningSent ? formatDateTime(warningSent.warningSentAt) : "Nenhum aviso registrado ainda."}
                          </p>
                        </div>

                        <div className="rounded-xl border bg-background/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
                            Prazo final
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-foreground sm:mt-1 sm:text-sm">
                            {warningSent ? formatDateTime(warningSent.warningDeadlineAt) : "Aguardando envio do aviso."}
                          </p>
                        </div>

                        <div className="rounded-xl border bg-background/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
                            Temporizador
                          </p>
                          <p className={`mt-0.5 text-[11px] font-semibold leading-snug sm:mt-1 sm:text-sm ${warningSent ? (isExpired ? "text-red-700" : "text-orange-700") : "text-muted-foreground"}`}>
                            {warningSent ? formatCountdown(warningSent.warningDeadlineAt) : "Nao iniciado"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-1 lg:min-w-[190px] lg:items-end">
                      <Button
                        className="h-10 w-full bg-green-600 px-3 text-sm font-semibold hover:bg-green-700 lg:w-auto"
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
                      <p className="text-[10px] leading-snug text-muted-foreground lg:max-w-[190px] lg:text-right">
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
