import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  UserPlus, 
  Shield, 
  ToggleLeft, 
  ToggleRight, 
  KeyRound, 
  Loader2,
  Users,
  AlertCircle
} from "lucide-react";

interface User {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  isActive: boolean | null;
  createdAt: string | null;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrador", description: "Acesso total ao sistema" },
  { value: "ATENDENTE", label: "Atendente", description: "Atendimento e gestão de OS" },
  { value: "TECNICO", label: "Técnico", description: "Reparos e diagnósticos" },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200",
  ATENDENTE: "bg-blue-100 text-blue-700 border-blue-200",
  TECNICO: "bg-green-100 text-green-700 border-green-200",
};

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    role: "ATENDENTE" as string,
  });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar usuários");
      return res.json();
    },
  });

  const createUser = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao criar usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuário criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      setFormData({ firstName: "", lastName: "", username: "", password: "", role: "ATENDENTE" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}/toggle-active`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao alterar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Status alterado com sucesso" });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao redefinir senha");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Senha redefinida com sucesso!" });
      setShowResetDialog(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(formData);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (showResetDialog && newPassword.length >= 4) {
      resetPassword.mutate({ userId: showResetDialog.id, password: newPassword });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os usuários e suas permissões no sistema
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-user">
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum usuário cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users?.map((user) => (
            <Card key={user.id} className={!user.isActive ? "opacity-60" : ""}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {user.firstName?.[0] || "U"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">
                          {user.firstName} {user.lastName}
                        </h3>
                        {!user.isActive && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-500">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                      <Badge 
                        variant="outline" 
                        className={`mt-1 ${ROLE_COLORS[user.role || ""] || ""}`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive.mutate(user.id)}
                      disabled={toggleActive.isPending}
                      data-testid={`button-toggle-${user.id}`}
                    >
                      {user.isActive ? (
                        <>
                          <ToggleRight className="mr-2 h-4 w-4" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="mr-2 h-4 w-4" />
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResetDialog(user)}
                      data-testid={`button-reset-${user.id}`}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Redefinir Senha
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  data-testid="input-user-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  data-testid="input-user-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                minLength={3}
                data-testid="input-user-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={4}
                data-testid="input-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função *</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-muted-foreground">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createUser.isPending} data-testid="button-save-user">
                {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showResetDialog} onOpenChange={() => setShowResetDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {showResetDialog?.firstName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={4}
                placeholder="Mínimo 4 caracteres"
                data-testid="input-new-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowResetDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetPassword.isPending || newPassword.length < 4} data-testid="button-confirm-reset">
                {resetPassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Redefinir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
