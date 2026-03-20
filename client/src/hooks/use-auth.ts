import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, UserRole } from "@shared/models/auth";

interface AuthUser extends Omit<User, 'passwordHash' | 'email' | 'profileImageUrl'> {
  role: UserRole;
}

async function fetchUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function loginRequest(credentials: { username: string; password: string }): Promise<AuthUser> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "Erro ao fazer login");
  }

  const data = await response.json();
  return data.user;
}

async function logoutRequest(): Promise<void> {
  await fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, refetch } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/login";
    },
  });

  const hasPermission = (action: string): boolean => {
    if (!user?.role) return false;
    
    const permissions: Record<string, string[]> = {
      ADMIN: ["*"],
      ATENDENTE: [
        "create_order", "edit_customer", "update_status", "finalize_order", 
        "print", "view_orders", "view_customers", "view_dashboard", "manage_appliances",
        "approve_budget", "send_budget"
      ],
      TECNICO: [
        "edit_technical", "update_repair_status", "view_orders", "view_customers",
        "edit_budget", "send_budget"
      ],
    };
    
    const rolePermissions = permissions[user.role] || [];
    return rolePermissions.includes("*") || rolePermissions.includes(action);
  };

  const isAdmin = user?.role === "ADMIN";
  const isAtendente = user?.role === "ATENDENTE";
  const isTecnico = user?.role === "TECNICO";

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error?.message || null,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch,
    hasPermission,
    isAdmin,
    isAtendente,
    isTecnico,
    role: user?.role || null,
  };
}
