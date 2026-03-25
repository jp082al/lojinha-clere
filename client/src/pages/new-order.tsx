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
  User, 
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
  List
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Appliance, InsertCustomer, InsertAppliance } from "@shared/schema";

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
  
  // Customer state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<Partial<InsertCustomer>>({
    name: "",
    phone: "",
    address: "",
    notes: ""
  });

  // Appliance state
  const [selectedAppliance, setSelectedAppliance] = useState<Appliance | null>(null);
  const [isNewAppliance, setIsNewAppliance] = useState(false);
  const [newApplianceData, setNewApplianceData] = useState<Partial<InsertAppliance>>({
    type: "",
    brand: "",
    model: "",
    serialNumber: ""
  });

  // Service order state
  const [defect, setDefect] = useState("");
  const [notes, setNotes] = useState("");
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  // Queries and mutations
  const { data: customers, isLoading: isLoadingCustomers } = useCustomers();
  const { data: appliances, isLoading: isLoadingAppliances } = useAppliances(selectedCustomer?.id || 0);
  const { mutateAsync: createCustomer, isPending: isCreatingCustomer } = useCreateCustomer();
  const { mutateAsync: createAppliance, isPending: isCreatingAppliance } = useCreateAppliance();
  const { mutateAsync: createServiceOrder, isPending: isCreatingOrder } = useCreateServiceOrder();

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim() || !customers) return [];
    const search = customerSearch.toLowerCase();
    const searchDigits = getPhoneDigits(customerSearch);

    return customers.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (searchDigits.length > 0 && getPhoneDigits(c.phone).includes(searchDigits))
    ).slice(0, 5);
  }, [customerSearch, customers]);

  // Keep the option to register a new customer available even when there are name matches.
  const showNewCustomerOption = customerSearch.trim().length >= 2 && !selectedCustomer;

  // Reset appliance when customer changes
  useEffect(() => {
    setSelectedAppliance(null);
    setIsNewAppliance(false);
  }, [selectedCustomer?.id]);

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setIsNewCustomer(false);
  };

  // Handle starting new customer creation
  const handleStartNewCustomer = () => {
    const phoneSearch = isPhoneSearch(customerSearch);

    setIsNewCustomer(true);
    setSelectedCustomer(null);
    setNewCustomerData({
      name: phoneSearch ? "" : customerSearch,
      phone: phoneSearch ? formatPhone(customerSearch) : "",
      address: "",
      notes: ""
    });
  };

  // Handle appliance selection
  const handleSelectAppliance = (applianceId: string) => {
    if (applianceId === "new") {
      setIsNewAppliance(true);
      setSelectedAppliance(null);
    } else {
      const appliance = appliances?.find(a => a.id.toString() === applianceId);
      if (appliance) {
        setSelectedAppliance(appliance);
        setIsNewAppliance(false);
      }
    }
  };

  // Validate form
  const isCustomerValid = selectedCustomer || (isNewCustomer && newCustomerData.name && newCustomerData.phone && newCustomerData.address?.trim());
  const isApplianceValid = selectedAppliance || (isNewAppliance && newApplianceData.type && newApplianceData.brand && newApplianceData.model);
  const isDefectValid = defect.trim().length > 0;
  const canSubmit = isCustomerValid && isApplianceValid && isDefectValid;

  // Handle form submission
  const handleSubmit = async () => {
    try {
      let customerId = selectedCustomer?.id;
      let applianceId = selectedAppliance?.id;

      // Create customer if new
      if (isNewCustomer && !selectedCustomer) {
        const newCustomer = await createCustomer({
          name: newCustomerData.name!,
          phone: newCustomerData.phone!,
          address: newCustomerData.address!.trim(),
          notes: newCustomerData.notes || null
        });
        customerId = newCustomer.id;
      }

      // Create appliance if new
      if (isNewAppliance && !selectedAppliance && customerId) {
        const newAppliance = await createAppliance({
          customerId: customerId,
          type: newApplianceData.type!,
          brand: newApplianceData.brand!,
          model: newApplianceData.model!,
          serialNumber: newApplianceData.serialNumber || null
        });
        applianceId = newAppliance.id;
      }

      // Create service order
      if (customerId && applianceId) {
        const order = await createServiceOrder({
          customerId: customerId,
          applianceId: applianceId,
          defect: defect,
          observations: notes || null,
          diagnosis: null,
          status: "Recebido",
          serviceValue: "0",
          partsValue: "0",
          totalValue: "0"
        });

        toast({
          title: "OS Criada com Sucesso!",
          description: `Ordem de Serviço ${order.orderNumber} registrada.`,
        });

        setCreatedOrder({
          ...order,
          customerName: isNewCustomer ? newCustomerData.name : selectedCustomer?.name,
          customerPhone: isNewCustomer ? newCustomerData.phone : selectedCustomer?.phone
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao criar OS",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = isCreatingCustomer || isCreatingAppliance || isCreatingOrder;

  // Success state - show print options after order creation
  if (createdOrder) {
    const trackingUrl = createdOrder.trackingToken 
      ? `${window.location.origin}/acompanhamento/${createdOrder.trackingToken}`
      : null;

    return (
      <div className="mx-auto max-w-lg space-y-5 py-4 sm:space-y-6 sm:py-8">
        <Card className="text-center border-green-200 bg-green-50/50">
          <CardContent className="space-y-4 px-4 pb-5 pt-6 sm:pt-8 sm:pb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 sm:h-16 sm:w-16">
              <CheckCircle2 className="h-7 w-7 text-green-600 sm:h-8 sm:w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-900 sm:text-2xl">OS Criada com Sucesso!</h2>
              <p className="text-green-700 mt-1">Ordem de Serviço #{createdOrder.id} registrada.</p>
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
              onClick={() => window.open(`/print/receipt/${createdOrder.id}`, '_blank')}
              data-testid="button-print-receipt"
            >
              <Printer className="h-5 w-5 mr-3" />
              Imprimir Nota de Entrada (Térmica)
            </Button>
            
            <Button
              className="h-12 w-full justify-start text-left"
              variant="outline"
              onClick={() => window.open(`/print/label/${createdOrder.id}`, '_blank')}
              data-testid="button-print-label"
            >
              <Tag className="h-5 w-5 mr-3" />
              Imprimir Etiqueta (Térmica)
            </Button>

            <Separator />

            <Button
              className="h-12 w-full justify-start text-left text-green-600"
              variant="outline"
              onClick={() => {
                const message = `Olá ${createdOrder.customerName}!\n\nSua OS ${createdOrder.orderNumber} foi registrada com sucesso.\n\n${trackingUrl ? `Acompanhe online: ${trackingUrl}` : ''}`;
                window.open(`https://wa.me/55${(createdOrder.customerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              data-testid="button-whatsapp-success"
            >
              <MessageSquare className="h-5 w-5 mr-3" />
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
            <List className="h-4 w-4 mr-2" />
            Ver Ordens
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setCreatedOrder(null);
              setSelectedCustomer(null);
              setSelectedAppliance(null);
              setIsNewCustomer(false);
              setIsNewAppliance(false);
              setCustomerSearch("");
              setDefect("");
              setNotes("");
              setNewCustomerData({ name: "", phone: "", address: "", notes: "" });
              setNewApplianceData({ type: "", brand: "", model: "", serialNumber: "" });
            }}
            data-testid="button-new-order-again"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova OS
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nova Ordem de Serviço</h1>
        <p className="text-muted-foreground">Registre um novo serviço de forma rápida e simples.</p>
      </div>

      {/* Step 1: Customer */}
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              
              {/* Autocomplete dropdown */}
              {customerSearch && !selectedCustomer && (filteredCustomers.length > 0 || showNewCustomerOption) && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(60vh,24rem)] overflow-y-auto rounded-xl border bg-card shadow-lg">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted sm:items-center"
                      onClick={() => handleSelectCustomer(customer)}
                      data-testid={`customer-option-${customer.id}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {customer.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{customer.name}</p>
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

          {/* Selected customer info */}
          {selectedCustomer && (
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:gap-4 sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary sm:h-12 sm:w-12 sm:text-lg">
                  {selectedCustomer.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold sm:text-lg break-words">{selectedCustomer.name}</p>
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

          {/* New customer form */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome *</label>
                    <Input
                      placeholder="Nome completo"
                      value={newCustomerData.name}
                      onChange={(e) => setNewCustomerData({...newCustomerData, name: e.target.value})}
                      data-testid="input-new-customer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefone / WhatsApp *</label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={newCustomerData.phone || ""}
                      onChange={(e) => setNewCustomerData({...newCustomerData, phone: formatPhone(e.target.value)})}
                      data-testid="input-new-customer-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço *</label>
                  <Input
                    placeholder="Rua, número, bairro"
                    value={newCustomerData.address || ""}
                    onChange={(e) => setNewCustomerData({...newCustomerData, address: e.target.value})}
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

      {/* Step 2: Appliance */}
      <Card className={`transition-opacity ${!isCustomerValid ? "opacity-50 pointer-events-none" : ""} ${selectedAppliance || isNewAppliance ? "border-primary/30 bg-primary/5" : ""}`}>
        <CardHeader className="px-4 pb-3 pt-5 sm:px-6">
          <div className="flex items-start gap-3 sm:items-center">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:mt-0 ${
              selectedAppliance || isNewAppliance ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {selectedAppliance || isNewAppliance ? <CheckCircle2 className="h-5 w-5" /> : "2"}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Aparelho</CardTitle>
              <CardDescription>Selecione ou cadastre o aparelho</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          {selectedCustomer && !isNewCustomer && (
            <Select 
              onValueChange={handleSelectAppliance}
              value={selectedAppliance?.id.toString() || (isNewAppliance ? "new" : "")}
            >
              <SelectTrigger className="h-12 text-base" data-testid="select-appliance">
                <SelectValue placeholder="Selecione um aparelho..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingAppliances ? (
                  <div className="p-4 text-center text-muted-foreground">Carregando...</div>
                ) : (
                  <>
                    {appliances?.map((appliance) => (
                      <SelectItem key={appliance.id} value={appliance.id.toString()}>
                        {appliance.type} - {appliance.brand} {appliance.model}
                      </SelectItem>
                    ))}
                    <SelectItem value="new" className="text-primary font-medium">
                      + Cadastrar novo aparelho
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          )}

          {/* Auto-show new appliance form for new customers */}
          {isNewCustomer && !isNewAppliance && (
            <Button 
              variant="outline" 
              className="w-full h-12"
              onClick={() => setIsNewAppliance(true)}
              data-testid="button-add-appliance"
            >
              <Plus className="h-4 w-4 mr-2" /> Cadastrar Aparelho
            </Button>
          )}

          {/* New appliance form */}
          {isNewAppliance && (
            <div className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Badge variant="secondary">Novo Aparelho</Badge>
                {!isNewCustomer && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="self-start sm:self-auto"
                    onClick={() => setIsNewAppliance(false)}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
              
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo *</label>
                    <Input
                      placeholder="Ex: Geladeira"
                      value={newApplianceData.type}
                      onChange={(e) => setNewApplianceData({...newApplianceData, type: e.target.value})}
                      data-testid="input-appliance-type"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Marca *</label>
                    <Input
                      placeholder="Ex: Brastemp"
                      value={newApplianceData.brand}
                      onChange={(e) => setNewApplianceData({...newApplianceData, brand: e.target.value})}
                      data-testid="input-appliance-brand"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Modelo *</label>
                    <Input
                      placeholder="Ex: BRM50"
                      value={newApplianceData.model}
                      onChange={(e) => setNewApplianceData({...newApplianceData, model: e.target.value})}
                      data-testid="input-appliance-model"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nº de Série</label>
                    <Input
                      placeholder="Opcional"
                      value={newApplianceData.serialNumber || ""}
                      onChange={(e) => setNewApplianceData({...newApplianceData, serialNumber: e.target.value})}
                      data-testid="input-appliance-serial"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected appliance info */}
          {selectedAppliance && !isNewAppliance && (
            <div className="flex items-start gap-3 rounded-xl border bg-card p-4 sm:items-center sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
                <Wrench className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{selectedAppliance.type} - {selectedAppliance.brand}</p>
                <p className="text-sm text-muted-foreground">Modelo: {selectedAppliance.model}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Service Order Details */}
      <Card className={`transition-opacity ${!isApplianceValid ? "opacity-50 pointer-events-none" : ""} ${isDefectValid ? "border-primary/30 bg-primary/5" : ""}`}>
        <CardHeader className="px-4 pb-3 pt-5 sm:px-6">
          <div className="flex items-start gap-3 sm:items-center">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:mt-0 ${
              isDefectValid ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {isDefectValid ? <CheckCircle2 className="h-5 w-5" /> : "3"}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Problema</CardTitle>
              <CardDescription>Descreva o defeito relatado pelo cliente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">O que está acontecendo com o aparelho? *</label>
            <Textarea
              placeholder="Ex: Não está gelando, faz barulho estranho, não liga..."
              className="min-h-[110px] text-base"
              value={defect}
              onChange={(e) => setDefect(e.target.value)}
              data-testid="input-defect"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Observações internas</label>
            <Textarea
              placeholder="Anotações para uso interno (opcional)"
              className="min-h-[88px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-notes"
            />
            <p className="text-xs text-muted-foreground">
              Este campo nao alimenta o diagnostico tecnico nem a impressao da OS.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
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
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              Criar Ordem de Serviço
              <ArrowRight className="h-5 w-5 ml-2" />
            </>
          )}
        </Button>
      </div>

      {/* Help text */}
      {!canSubmit && (
        <div className="flex items-center justify-center gap-2 px-2 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Preencha todos os campos obrigatórios para continuar</span>
        </div>
      )}
    </div>
  );
}
