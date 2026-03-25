import { useState } from "react";
import { useLocation } from "wouter";
import { useServiceOrders, useCreateServiceOrder, useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { useCustomers } from "@/hooks/use-customers";
import { useAppliances } from "@/hooks/use-appliances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

  const filteredOrders = orders.filter((order) => {
    const matchesTab = activeTab === "all" || getOrderTab(order) === activeTab;

    if (!matchesTab) return false;
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();

    return (
      (order.orderNumber || "").toLowerCase().includes(search) ||
      (order.customer.name || "").toLowerCase().includes(search) ||
      (order.customer.phone || "").toLowerCase().includes(search) ||
      (order.appliance.model || "").toLowerCase().includes(search) ||
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
        
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:pb-0">
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
                        {order.appliance.type} {order.appliance.brand} - {order.defect}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-3 border-t pt-3 md:items-end md:border-t-0 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-sm text-muted-foreground">Total Estimado</p>
                        <p className="text-xl font-bold text-primary sm:text-2xl">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.totalValue))}
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
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
          {editingOrder && (
            <OrderDetails 
              order={editingOrder} 
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

function OrderDetails({ order, onClose, onFinalize }: { order: any, onClose: () => void, onFinalize: () => void }) {
  const { mutate: update, isPending } = useUpdateServiceOrder();
  const { toast } = useToast();
  const { hasPermission, user } = useAuth();
  const [budgetOpen, setBudgetOpen] = useState(true);
  
  const form = useForm<InsertServiceOrder>({
    resolver: zodResolver(insertServiceOrderSchema),
    defaultValues: {
      customerId: order.customerId,
      applianceId: order.applianceId,
      defect: order.defect,
      diagnosis: order.diagnosis || "",
      status: order.status,
      serviceValue: order.serviceValue,
      partsValue: order.partsValue,
      totalValue: order.totalValue
    }
  });

  const onSubmit = (data: InsertServiceOrder) => {
    const total = (Number(data.serviceValue) + Number(data.partsValue)).toString();
    const finalData = { ...data, totalValue: total };
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

  const isFinalized = order.finalStatus || order.status === "Entregue";

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
        {isFinalized && (
          <Button 
            size="sm" 
            variant="outline"
            className="min-h-10 justify-start text-blue-600"
            onClick={() => window.open(`/print/exit/${order.id}`, '_blank')}
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
            const subject = `OS #${order.id} - ${order.appliance.type} ${order.appliance.brand}`;
            const body = `Olá ${order.customer.name},\n\nSua OS ${order.orderNumber} está com status: ${order.status}\n\nAparelho: ${order.appliance.type} ${order.appliance.brand} ${order.appliance.model}\nDefeito: ${order.defect}\n\n${trackingUrl ? `Acompanhe online: ${trackingUrl}` : ''}\n\nAtenciosamente,\nTechRepair`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
          }}
        >
          <Mail className="w-4 h-4 mr-2" /> Email
        </Button>
      </div>

      <Separator />

      {/* Customer & Appliance Info */}
      <div className="grid grid-cols-1 gap-4 py-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Cliente</p>
          <p className="font-medium">{order.customer.name}</p>
          <p className="text-muted-foreground">{order.customer.phone}</p>
          <p className="text-muted-foreground">{order.customer.address || "Não informado"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Aparelho</p>
          <p className="font-medium">{order.appliance.type} {order.appliance.brand}</p>
          <p className="text-muted-foreground">{order.appliance.model}</p>
        </div>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
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

          <FormField
            control={form.control}
            name="diagnosis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Diagnóstico Técnico</FormLabel>
                <FormControl>
                  <Textarea placeholder="Diagnóstico do técnico..." {...field} value={field.value || ""} disabled={isFinalized} />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isFinalized}>
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
                      <SelectItem value="Entregue">Entregue</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="serviceValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mão de Obra</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value || "0"} disabled={isFinalized} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partsValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peças</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value || "0"} disabled={isFinalized} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <span className="font-semibold">Total:</span>
            <span className="text-lg font-bold text-primary sm:text-xl">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                Number(form.watch("serviceValue") || 0) + Number(form.watch("partsValue") || 0)
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
            {!isFinalized && (
              <Button 
                type="button" 
                variant="outline" 
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={onFinalize}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Dar Baixa
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
    const trackingUrl = order.trackingToken 
      ? `${window.location.origin}/acompanhamento/${order.trackingToken}`
      : "";
    const message = `Olá ${order.customer.name}!\n\nSegue o orçamento para a OS #${order.id}:\n\n*Aparelho:* ${order.appliance.type} ${order.appliance.brand}\n*Defeito:* ${order.defect}\n*Diagnóstico:* ${order.diagnosis || "Em análise"}\n\n*Valores:*\nMão de Obra: R$ ${order.serviceValue}\nPeças: R$ ${order.partsValue}\n*Total: R$ ${order.totalValue}*\n\n*Validade:* ${order.budgetValidityDays || 7} dias\n\n${trackingUrl ? `Acompanhe e aprove online: ${trackingUrl}` : ""}`;
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
  const [finalStatus, setFinalStatus] = useState<string>("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || "");
  const [partsDescription, setPartsDescription] = useState(order.partsDescription || "");
  const [warrantyDays, setWarrantyDays] = useState(order.warrantyDays?.toString() || "90");
  const [finalizationSuccess, setFinalizationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFinalize = () => {
    if (!finalStatus) return;
    setErrorMessage(null);

    update({ 
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
    }, { 
      onSuccess: async () => {
        // Record payment if finalized as ENTREGUE
        if (finalStatus === "ENTREGUE") {
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
          title: "OS finalizada com sucesso!", 
          description: `Status: ${getStatusLabel(finalStatus)}` 
        });
        setFinalizationSuccess(true);
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

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      "ENTREGUE": "Consertado e entregue",
      "NAO_AUTORIZADO": "Não autorizado (retirado)",
      "DESCARTE_AUTORIZADO": "Autorizado para descarte"
    };
    return labels[status] || status;
  };

  if (finalizationSuccess) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            OS {order.orderNumber} Finalizada!
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
              onClick={() => window.open(`/print/exit/${order.id}`, '_blank')}
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
