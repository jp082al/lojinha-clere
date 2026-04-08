import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useCustomers, useCreateCustomer } from "@/hooks/use-customers";
import { useAppliances, useCreateAppliance } from "@/hooks/use-appliances";
import { useCreateServiceOrder } from "@/hooks/use-service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Phone,
  MapPin,
  Wrench,
  CheckCircle2,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  Printer,
  Tag,
  MessageSquare,
  List,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Appliance, InsertCustomer, InsertAppliance } from "@shared/schema";

const MAX_ORDER_ITEMS = 10;

type OrderItemForm = {
  id: number;
  selectedApplianceId: string;
  isNewAppliance: boolean;
  newApplianceData: Partial<InsertAppliance>;
  defect: string;
  notes: string;
};

let nextOrderItemId = 1;

function createOrderItem(forceNewAppliance = false): OrderItemForm {
  return {
    id: nextOrderItemId++,
    selectedApplianceId: "",
    isNewAppliance: forceNewAppliance,
    newApplianceData: {
      type: "",
      brand: "",
      model: "",
      serialNumber: "",
    },
    defect: "",
    notes: "",
  };
}

function getPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhone(value: string) {
  const digits = getPhoneDigits(value);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;

  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isPhoneSearch(value: string) {
  const trimmed = value.trim();
  const digits = getPhoneDigits(trimmed);
  const nonPhoneChars = trimmed.replace(/[0-9()\-\s+]/g, "");

  return digits.length >= 8 && nonPhoneChars.length === 0;
}

export default function NewOrder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<Partial<InsertCustomer>>({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([createOrderItem(false)]);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  const { data: customers } = useCustomers();
  const { data: appliances, isLoading: isLoadingAppliances } = useAppliances(selectedCustomer?.id || 0);
  const { mutateAsync: createCustomer, isPending: isCreatingCustomer } = useCreateCustomer();
  const { mutateAsync: createAppliance, isPending: isCreatingAppliance } = useCreateAppliance();
  const { mutateAsync: createServiceOrder, isPending: isCreatingOrder } = useCreateServiceOrder();

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim() || !customers) return [];
    const search = customerSearch.toLowerCase();
    const searchDigits = getPhoneDigits(customerSearch);

    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(search) ||
      (searchDigits.length > 0 && getPhoneDigits(customer.phone).includes(searchDigits))
    ).slice(0, 5);
  }, [customerSearch, customers]);

  const showNewCustomerOption = customerSearch.trim().length >= 2 && !selectedCustomer;

  useEffect(() => {
    setOrderItems([createOrderItem(isNewCustomer)]);
  }, [selectedCustomer?.id, isNewCustomer]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setIsNewCustomer(false);
  };

  const handleStartNewCustomer = () => {
    const phoneSearch = isPhoneSearch(customerSearch);

    setIsNewCustomer(true);
    setSelectedCustomer(null);
    setNewCustomerData({
      name: phoneSearch ? "" : customerSearch,
      phone: phoneSearch ? formatPhone(customerSearch) : "",
      address: "",
      notes: "",
    });
  };

  const updateOrderItem = (itemId: number, updater: (item: OrderItemForm) => OrderItemForm) => {
    setOrderItems((currentItems) =>
      currentItems.map((item) => item.id === itemId ? updater(item) : item)
    );
  };

  const handleSelectAppliance = (itemId: number, applianceValue: string) => {
    updateOrderItem(itemId, (item) => ({
      ...item,
      selectedApplianceId: applianceValue === "new" ? "" : applianceValue,
      isNewAppliance: applianceValue === "new",
    }));
  };

  const handleAddItem = () => {
    setOrderItems((currentItems) => {
      if (currentItems.length >= MAX_ORDER_ITEMS) return currentItems;
      return [...currentItems, createOrderItem(isNewCustomer)];
    });
  };

  const handleRemoveItem = (itemId: number) => {
    setOrderItems((currentItems) => {
      if (currentItems.length === 1) return currentItems;
      return currentItems.filter((item) => item.id !== itemId);
    });
  };

  const resetForm = () => {
    setCreatedOrder(null);
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setCustomerSearch("");
    setNewCustomerData({ name: "", phone: "", address: "", notes: "" });
    setOrderItems([createOrderItem(false)]);
  };

  const selectedCustomerHasAddress = !!selectedCustomer?.address?.trim();
  const customerNeedsAddress = !!selectedCustomer && !selectedCustomerHasAddress;
  const isCustomerValid =
    (selectedCustomer && selectedCustomerHasAddress) ||
    (isNewCustomer && newCustomerData.name && newCustomerData.phone && newCustomerData.address?.trim());

  const isOrderItemsValid = orderItems.length >= 1 && orderItems.length <= MAX_ORDER_ITEMS && orderItems.every((item) => {
    const hasExistingAppliance = !!item.selectedApplianceId;
    const hasNewAppliance =
      item.isNewAppliance &&
      item.newApplianceData.type &&
      item.newApplianceData.brand &&
      item.newApplianceData.model;

    return (hasExistingAppliance || hasNewAppliance) && item.defect.trim().length > 0;
  });

  const canSubmit = isCustomerValid && isOrderItemsValid;

  const handleSubmit = async () => {
    if (customerNeedsAddress) {
      toast({
        title: "Endereço obrigatório",
        description: "Complete o cadastro do cliente com endereço antes de abrir a OS.",
        variant: "destructive",
      });
      return;
    }

    try {
      let customerId = selectedCustomer?.id;

      if (isNewCustomer && !selectedCustomer) {
        const newCustomer = await createCustomer({
          name: newCustomerData.name!,
          phone: newCustomerData.phone!,
          address: newCustomerData.address!.trim(),
          notes: newCustomerData.notes || null,
        });
        customerId = newCustomer.id;
      }

      if (!customerId) {
        throw new Error("Customer not resolved");
      }

      const resolvedItems = [];

      for (const item of orderItems) {
        let applianceId = item.selectedApplianceId ? Number(item.selectedApplianceId) : undefined;

        if (item.isNewAppliance && !applianceId) {
          const newAppliance = await createAppliance({
            customerId,
            type: item.newApplianceData.type!,
            brand: item.newApplianceData.brand!,
            model: item.newApplianceData.model!,
            serialNumber: item.newApplianceData.serialNumber || null,
          });
          applianceId = newAppliance.id;
        }

        if (!applianceId) {
          throw new Error("Appliance not resolved");
        }

        resolvedItems.push({
          applianceId,
          defect: item.defect.trim(),
          observations: item.notes.trim() || null,
          diagnosis: null,
          status: "Recebido",
          serviceValue: "0",
          partsValue: "0",
          totalValue: "0",
        });
      }

      const primaryItem = resolvedItems[0];

      const order = await createServiceOrder({
        customerId,
        applianceId: primaryItem.applianceId,
        defect: primaryItem.defect,
        observations: primaryItem.observations,
        diagnosis: primaryItem.diagnosis,
        status: primaryItem.status,
        serviceValue: primaryItem.serviceValue,
        partsValue: primaryItem.partsValue,
        totalValue: primaryItem.totalValue,
        items: resolvedItems,
      });

      toast({
        title: "OS Criada com Sucesso!",
        description: `Ordem de Serviço ${order.orderNumber} registrada.`,
      });

      setCreatedOrder({
        ...order,
        itemCount: resolvedItems.length,
        customerName: isNewCustomer ? newCustomerData.name : selectedCustomer?.name,
        customerPhone: isNewCustomer ? newCustomerData.phone : selectedCustomer?.phone,
      });
    } catch {
      toast({
        title: "Erro ao criar OS",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = isCreatingCustomer || isCreatingAppliance || isCreatingOrder;

  if (createdOrder) {
    return (
      <div className="mx-auto max-w-lg space-y-5 py-4 sm:space-y-6 sm:py-8">
        <Card className="border-green-200 bg-green-50/50 text-center">
          <CardContent className="space-y-4 px-4 pb-5 pt-6 sm:pb-6 sm:pt-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 sm:h-16 sm:w-16">
              <CheckCircle2 className="h-7 w-7 text-green-600 sm:h-8 sm:w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-900 sm:text-2xl">OS Criada com Sucesso!</h2>
              <p className="mt-1 text-green-700">Ordem de Serviço #{createdOrder.id} registrada.</p>
              <p className="mt-1 text-sm text-green-700">
                {createdOrder.itemCount} {createdOrder.itemCount === 1 ? "aparelho registrado" : "aparelhos registrados"}.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            <CardDescription>Imprima ou envie os comprovantes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="h-12 w-full justify-start text-left"
              variant="outline"
              onClick={() => window.open(`/print/receipt/${createdOrder.id}`, "_blank")}
              data-testid="button-print-receipt"
            >
              <Printer className="mr-3 h-5 w-5" />
              Imprimir Nota de Entrada (Térmica)
            </Button>

            <Button
              className="h-12 w-full justify-start text-left"
              variant="outline"
              onClick={() => window.open(`/print/label/${createdOrder.id}`, "_blank")}
              data-testid="button-print-label"
            >
              <Tag className="mr-3 h-5 w-5" />
              Imprimir Etiqueta (Térmica)
            </Button>

            <Separator />

            <Button
              className="h-12 w-full justify-start text-left text-green-600"
              variant="outline"
              onClick={() => {
                const message = `Olá ${createdOrder.customerName}!\n\nSua OS ${createdOrder.orderNumber} foi registrada com sucesso.`;
                window.open(`https://wa.me/55${(createdOrder.customerPhone || "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank");
              }}
              data-testid="button-whatsapp-success"
            >
              <MessageSquare className="mr-3 h-5 w-5" />
              Enviar Comprovante por WhatsApp
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setLocation("/orders")}
          >
            <List className="mr-2 h-4 w-4" />
            Ver Ordens
          </Button>
          <Button
            className="flex-1"
            onClick={resetForm}
            data-testid="button-new-order-again"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova OS
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 overflow-x-hidden sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nova Ordem de Serviço</h1>
        <p className="text-muted-foreground">Registre um novo serviço de forma rápida e simples.</p>
      </div>

      <Card className={selectedCustomer || isNewCustomer ? "border-primary/30 bg-primary/5" : ""}>
        <CardHeader className="px-4 pb-3 pt-5 sm:px-6">
          <div className="flex items-start gap-3 sm:items-center">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:mt-0 ${
              selectedCustomer || isNewCustomer ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {selectedCustomer || isNewCustomer ? <CheckCircle2 className="h-5 w-5" /> : "1"}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Cliente</CardTitle>
              <CardDescription>Busque pelo nome ou telefone</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          {!isNewCustomer && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Digite o nome ou telefone do cliente..."
                className="h-12 pl-10 text-base sm:text-lg"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                    setSelectedCustomer(null);
                  }
                }}
                data-testid="input-customer-search"
              />

              {customerSearch && !selectedCustomer && (filteredCustomers.length > 0 || showNewCustomerOption) && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(60vh,24rem)] overflow-y-auto rounded-xl border bg-card shadow-lg">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted sm:items-center"
                      onClick={() => handleSelectCustomer(customer)}
                      data-testid={`customer-option-${customer.id}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                        {customer.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{customer.name}</p>
                        <p className="break-words text-sm text-muted-foreground">
                          Cliente #{customer.id}
                          {customer.phone ? ` • ${customer.phone}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}

                  {showNewCustomerOption && (
                    <>
                      {filteredCustomers.length > 0 && <Separator />}
                      <div
                        className="flex cursor-pointer items-start gap-3 p-3 text-primary transition-colors hover:bg-primary/10 sm:items-center"
                        onClick={handleStartNewCustomer}
                        data-testid="button-new-customer"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Plus className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">Cadastrar "{customerSearch}"</p>
                          <p className="text-sm text-muted-foreground">
                            Criar novo cadastro mesmo se houver nomes parecidos
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedCustomer && (
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary sm:h-12 sm:w-12 sm:text-lg">
                    {selectedCustomer.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-base font-semibold sm:text-lg">{selectedCustomer.name}</p>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {selectedCustomer.phone}
                      </span>
                      {selectedCustomer.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {selectedCustomer.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {customerNeedsAddress && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Este cliente não tem endereço cadastrado. Complete o cadastro do cliente antes de abrir a OS.</p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 self-stretch sm:h-9 sm:self-auto"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch("");
                }}
                data-testid="button-change-customer"
              >
                Alterar
              </Button>
            </div>
          )}

          {isNewCustomer && (
            <div className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Badge variant="secondary">Novo Cliente</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start sm:self-auto"
                  onClick={() => {
                    setIsNewCustomer(false);
                    setCustomerSearch("");
                  }}
                >
                  Cancelar
                </Button>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome *</label>
                    <Input
                      placeholder="Nome completo"
                      value={newCustomerData.name}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                      data-testid="input-new-customer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefone / WhatsApp *</label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={newCustomerData.phone || ""}
                      onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: formatPhone(e.target.value) })}
                      data-testid="input-new-customer-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço *</label>
                  <Input
                    placeholder="Rua, número, bairro"
                    value={newCustomerData.address || ""}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                    data-testid="input-new-customer-address"
                  />
                  {!newCustomerData.address?.trim() && (
                    <p className="text-xs text-destructive">Informe o endereço do cliente.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={`transition-opacity ${!isCustomerValid ? "pointer-events-none opacity-50" : ""} ${isOrderItemsValid ? "border-primary/30 bg-primary/5" : ""}`}>
        <CardHeader className="px-4 pb-3 pt-5 sm:px-6">
          <div className="flex items-start gap-3 sm:items-center">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:mt-0 ${
              isOrderItemsValid ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {isOrderItemsValid ? <CheckCircle2 className="h-5 w-5" /> : "2"}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">Itens da OS</CardTitle>
              <CardDescription>Adicione de 1 a 10 aparelhos na mesma abertura.</CardDescription>
            </div>
            <Badge variant="secondary">{orderItems.length}/{MAX_ORDER_ITEMS}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          {orderItems.map((item, index) => {
            const selectedAppliance = appliances?.find((appliance) => appliance.id.toString() === item.selectedApplianceId);

            return (
              <div key={item.id} className="space-y-4 rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Item {index + 1}</Badge>
                    {index === 0 && <Badge variant="secondary">Principal</Badge>}
                  </div>
                  {orderItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start text-destructive hover:text-destructive sm:self-auto"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover item
                    </Button>
                  )}
                </div>

                {selectedCustomer && !isNewCustomer && (
                  <Select
                    onValueChange={(value) => handleSelectAppliance(item.id, value)}
                    value={item.selectedApplianceId || (item.isNewAppliance ? "new" : "")}
                  >
                    <SelectTrigger className="h-12 text-base" data-testid={`select-appliance-${index + 1}`}>
                      <SelectValue placeholder="Selecione um aparelho..." />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingAppliances ? (
                        <div className="p-4 text-center text-muted-foreground">Carregando...</div>
                      ) : (
                        <>
                          {appliances?.map((appliance) => (
                            <SelectItem key={`${item.id}-${appliance.id}`} value={appliance.id.toString()}>
                              {appliance.type} - {appliance.brand} {appliance.model}
                            </SelectItem>
                          ))}
                          <SelectItem value="new" className="font-medium text-primary">
                            + Cadastrar novo aparelho
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}

                {isNewCustomer && !item.isNewAppliance && (
                  <Button
                    variant="outline"
                    className="h-12 w-full"
                    onClick={() => updateOrderItem(item.id, (currentItem) => ({ ...currentItem, isNewAppliance: true }))}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar Aparelho
                  </Button>
                )}

                {item.isNewAppliance && (
                  <div className="space-y-4 rounded-xl border bg-background p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Badge variant="secondary">Novo Aparelho</Badge>
                      {!isNewCustomer && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-start sm:self-auto"
                          onClick={() => updateOrderItem(item.id, (currentItem) => ({
                            ...currentItem,
                            isNewAppliance: false,
                            selectedApplianceId: "",
                          }))}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tipo *</label>
                          <Input
                            placeholder="Ex: Geladeira"
                            value={item.newApplianceData.type || ""}
                            onChange={(e) => updateOrderItem(item.id, (currentItem) => ({
                              ...currentItem,
                              newApplianceData: { ...currentItem.newApplianceData, type: e.target.value },
                            }))}
                            data-testid={`input-appliance-type-${index + 1}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Marca *</label>
                          <Input
                            placeholder="Ex: Brastemp"
                            value={item.newApplianceData.brand || ""}
                            onChange={(e) => updateOrderItem(item.id, (currentItem) => ({
                              ...currentItem,
                              newApplianceData: { ...currentItem.newApplianceData, brand: e.target.value },
                            }))}
                            data-testid={`input-appliance-brand-${index + 1}`}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Modelo *</label>
                          <Input
                            placeholder="Ex: BRM50"
                            value={item.newApplianceData.model || ""}
                            onChange={(e) => updateOrderItem(item.id, (currentItem) => ({
                              ...currentItem,
                              newApplianceData: { ...currentItem.newApplianceData, model: e.target.value },
                            }))}
                            data-testid={`input-appliance-model-${index + 1}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nº de Série</label>
                          <Input
                            placeholder="Opcional"
                            value={item.newApplianceData.serialNumber || ""}
                            onChange={(e) => updateOrderItem(item.id, (currentItem) => ({
                              ...currentItem,
                              newApplianceData: { ...currentItem.newApplianceData, serialNumber: e.target.value },
                            }))}
                            data-testid={`input-appliance-serial-${index + 1}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppliance && !item.isNewAppliance && (
                  <div className="flex items-start gap-3 rounded-xl border bg-background p-4 sm:items-center sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
                      <Wrench className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">{selectedAppliance.type} - {selectedAppliance.brand}</p>
                      <p className="text-sm text-muted-foreground">Modelo: {selectedAppliance.model}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Defeito relatado *</label>
                  <Textarea
                    placeholder="Ex: Não está gelando, faz barulho estranho, não liga..."
                    className="min-h-[110px] text-base"
                    value={item.defect}
                    onChange={(e) => updateOrderItem(item.id, (currentItem) => ({ ...currentItem, defect: e.target.value }))}
                    data-testid={`input-defect-${index + 1}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações internas</label>
                  <Textarea
                    placeholder="Anotações para uso interno (opcional)"
                    className="min-h-[88px]"
                    value={item.notes}
                    onChange={(e) => updateOrderItem(item.id, (currentItem) => ({ ...currentItem, notes: e.target.value }))}
                    data-testid={`input-notes-${index + 1}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este campo nao alimenta o diagnostico tecnico nem a impressao da OS.
                  </p>
                </div>
              </div>
            );
          })}

          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={handleAddItem}
            disabled={orderItems.length >= MAX_ORDER_ITEMS}
            data-testid="button-add-order-item"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar outro aparelho
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
        <Button
          variant="outline"
          className="h-11 flex-1 sm:h-12"
          onClick={() => setLocation("/orders")}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          className="h-12 flex-1 text-base shadow-lg transition-shadow hover:shadow-xl sm:text-lg"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          data-testid="button-submit-order"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              Criar Ordem de Serviço
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>

      {!canSubmit && (
        <div className="flex items-center justify-center gap-2 px-2 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Preencha cliente, aparelho e defeito de cada item para continuar</span>
        </div>
      )}
    </div>
  );
}
