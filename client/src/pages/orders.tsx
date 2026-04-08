import { useState } from "react";
import { useLocation } from "wouter";
import { fetchServiceOrderDeliveryBatches, useServiceOrderDeliveryBatches, useServiceOrders, useCreateServiceOrder, useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { useCustomers } from "@/hooks/use-customers";
import { useAppliances } from "@/hooks/use-appliances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Filter, 
  Printer, 
  Tag, 
  Share2, 
  Mail, 
  CheckCircle2,
  MoreVertical,
  Link2,
  ExternalLink,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertServiceOrderSchema, type InsertServiceOrder } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { getOrderItemsSummary, getOrderSummaryPreview, isOrderItemFinalized } from "@/lib/service-order-items";

type OrderTab = "all" | "not_evaluated" | "awaiting_approval" | "authorized" | "not_authorized" | "ready" | "finalized";

const TAB_LABELS: Record<OrderTab, string> = {
  all: "Todas",
  not_evaluated: "Não avaliadas",
  awaiting_approval: "Aguardando aprovação",
  authorized: "Autorizadas",
  not_authorized: "Não autorizadas",
  ready: "Prontas",
  finalized: "Finalizadas",
};

function getOrderTab(order: any): OrderTab | null {
  if (order.finalStatus === "NAO_AUTORIZADO") {
    return "not_authorized";
  }

  if (
    order.finalStatus === "ENTREGUE" ||
    order.finalStatus === "DESCARTE_AUTORIZADO" ||
    order.status === "Entregue"
  ) {
    return "finalized";
  }

  if (!order.finalStatus && order.budgetStatus === "AGUARDANDO_APROVACAO") {
    return "awaiting_approval";
  }

  if (
    !order.finalStatus &&
    order.budgetStatus === "APROVADO" &&
    order.status !== "Pronto" &&
    order.status !== "Entregue"
  ) {
    return "authorized";
  }

  if (!order.finalStatus && order.status === "Pronto") {
    return "ready";
  }

  if (
    !order.finalStatus &&
    ["Recebido", "Em análise", "Aguardando peça", "Em reparo"].includes(order.status) &&
    order.budgetStatus !== "AGUARDANDO_APROVACAO" &&
    order.budgetStatus !== "APROVADO"
  ) {
    return "not_evaluated";
  }

  return null;
}

export default function Orders() {
  const [, setLocation] = useLocation();
  const { data: orders = [], isLoading } = useServiceOrders();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<OrderTab>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [finalizingOrder, setFinalizingOrder] = useState<any | null>(null);
  const { data: appliances = [] } = useAppliances(editingOrder?.customerId || 0);

  const filteredOrders = orders.filter((order) => {
    const matchesTab = activeTab === "all" || getOrderTab(order) === activeTab;

    if (!matchesTab) return false;
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    const orderItems = getOrderItemsSummary(order);

    return (
      (order.orderNumber || "").toLowerCase().includes(search) ||
      (order.customer.name || "").toLowerCase().includes(search) ||
      (order.customer.phone || "").toLowerCase().includes(search) ||
      orderItems.some((item) =>
        [
          item.appliance?.type,
          item.appliance?.brand,
          item.appliance?.model,
          item.appliance?.serialNumber,
          item.defect,
        ].some((value) => (value || "").toLowerCase().includes(search))
      ) ||
      (order.orderNumber || "").toLowerCase().includes(`os-${search}`)
    );
  });

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ordens de Serviço</h2>
          <p className="text-muted-foreground mt-2">Gerencie e acompanhe todos os serviços.</p>
        </div>
        <Button 
          className="w-full shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
          onClick={() => setLocation("/new-order")}
          data-testid="button-new-order"
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Ordem
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:gap-4 sm:p-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente ou Nº da OS..." 
            className="border-none bg-transparent text-base shadow-none focus-visible:ring-0 sm:text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-orders"
          />
        </div>
        
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
          {(Object.keys(TAB_LABELS) as OrderTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              className="min-h-10 shrink-0 rounded-full px-4"
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed">
              Nenhuma ordem de serviço encontrada em {TAB_LABELS[activeTab]}.
            </div>
          ) : (
            filteredOrders?.map((order) => {
              const orderSummary = getOrderSummaryPreview(order);
              return (
              <Card 
                key={order.id} 
                className={`hover:shadow-md transition-shadow cursor-pointer group ${order.finalStatus ? 'opacity-75' : ''}`}
                onClick={() => setEditingOrder(order)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-base font-bold text-foreground sm:text-lg">
                          {order.orderNumber}
                        </span>
                        <StatusBadge status={order.status} />
                        {order.finalStatus && (
                          <Badge variant="secondary" className="bg-gray-100">
                            {{"ENTREGUE": "Entregue", "NAO_AUTORIZADO": "Não autorizado", "DESCARTE_AUTORIZADO": "Descarte"}[order.finalStatus] || order.finalStatus}
                          </Badge>
                        )}
                        <span className="w-full text-xs text-muted-foreground sm:w-auto sm:text-sm">
                          {format(new Date(order.entryDate!), "dd/MM/yyyy")}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold sm:text-xl">{order.customer.name}</h3>
                      <p className="break-words text-sm text-muted-foreground sm:text-base">
                        {orderSummary.preview}
                      </p>
                      {orderSummary.itemCount > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {orderSummary.itemCount} aparelhos nesta OS
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-3 border-t pt-3 md:items-end md:border-t-0 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-sm text-muted-foreground">Total Estimado</p>
                        <p className="text-xl font-bold text-primary sm:text-2xl">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orderSummary.totalValue)}
                        </p>
                      </div>
                      
                      <div className="flex items-stretch gap-2 md:justify-end">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="min-h-10 flex-1 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 sm:w-auto sm:flex-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            const trackingUrl = order.trackingToken 
                              ? `${window.location.origin}/acompanhamento/${order.trackingToken}`
                              : '';
                            const message = `Olá ${order.customer.name}!\n\nSua OS ${order.orderNumber} está com status: *${order.status}*\n\n${trackingUrl ? `Acompanhe online: ${trackingUrl}` : ''}`;
                            window.open(`https://wa.me/55${order.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                          }}
                          data-testid={`button-whatsapp-${order.id}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" /> WhatsApp
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" className="min-h-10 shrink-0 px-3">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/print/receipt/${order.id}`, '_blank');
                            }}>
                              <Printer className="w-4 h-4 mr-2" /> Imprimir Nota
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/print/label/${order.id}`, '_blank');
                            }}>
                              <Tag className="w-4 h-4 mr-2" /> Imprimir Etiqueta
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              const trackingUrl = order.trackingToken 
                                ? `${window.location.origin}/acompanhamento/${order.trackingToken}`
                                : '';
                              if (trackingUrl) {
                                navigator.clipboard.writeText(trackingUrl);
                              }
                            }}>
                              <Link2 className="w-4 h-4 mr-2" /> Copiar Link
                            </DropdownMenuItem>
                            {order.trackingToken && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/acompanhamento/${order.trackingToken}`, '_blank');
                              }}>
                                <ExternalLink className="w-4 h-4 mr-2" /> Ver Acompanhamento
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })
          )}
        </div>
      )}

      {/* Edit/Details Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl">
          {editingOrder && (
            <OrderDetails 
              order={editingOrder} 
              appliances={appliances}
              onClose={() => setEditingOrder(null)}
              onFinalize={() => {
                setFinalizingOrder(editingOrder);
                setEditingOrder(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Finalization Dialog */}
      <Dialog open={!!finalizingOrder} onOpenChange={(open) => !open && setFinalizingOrder(null)}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
          {finalizingOrder && (
            <FinalizationForm 
              order={finalizingOrder} 
              onClose={() => setFinalizingOrder(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetails({ order, appliances, onClose, onFinalize }: { order: any, appliances: any[], onClose: () => void, onFinalize: () => void }) {
  const { mutate: update, isPending } = useUpdateServiceOrder();
  const { toast } = useToast();
  const { hasPermission, user } = useAuth();
  const { data: deliveryBatches = [] } = useServiceOrderDeliveryBatches(order.id);
  const [budgetOpen, setBudgetOpen] = useState(true);
  const itemSummaries = getOrderItemsSummary(order, appliances);
  const isMultiItemOrder = itemSummaries.length > 1;
  const primaryItem = itemSummaries[0];
  const openItems = itemSummaries.filter((item) => !isOrderItemFinalized(item));
  const canTriggerDelivery = openItems.length > 0;
  const [itemDiagnoses, setItemDiagnoses] = useState<Record<number, string>>(
    Object.fromEntries(itemSummaries.map((item) => [item.itemNumber, item.diagnosis || ""]))
  );
  const [itemTechnicals, setItemTechnicals] = useState<Record<number, {
    status: string;
    serviceValue: string;
    partsValue: string;
    partsDescription: string;
  }>>(
    Object.fromEntries(itemSummaries.map((item) => [
      item.itemNumber,
      {
        status: item.status || order.status || "Recebido",
        serviceValue: item.serviceValue.toString(),
        partsValue: item.partsValue.toString(),
        partsDescription: item.partsDescription || "",
      },
    ]))
  );
  
  const form = useForm<InsertServiceOrder>({
    resolver: zodResolver(insertServiceOrderSchema),
    defaultValues: {
      customerId: order.customerId,
      applianceId: order.applianceId,
      defect: primaryItem?.defect || order.defect,
      diagnosis: primaryItem?.diagnosis || order.diagnosis || "",
      status: order.status,
      serviceValue: order.serviceValue,
      partsValue: order.partsValue,
      totalValue: order.totalValue
    }
  });

  const onSubmit = (data: InsertServiceOrder) => {
    const primaryItemState = itemTechnicals[primaryItem?.itemNumber || 1];
    const total = (Number(primaryItemState?.serviceValue || 0) + Number(primaryItemState?.partsValue || 0)).toString();
    const finalData = {
      ...data,
      defect: isMultiItemOrder ? order.defect : data.defect,
      status: primaryItemState?.status || order.status,
      serviceValue: primaryItemState?.serviceValue || "0",
      partsValue: primaryItemState?.partsValue || "0",
      partsDescription: primaryItemState?.partsDescription || null,
      diagnosis: itemDiagnoses[primaryItem?.itemNumber || 1] || null,
      totalValue: total,
      items: itemSummaries
        .filter((item) => item.id)
        .map((item) => ({
          id: item.id || undefined,
          itemNumber: item.itemNumber,
          diagnosis: itemDiagnoses[item.itemNumber] || null,
          status: itemTechnicals[item.itemNumber]?.status || item.status || "Recebido",
          serviceValue: itemTechnicals[item.itemNumber]?.serviceValue || "0",
          partsValue: itemTechnicals[item.itemNumber]?.partsValue || "0",
          totalValue: (
            Number(itemTechnicals[item.itemNumber]?.serviceValue || 0) +
            Number(itemTechnicals[item.itemNumber]?.partsValue || 0)
          ).toString(),
          partsDescription: itemTechnicals[item.itemNumber]?.partsDescription || null,
        })),
    };
    update({ id: order.id, ...finalData }, { 
      onSuccess: () => {
        toast({ title: "OS atualizada com sucesso!" });
        onClose();
      }
    });
  };

  const trackingUrl = order.trackingToken 
    ? `${window.location.origin}/acompanhamento/${order.trackingToken}`
    : null;

  const isFinalized = !canTriggerDelivery && (Boolean(order.finalStatus) || order.status === "Entregue");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span>{order.orderNumber}</span>
          <StatusBadge status={order.status} />
          {order.finalStatus && (
            <Badge variant="secondary">{order.finalStatus}</Badge>
          )}
        </DialogTitle>
      </DialogHeader>

      {/* Quick Actions */}
      <div className="flex flex-col gap-2 py-2 sm:flex-row sm:flex-wrap">
        <Button 
          size="sm" 
          variant="outline"
          className="min-h-10 justify-start"
          onClick={() => window.open(`/print/receipt/${order.id}`, '_blank')}
        >
          <Printer className="w-4 h-4 mr-2" /> Nota de Entrada
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          className="min-h-10 justify-start"
          onClick={() => window.open(`/print/label/${order.id}`, '_blank')}
        >
          <Tag className="w-4 h-4 mr-2" /> Etiqueta
        </Button>
        {canTriggerDelivery && (
          <Button
            size="sm"
            variant="outline"
            className="min-h-10 justify-start border-orange-200 text-orange-600 hover:bg-orange-50"
            onClick={onFinalize}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {itemSummaries.length > 1 ? "Entregar Itens" : "Entregar OS"}
          </Button>
        )}
        {isFinalized && (
          <Button 
            size="sm" 
            variant="outline"
            className="min-h-10 justify-start text-blue-600"
            onClick={() => {
              const latestBatch = deliveryBatches[0];
              window.open(
                latestBatch
                  ? `/print/exit/${order.id}?batchId=${latestBatch.id}`
                  : `/print/exit/${order.id}`,
                '_blank',
              );
            }}
          >
            <Printer className="w-4 h-4 mr-2" /> Nota de Saída
          </Button>
        )}
        <Button 
          size="sm" 
          variant="outline"
          className="min-h-10 justify-start text-green-600"
          onClick={() => {
            const message = `Olá ${order.customer.name}!\n\nSua OS ${order.orderNumber} está com status: *${order.status}*\n\n${trackingUrl ? `Acompanhe online: ${trackingUrl}` : ''}`;
            window.open(`https://wa.me/55${order.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
          }}
        >
          <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          className="min-h-10 justify-start"
          onClick={() => {
            const subject = `OS #${order.id} - ${primaryItem?.applianceLabel || "Aparelhos"}`;
            const body = `Olá ${order.customer.name},\n\nSua OS ${order.orderNumber} está com status: ${order.status}\n\n${itemSummaries.map((item) => `Item ${item.itemNumber}: ${item.applianceLabel}\nDefeito: ${item.defect}`).join("\n\n")}\n\n${trackingUrl ? `Acompanhe online: ${trackingUrl}` : ''}\n\nAtenciosamente,\nTechRepair`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
          }}
        >
          <Mail className="w-4 h-4 mr-2" /> Email
        </Button>
      </div>

      <Separator />

      {deliveryBatches.length > 0 && (
        <>
          <div className="space-y-3 py-2">
            <div>
              <p className="text-sm font-medium">Histórico de saídas</p>
              <p className="text-xs text-muted-foreground">
                Reimpressão baseada no lote persistido de cada entrega.
              </p>
            </div>
            <div className="space-y-2">
              {deliveryBatches.map((batch) => (
                <div key={batch.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {batch.isPartial ? "Saída parcial" : "Saída total"}
                        </Badge>
                        <span className="text-sm font-medium">
                          {format(new Date(batch.deliveredAt), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {batch.items.length} item(ns) • Responsável: {batch.finalizedBy}
                      </p>
                      {batch.deliveredTo && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Entregue para:</span> {batch.deliveredTo}
                        </p>
                      )}
                      {batch.paymentMethod && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Pagamento:</span> {batch.paymentMethod}
                        </p>
                      )}
                      {batch.finalNotes && (
                        <p className="text-sm whitespace-pre-wrap">
                          <span className="text-muted-foreground">Observações finais:</span> {batch.finalNotes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/print/exit/${order.id}?batchId=${batch.id}`, "_blank")}
                      >
                        <Printer className="w-4 h-4 mr-2" /> Reimprimir
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Itens desta saída</p>
                    {batch.items.map((item) => (
                      <div key={item.id} className="text-sm">
                        <p className="font-medium">
                          Item {item.itemNumberSnapshot}: {[item.applianceTypeSnapshot, item.applianceBrandSnapshot, item.applianceModelSnapshot].filter(Boolean).join(" ")}
                        </p>
                        {item.applianceSerialNumberSnapshot && (
                          <p className="text-muted-foreground">Série: {item.applianceSerialNumberSnapshot}</p>
                        )}
                        <p className="text-muted-foreground">{item.defectSnapshot}</p>
                        {(item.diagnosisSnapshot || item.partsDescriptionSnapshot) && (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {[item.diagnosisSnapshot, item.partsDescriptionSnapshot].filter(Boolean).join("\n")}
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          Mão de obra: R$ {Number(item.serviceValueSnapshot ?? 0).toFixed(2)} | Peças: R$ {Number(item.partsValueSnapshot ?? 0).toFixed(2)} | Total: R$ {Number(item.totalValueSnapshot ?? 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Customer & Appliance Info */}
      <div className="grid grid-cols-1 gap-4 py-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Cliente</p>
          <p className="font-medium">{order.customer.name}</p>
          <p className="text-muted-foreground">{order.customer.phone}</p>
          <p className="text-muted-foreground">{order.customer.address || "Não informado"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Itens da OS</p>
          <div className="space-y-2">
            {itemSummaries.map((item) => (
              <div key={item.itemNumber}>
                <p className="font-medium">Item {item.itemNumber}: {item.applianceLabel}</p>
                <p className="text-muted-foreground">{item.defect}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {isMultiItemOrder ? (
            <div className="space-y-2 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Defeitos relatados por item</p>
              <p className="text-xs text-muted-foreground">
                Em OS com multiplos aparelhos, o defeito deve ser mantido apenas no bloco de cada item para evitar edicao ambigua.
              </p>
              <div className="space-y-2 text-sm">
                {itemSummaries.map((item) => (
                  <div key={item.itemNumber}>
                    <p className="font-medium">Item {item.itemNumber}: {item.applianceLabel}</p>
                    <p className="text-muted-foreground">{item.defect}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <FormField
              control={form.control}
              name="defect"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Defeito Relatado</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={isFinalized} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          <div className="space-y-4">
            <FormLabel>Bloco Técnico/Comercial por Item</FormLabel>
            {itemSummaries.map((item) => (
              <div key={item.itemNumber} className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{item.applianceLabel}</p>
                  <p className="text-sm text-muted-foreground">{item.defect}</p>
                </div>

                <FormItem>
                  <FormLabel className="text-sm text-muted-foreground">Diagnóstico Técnico</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Diagnóstico do técnico..."
                      value={itemDiagnoses[item.itemNumber] || ""}
                      onChange={(e) => setItemDiagnoses((current) => ({
                        ...current,
                        [item.itemNumber]: e.target.value,
                      }))}
                      disabled={isFinalized}
                    />
                  </FormControl>
                </FormItem>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormItem>
                    <FormLabel className="text-sm text-muted-foreground">Status do Item</FormLabel>
                    <Select
                      value={itemTechnicals[item.itemNumber]?.status || "Recebido"}
                      onValueChange={(value) => setItemTechnicals((current) => ({
                        ...current,
                        [item.itemNumber]: {
                          ...current[item.itemNumber],
                          status: value,
                        },
                      }))}
                      disabled={isFinalized}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Recebido">Recebido</SelectItem>
                        <SelectItem value="Em análise">Em análise</SelectItem>
                        <SelectItem value="Aguardando peça">Aguardando peça</SelectItem>
                        <SelectItem value="Em reparo">Em reparo</SelectItem>
                        <SelectItem value="Pronto">Pronto</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormItem>
                    <FormLabel className="text-sm text-muted-foreground">Mão de Obra</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={itemTechnicals[item.itemNumber]?.serviceValue || "0"}
                        onChange={(e) => setItemTechnicals((current) => ({
                          ...current,
                          [item.itemNumber]: {
                            ...current[item.itemNumber],
                            serviceValue: e.target.value,
                          },
                        }))}
                        disabled={isFinalized}
                      />
                    </FormControl>
                  </FormItem>
                  <FormItem>
                    <FormLabel className="text-sm text-muted-foreground">Peças</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={itemTechnicals[item.itemNumber]?.partsValue || "0"}
                        onChange={(e) => setItemTechnicals((current) => ({
                          ...current,
                          [item.itemNumber]: {
                            ...current[item.itemNumber],
                            partsValue: e.target.value,
                          },
                        }))}
                        disabled={isFinalized}
                      />
                    </FormControl>
                  </FormItem>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
                  <span className="font-medium">Total do Item</span>
                  <span className="font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      Number(itemTechnicals[item.itemNumber]?.serviceValue || 0) +
                      Number(itemTechnicals[item.itemNumber]?.partsValue || 0)
                    )}
                  </span>
                </div>

                <FormItem>
                  <FormLabel className="text-sm text-muted-foreground">Peças Utilizadas</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Liste as peças utilizadas neste item"
                      value={itemTechnicals[item.itemNumber]?.partsDescription || ""}
                      onChange={(e) => setItemTechnicals((current) => ({
                        ...current,
                        [item.itemNumber]: {
                          ...current[item.itemNumber],
                          partsDescription: e.target.value,
                        },
                      }))}
                      disabled={isFinalized}
                    />
                  </FormControl>
                </FormItem>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <span className="font-semibold">Total da OS:</span>
            <span className="text-lg font-bold text-primary sm:text-xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                itemSummaries.reduce((sum, item) => (
                  sum +
                  Number(itemTechnicals[item.itemNumber]?.serviceValue || 0) +
                  Number(itemTechnicals[item.itemNumber]?.partsValue || 0)
                ), 0)
              )}
            </span>
          </div>

          {/* Orçamento Section */}
          <BudgetSection 
            order={order} 
            isFinalized={isFinalized}
            hasPermission={hasPermission}
            user={user}
            onUpdate={update}
            toast={toast}
          />

          <DialogFooter className="!flex-col gap-2 sm:!flex-row">
            {canTriggerDelivery && (
              <Button 
                type="button" 
                variant="outline" 
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={onFinalize}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> {itemSummaries.length > 1 ? "Entregar Itens" : "Dar Baixa"}
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {!isFinalized && (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function BudgetSection({ order, isFinalized, hasPermission, user, onUpdate, toast }: any) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: appliances = [] } = useAppliances(order.customerId);
  const itemSummaries = getOrderItemsSummary(order, appliances);
  
  const isBudgetApproved = order.budgetStatus === "APROVADO";
  const isBudgetRefused = order.budgetStatus === "RECUSADO";
  const isBudgetPending = order.budgetStatus === "AGUARDANDO_APROVACAO";

  const handleStatusChange = (status: string) => {
    onUpdate({ 
      id: order.id, 
      budgetStatus: status,
      budgetApprovedAt: status === "APROVADO" ? new Date() : null,
      budgetApprovedBy: status === "APROVADO" ? user?.username : null
    }, {
      onSuccess: () => toast({ title: `Orçamento ${status === "APROVADO" ? "aprovado" : "recusado"}!` })
    });
  };

  const sendWhatsApp = () => {
    const message = `Olá ${order.customer.name}!\n\nSegue o orçamento para a OS #${order.id}:\n\n${itemSummaries.map((item) => `*Item ${item.itemNumber}:* ${item.applianceLabel}\n*Defeito:* ${item.defect}\n*Diagnóstico:* ${item.diagnosis || "Em análise"}\n*Mão de Obra:* R$ ${item.serviceValue}\n*Peças:* R$ ${item.partsValue}\n*Total:* R$ ${item.totalValue}`).join("\n\n")}\n\n*Validade:* ${order.budgetValidityDays || 7} dias`;
    window.open(`https://wa.me/55${order.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, "_blank");
    
    onUpdate({ id: order.id, budgetSentAt: new Date() });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="overflow-hidden rounded-lg border shadow-sm">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between p-4 transition-colors hover:bg-muted/50">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold sm:text-lg">Orçamento</span>
            {order.budgetStatus && (
              <Badge className={`max-w-full ${
                order.budgetStatus === "APROVADO" ? "bg-green-100 text-green-700" : 
                order.budgetStatus === "RECUSADO" ? "bg-red-100 text-red-700" : 
                "bg-orange-100 text-orange-700"
              }`}>
                {order.budgetStatus.replace("_", " ")}
              </Badge>
            )}
          </div>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-4 bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Validade (dias)</label>
            <Input 
              type="number" 
              value={order.budgetValidityDays || 7} 
              onChange={(e) => onUpdate({ id: order.id, budgetValidityDays: parseInt(e.target.value) })}
              disabled={isFinalized || !hasPermission("edit_budget")}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Status do Orçamento</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button 
                type="button"
                size="sm" 
                variant={isBudgetPending ? "default" : "outline"}
                className={isBudgetPending ? "justify-start bg-orange-600 hover:bg-orange-700" : "justify-start text-orange-600 border-orange-200"}
                onClick={() => handleStatusChange("AGUARDANDO_APROVACAO")}
                disabled={isFinalized || !hasPermission("edit_budget")}
              >
                <Clock className="w-4 h-4 mr-1" /> Pendente
              </Button>
              {hasPermission("approve_budget") && (
                <>
                  <Button 
                    type="button"
                    size="sm" 
                    variant={isBudgetApproved ? "default" : "outline"}
                    className={isBudgetApproved ? "justify-start bg-green-600 hover:bg-green-700" : "justify-start text-green-600 border-green-200"}
                    onClick={() => handleStatusChange("APROVADO")}
                    disabled={isFinalized}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                  </Button>
                  <Button 
                    type="button"
                    size="sm" 
                    variant={isBudgetRefused ? "default" : "outline"}
                    className={isBudgetRefused ? "justify-start bg-red-600 hover:bg-red-700" : "justify-start text-red-600 border-red-200"}
                    onClick={() => handleStatusChange("RECUSADO")}
                    disabled={isFinalized}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Recusar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Observações Internas (Orçamento)</label>
          <Textarea 
            placeholder="Ex: Cliente achou caro, aguardando peça X..."
            value={order.budgetNotes || ""}
            onChange={(e) => onUpdate({ id: order.id, budgetNotes: e.target.value })}
            disabled={isFinalized || !hasPermission("edit_budget")}
          />
        </div>

        <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button 
            type="button"
            size="sm" 
            variant="outline" 
            className="justify-start text-green-600 border-green-200 hover:bg-green-50"
            onClick={sendWhatsApp}
            disabled={!hasPermission("send_budget")}
          >
            <Send className="w-4 h-4 mr-2" /> Enviar p/ WhatsApp
          </Button>
          {order.budgetSentAt && (
            <span className="flex items-center text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Enviado em {format(new Date(order.budgetSentAt), "dd/MM HH:mm")}
            </span>
          )}
          {order.budgetApprovedAt && (
            <span className="flex items-center text-xs text-muted-foreground sm:ml-auto">
              Aprovado por {order.budgetApprovedBy} em {format(new Date(order.budgetApprovedAt), "dd/MM HH:mm")}
            </span>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FinalizationForm({ order, onClose }: { order: any, onClose: () => void }) {
  const { mutate: update, isPending } = useUpdateServiceOrder();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: appliances = [] } = useAppliances(order.customerId);
  const itemSummaries = getOrderItemsSummary(order, appliances);
  const isLegacySingleItem = itemSummaries.length === 1 && !itemSummaries[0]?.id;
  const openItems = itemSummaries.filter((item) => !isOrderItemFinalized(item));
  const [finalStatus, setFinalStatus] = useState<string>("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || "");
  const [partsDescription, setPartsDescription] = useState(order.partsDescription || "");
  const [warrantyDays, setWarrantyDays] = useState(order.warrantyDays?.toString() || "90");
  const [finalizationSuccess, setFinalizationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastPrintedBatchId, setLastPrintedBatchId] = useState<number | null>(null);
  const [selectedItemNumbers, setSelectedItemNumbers] = useState<number[]>(
    openItems.length ? openItems.map((item) => item.itemNumber) : itemSummaries.map((item) => item.itemNumber)
  );

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      "ENTREGUE": "Consertado e entregue",
      "NAO_AUTORIZADO": "Não autorizado (retirado)",
      "DESCARTE_AUTORIZADO": "Autorizado para descarte"
    };
    return labels[status] || status;
  };

  const isCompletingOrder = isLegacySingleItem || (openItems.length > 0 && selectedItemNumbers.length === openItems.length);

  const handleFinalize = () => {
    if (!finalStatus) return;
    setErrorMessage(null);

    const selectedItems = isLegacySingleItem
      ? itemSummaries
      : openItems.filter((item) => selectedItemNumbers.includes(item.itemNumber));

    if (!selectedItems.length) {
      setErrorMessage("Selecione ao menos um item para registrar a saída.");
      return;
    }
    update(isLegacySingleItem ? {
      id: order.id,
      status: finalStatus === "ENTREGUE" ? "Entregue" : order.status,
      finalStatus,
      deliveredTo: deliveredTo || null,
      finalNotes: notes || null,
      paymentMethod: paymentMethod || null,
      partsDescription: partsDescription || null,
      warrantyDays: warrantyDays ? parseInt(warrantyDays) : 90,
      exitDate: new Date(),
      finalizedBy: user?.username || "Usuário"
    } : {
      id: order.id,
      ...(isCompletingOrder && finalStatus === "ENTREGUE" ? { paymentMethod: paymentMethod || null } : {}),
      items: selectedItems.map((item) => ({
        id: item.id || undefined,
        itemNumber: item.itemNumber,
        status: finalStatus === "ENTREGUE" ? "Entregue" : item.status || undefined,
        partsDescription: partsDescription || item.partsDescription || null,
        warrantyDays: warrantyDays ? parseInt(warrantyDays) : (item.warrantyDays || 90),
        exitDate: new Date(),
        finalStatus,
        finalizedBy: user?.username || "Usuário",
        deliveredTo: deliveredTo || null,
        finalNotes: notes || null,
      })),
    }, {
      onSuccess: async () => {
        if (finalStatus === "ENTREGUE" && isLegacySingleItem) {
          try {
            await apiRequest("POST", "/api/payments", {
              orderId: order.id,
              amount: order.totalValue.toString(),
              method: paymentMethod || "OUTRO",
            });
          } catch (err) {
            console.error("Failed to record payment:", err);
          }
        }

        toast({
          title: isCompletingOrder ? "OS finalizada com sucesso!" : "Saída parcial registrada!",
          description: isCompletingOrder
            ? `Status: ${getStatusLabel(finalStatus)}`
            : `${selectedItems.length} item(ns) entregue(s) nesta saída`
        });
        const batches = await fetchServiceOrderDeliveryBatches(order.id);
        const latestBatch = batches[0] ?? null;
        setLastPrintedBatchId(latestBatch?.id ?? null);
        setFinalizationSuccess(true);
        if (latestBatch) {
          setTimeout(() => {
            window.open(`/print/exit/${order.id}?batchId=${latestBatch.id}`, "_blank");
          }, 150);
        }
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Erro desconhecido ao finalizar";
        setErrorMessage(message);
        toast({
          title: "Erro ao finalizar OS",
          description: message,
          variant: "destructive"
        });
      }
    });
  };

  if (finalizationSuccess) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            Baixa registrada para {order.orderNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <p className="text-center text-muted-foreground">
            Status: <span className="font-medium">{getStatusLabel(finalStatus)}</span>
          </p>
          <div className="space-y-2">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => lastPrintedBatchId && window.open(`/print/exit/${order.id}?batchId=${lastPrintedBatchId}`, "_blank")}
              disabled={!lastPrintedBatchId}
            >
              <Printer className="w-4 h-4 mr-2" /> Imprimir Nota de Saída (Térmica)
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Finalizar OS {order.orderNumber}</DialogTitle>
        <DialogDescription>
          Registre a baixa/saída desta ordem de serviço.
        </DialogDescription>
      </DialogHeader>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <div className="space-y-4 py-4">
        {!isLegacySingleItem && (
          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Itens desta saída</p>
              <p className="text-xs text-muted-foreground">
                Selecione apenas os itens que estão sendo entregues agora.
              </p>
            </div>
            <div className="space-y-3">
              {itemSummaries.map((item) => {
                const isClosed = isOrderItemFinalized(item);

                return (
                  <label
                    key={item.itemNumber}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${isClosed ? "bg-muted/50 opacity-70" : ""}`}
                  >
                    <Checkbox
                      checked={isClosed || selectedItemNumbers.includes(item.itemNumber)}
                      disabled={isClosed}
                      onCheckedChange={(checked) => {
                        if (isClosed) return;
                        setSelectedItemNumbers((current) =>
                          checked
                            ? Array.from(new Set([...current, item.itemNumber]))
                            : current.filter((itemNumber) => itemNumber !== item.itemNumber)
                        );
                      }}
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.applianceLabel}</p>
                      <p className="text-xs text-muted-foreground">{item.defect}</p>
                      <p className="text-xs text-muted-foreground">
                        {isClosed
                          ? `Já finalizado: ${getStatusLabel(item.finalStatus || "ENTREGUE")}`
                          : `Status atual: ${item.status || "Recebido"}`}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Situação de Finalização *</label>
          <Select onValueChange={setFinalStatus} value={finalStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ENTREGUE">Consertado e entregue</SelectItem>
              <SelectItem value="NAO_AUTORIZADO">Não autorizado (retirado pelo cliente)</SelectItem>
              <SelectItem value="DESCARTE_AUTORIZADO">Autorizado para descarte</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Entregue para</label>
          <Input
            placeholder="Nome de quem retirou (opcional)"
            value={deliveredTo}
            onChange={(e) => setDeliveredTo(e.target.value)}
          />
        </div>

        {(isLegacySingleItem || isCompletingOrder) && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Forma de Pagamento</label>
            <Select onValueChange={setPaymentMethod} value={paymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                <SelectItem value="Transferência">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Peças Utilizadas</label>
          <Textarea
            placeholder="Liste as peças utilizadas (ex: 1x Capacitor 10uF - R$15,00)"
            value={partsDescription}
            onChange={(e) => setPartsDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Garantia (dias)</label>
          <Input
            type="number"
            placeholder="90"
            value={warrantyDays}
            onChange={(e) => setWarrantyDays(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Observações da Finalização</label>
          <Textarea
            placeholder="Anotações sobre a finalização..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter className="!flex-col gap-2 sm:!flex-row">
        <Button variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button className="w-full sm:w-auto" onClick={handleFinalize} disabled={!finalStatus || isPending}>
          {isPending ? "Finalizando..." : "Confirmar Baixa"}
        </Button>
      </DialogFooter>
    </>
  );
}
