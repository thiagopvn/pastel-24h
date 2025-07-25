import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Utensils, LogOut } from "lucide-react";
import ShiftStatusCard from "@/components/employee/shift-status-card";
import ProductForm from "@/components/employee/product-form";
import CashRegister from "@/components/employee/cash-register";
import Collaborators from "@/components/employee/collaborators";

export default function EmployeeDashboard() {
  const { user, logoutMutation } = useAuth();

  if (user?.role === 'admin') {
    return <Redirect to="/admin" />;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Utensils className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">Pastelaria 24h</h1>
                <p className="text-xs text-gray-500">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-4">
        <div className="p-4 space-y-4">
          <ShiftStatusCard />
          <ProductForm />
          <CashRegister />
          <Collaborators />
        </div>
      </main>
    </div>
  );
}
