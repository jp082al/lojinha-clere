import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Orders from "@/pages/orders";
import NewOrder from "@/pages/new-order";
import PrintReceipt from "@/pages/print-receipt";
import PrintLabel from "@/pages/print-label";
import PrintExit from "@/pages/print-exit";
import Tracking from "@/pages/tracking";
import Login from "@/pages/login";
import UsersPage from "@/pages/users";
import CashPage from "@/pages/cash";
import SettingsPage from "@/pages/settings";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect handled by effect in auth hook or here manually if preferred
    // For smoother UX, return null and let the router switch to login if implemented
    return <Login />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} />} />
      <Route path="/new-order" component={() => <ProtectedRoute component={NewOrder} />} />
      <Route path="/cash" component={() => <ProtectedRoute component={CashPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} />} />
      <Route path="/print/receipt/:id" component={PrintReceipt} />
      <Route path="/print/label/:id" component={PrintLabel} />
      <Route path="/print/exit/:id" component={PrintExit} />
      <Route path="/acompanhamento/:token" component={Tracking} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
