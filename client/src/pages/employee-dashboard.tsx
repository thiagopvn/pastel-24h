import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Utensils, LogOut } from "lucide-react";
import ShiftStatusCard from "@/components/employee/shift-status-card";
import ProductForm from "@/components/employee/product-form";
import CashRegister from "@/components/employee/cash-register";
import CollaboratorsEnhanced from "@/components/employee/collaborators-enhanced";

export default function EmployeeDashboard() {
  const { user, logoutMutation } = useAuth();

  // CORREÇÃO: Centralizando o estado dos pagamentos aqui. Esta é a única fonte da verdade.
  const [paymentsData, setPaymentsData] = useState({
    cash: 0,
    pix: 0,
    stoneCard: 0,
    stoneVoucher: 0,
    pagBankCard: 0,
  });

  // CORREÇÃO: Função para ser passada aos filhos para atualizar o estado centralizado.
  const handlePaymentsChange = (newPayments: typeof paymentsData) => {
    console.log("=== EMPLOYEE DASHBOARD - PAYMENTS UPDATE ===");
    console.log("Estado anterior:", paymentsData);
    console.log("Novo estado:", newPayments);
    setPaymentsData(newPayments);
  };

  if (user?.role === 'admin') {
    return <Redirect to="/admin" />;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
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

      <main className="pb-4">
        <div className="p-4 space-y-4">
          {/* CORREÇÃO: Passando o estado centralizado e a função de atualização para os filhos. */}
          <ShiftStatusCard paymentsData={paymentsData} />
          <ProductForm />
          <CashRegister
            payments={paymentsData}
            onPaymentsChange={handlePaymentsChange}
          />
          <CollaboratorsEnhanced />
        </div>
      </main>
    </div>
  );
}
