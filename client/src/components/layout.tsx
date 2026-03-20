import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  LogOut, 
  Menu,
  PlusCircle,
  UserCog,
  Shield,
  Settings
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { type SystemSettings } from "@shared/schema";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "bg-red-100 text-red-700 border-red-200" },
  ATENDENTE: { label: "Atendente", color: "bg-blue-100 text-blue-700 border-blue-200" },
  TECNICO: { label: "Técnico", color: "bg-green-100 text-green-700 border-green-200" },
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isAdmin, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
  });

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "view_dashboard" },
    { href: "/orders", label: "Ordens de Serviço", icon: Wrench, permission: "view_orders" },
    { href: "/customers", label: "Clientes", icon: Users, permission: "view_customers" },
    { href: "/cash", label: "Caixa", icon: Shield, permission: "view_dashboard" },
  ];

  const roleInfo = ROLE_LABELS[user?.role || ""] || { label: user?.role, color: "bg-gray-100 text-gray-700" };

  const Sidebar = () => (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="p-6">
        <div className="flex items-center gap-2">
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
          )}
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            {settings?.businessName || "A Lojinha Clere"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Gerenciamento Profissional</p>
      </div>

      {hasPermission("create_order") && (
        <div className="px-4 mb-4">
          <Link href="/new-order">
            <Button 
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              onClick={() => setMobileOpen(false)}
              data-testid="button-new-order-sidebar"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              Nova OS
            </Button>
          </Link>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          if (!hasPermission(item.permission)) return null;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <Link href="/users">
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                  location === "/users"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <UserCog size={20} />
                <span>Usuários</span>
              </div>
            </Link>
            <Link href="/settings">
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                  location === "/settings"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <Settings size={20} />
                <span>Configurações</span>
              </div>
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarFallback>{user?.firstName?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <Badge 
              variant="outline" 
              className={`text-xs mt-1 ${roleInfo.color}`}
            >
              <Shield className="w-3 h-3 mr-1" />
              {roleInfo.label}
            </Badge>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:block w-64 fixed h-full z-30">
        <Sidebar />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden fixed top-4 right-4 z-40 bg-card shadow-md">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
