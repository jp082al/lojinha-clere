import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, buildQueryUrl } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Wallet, Calendar, User, DollarSign, Lock, Unlock, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function CashPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [countedTotal, setCountedTotal] = useState("");
  const [notes, setNotes] = useState("");

  const { data: payments, isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: ["/api/payments", selectedDate],
    queryFn: async () => {
      const res = await fetch(buildQueryUrl("/api/payments", { date: selectedDate }), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar pagamentos");
      return res.json();
    },
  });

  const { data: closing, isLoading: loadingClosing } = useQuery<any | null>({
    queryKey: ["/api/cash-closings", selectedDate],
  });

  const closeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cash-closings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-closings", selectedDate] });
      setIsClosingOpen(false);
      toast({ title: "Caixa fechado com sucesso!" });
    }
  });

  const expectedTotal = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalsByMethod = payments?.reduce((acc: Record<string, number>, p) => {
    acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
    return acc;
  }, {} as Record<string, number>) || {};

  const handleCloseCash = () => {
    const counted = Number(countedTotal);
    const diff = counted - expectedTotal;
    closeMutation.mutate({
      date: selectedDate,
      expectedTotal: expectedTotal.toString(),
      countedTotal: counted.toString(),
      difference: diff.toString(),
      notes
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Caixa do Dia</h2>
          <p className="text-muted-foreground">Controle financeiro e fechamento diário.</p>
        </div>
        <div className="flex gap-4 items-center">
          <Input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
          {!closing && (
            <Button onClick={() => setIsClosingOpen(true)} className="bg-green-600 hover:bg-green-700">
              <Lock className="w-4 h-4 mr-2" /> Fechar Caixa
            </Button>
          )}
          {closing && (
            <Badge className="bg-blue-100 text-blue-700 px-3 py-1 text-sm border-blue-200">
              <Lock className="w-3 h-3 mr-1" /> Caixa Fechado
            </Badge>
          )}
        </div>
      </div>

      {closing && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-full border border-blue-100 shadow-sm">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Fechado por</p>
                  <p className="text-lg font-bold text-blue-900">{closing.closedBy}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Esperado</p>
                  <p className="text-lg font-bold text-blue-900">R$ {closing.expectedTotal}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Contado</p>
                  <p className="text-lg font-bold text-blue-900">R$ {closing.countedTotal}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Diferença</p>
                  <p className={`text-lg font-bold ${Number(closing.difference) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    R$ {closing.difference}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R$ {expectedTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        {Object.entries(totalsByMethod).map(([method, amount]) => (
          <Card key={method}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{method}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {amount.toFixed(2)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos Recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Recebido por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPayments ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : payments?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Nenhum pagamento registrado.</TableCell></TableRow>
              ) : (
                payments?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.receivedAt), "HH:mm")}</TableCell>
                    <TableCell>#{p.orderId}</TableCell>
                    <TableCell className="font-bold">R$ {Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.method}</Badge>
                    </TableCell>
                    <TableCell>{p.receivedBy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isClosingOpen} onOpenChange={setIsClosingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Caixa do Dia</DialogTitle>
            <DialogDescription>
              Confirme os valores recebidos hoje. Uma vez fechado, o caixa não poderá ser editado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">Total Esperado (Sistema):</span>
              <span className="font-bold text-primary">R$ {expectedTotal.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor Contado em Mãos *</label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={countedTotal} 
                onChange={(e) => setCountedTotal(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea 
                placeholder="Ex: Sobrou R$ 2,00 de troco..." 
                value={notes} 
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} 
              />
            </div>
            {countedTotal && (
              <div className={`p-3 rounded-lg flex justify-between ${Number(countedTotal) - expectedTotal < 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                <span className="font-medium">Diferença:</span>
                <span className="font-bold">R$ {(Number(countedTotal) - expectedTotal).toFixed(2)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClosingOpen(false)}>Cancelar</Button>
            <Button onClick={handleCloseCash} disabled={!countedTotal || closeMutation.isPending}>
              Confirmar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Textarea(props: any) {
  return <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" {...props} />
}
