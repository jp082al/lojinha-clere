import { useState } from "react";
import { useCustomers, useCreateCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { useAppliances, useCreateAppliance } from "@/hooks/use-appliances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, User, Phone, MapPin, Edit, Eye, Archive } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCustomerSchema, insertApplianceSchema, type InsertCustomer, type InsertAppliance, type Customer } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

export default function Customers() {
  const { data: customers, isLoading } = useCustomers();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Clientes</h2>
          <p className="text-muted-foreground mt-2">Gerencie sua base de clientes.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-[500px]">
            <CustomerForm onClose={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:gap-4 sm:p-4">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou telefone..." 
          className="border-none bg-transparent text-base shadow-none focus-visible:ring-0 sm:text-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Telefone</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Endereço</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers?.map((customer) => (
                  <TableRow key={customer.id} className="group cursor-pointer hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                          {customer.name[0].toUpperCase()}
                        </div>
                        <span className="min-w-0 break-words">{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{customer.phone}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                      {customer.address || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setEditingCustomer(customer)}>
                        <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Customer Detail/Edit Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-3xl">
          {editingCustomer && (
            <CustomerDetails 
              customer={editingCustomer} 
              onClose={() => setEditingCustomer(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerForm({ customer, onClose }: { customer?: Customer, onClose: () => void }) {
  const { mutate: create, isPending: isCreating } = useCreateCustomer();
  const { mutate: update, isPending: isUpdating } = useUpdateCustomer();
  
  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: customer || {
      name: "",
      phone: "",
      address: "",
      notes: ""
    }
  });

  const onSubmit = (data: InsertCustomer) => {
    if (customer) {
      update({ id: customer.id, ...data }, { onSuccess: onClose });
    } else {
      create(data, { onSuccess: onClose });
    }
  };

  const isPending = isCreating || isUpdating;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{customer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        <DialogDescription>
          Preencha os dados do cliente abaixo.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: João Silva" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone / WhatsApp</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: (11) 99999-9999" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço *</FormLabel>
                <FormControl>
                  <Input placeholder="Rua, Número, Bairro" {...field} value={field.value || ""} />
                </FormControl>
                {!field.value?.trim() && (
                  <p className="text-sm font-medium text-destructive">Informe o endereço do cliente.</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Input placeholder="Informações adicionais..." {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter className="!flex-col gap-2 sm:!flex-row">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isPending || !form.watch("address")?.trim()}
            >
              {isPending ? "Salvando..." : (customer ? "Atualizar" : "Cadastrar")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function CustomerDetails({ customer, onClose }: { customer: Customer, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'info' | 'appliances'>('info');
  const { data: appliances, isLoading } = useAppliances(customer.id);
  const { mutate: createAppliance, isPending: isAddingAppliance } = useCreateAppliance();
  
  const applianceForm = useForm<InsertAppliance>({
    resolver: zodResolver(insertApplianceSchema),
    defaultValues: {
      customerId: customer.id,
      type: "",
      brand: "",
      model: "",
      serialNumber: ""
    }
  });

  const onAddAppliance = (data: InsertAppliance) => {
    createAppliance(data, {
      onSuccess: () => {
        applianceForm.reset({
          customerId: customer.id,
          type: "",
          brand: "",
          model: "",
          serialNumber: ""
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DialogTitle className="break-words text-xl sm:text-2xl">{customer.name}</DialogTitle>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Button 
            variant={activeTab === 'info' ? 'default' : 'ghost'} 
            size="sm"
            className="min-h-10 shrink-0"
            onClick={() => setActiveTab('info')}
          >
            <User className="w-4 h-4 mr-2" /> Info
          </Button>
          <Button 
            variant={activeTab === 'appliances' ? 'default' : 'ghost'} 
            size="sm"
            className="min-h-10 shrink-0"
            onClick={() => setActiveTab('appliances')}
          >
            <Archive className="w-4 h-4 mr-2" /> Aparelhos
          </Button>
        </div>
      </div>

      <Separator />

      {activeTab === 'info' ? (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 rounded-xl border bg-card p-4">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="w-3 h-3" /> Telefone
              </span>
              <p className="text-lg">{customer.phone}</p>
            </div>
            <div className="space-y-1 rounded-xl border bg-card p-4">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Endereço
              </span>
              <p className="text-lg">{customer.address || "Não informado"}</p>
            </div>
          </div>
          
          <div className="bg-muted/20 p-4 rounded-xl">
            <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Editar Informações</h4>
            <CustomerForm customer={customer} onClose={onClose} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-muted/10 p-4 rounded-xl border border-dashed border-border">
            <h4 className="font-semibold mb-4 text-sm">Adicionar Aparelho</h4>
            <Form {...applianceForm}>
              <form onSubmit={applianceForm.handleSubmit(onAddAppliance)} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-end">
                <FormField
                  control={applianceForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Geladeira" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={applianceForm.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Brastemp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={applianceForm.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: BRM45" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isAddingAppliance} className="h-11 w-full md:h-10">
                  {isAddingAppliance ? "Adicionando..." : "Adicionar"}
                </Button>
              </form>
            </Form>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm text-muted-foreground">Aparelhos Cadastrados</h4>
            {isLoading ? (
              <div className="h-20 bg-muted animate-pulse rounded-lg" />
            ) : appliances?.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">Nenhum aparelho cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {appliances?.map(appliance => (
                  <div key={appliance.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{appliance.type} - {appliance.brand}</p>
                      <p className="text-sm text-muted-foreground">{appliance.model}</p>
                    </div>
                    <span className="self-start rounded bg-muted px-2 py-1 text-xs sm:self-auto">
                      ID: {appliance.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
