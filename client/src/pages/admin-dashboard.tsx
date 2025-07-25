import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Utensils, LogOut, Package, Users, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatsCards from "@/components/admin/stats-cards";
import Charts from "@/components/admin/charts";
import PaymentBreakdown from "@/components/admin/payment-breakdown";
import Alerts from "@/components/admin/alerts";
import Timeline from "@/components/admin/timeline";
import MobileNav from "@/components/navigation/mobile-nav";
import { CashAdjustmentDialog } from "@/components/admin/cash-adjustment-dialog";

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const [period, setPeriod] = useState<Period>('today');

  if (user?.role !== 'admin') {
    return <Redirect to="/" />;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Utensils className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pastelaria 24h Admin</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={period} onValueChange={(value: Period) => setPeriod(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <CashAdjustmentDialog />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{user.name}</span>
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
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsCards period={period} />
        <Charts period={period} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <PaymentBreakdown period={period} />
          <Alerts period={period} />
        </div>

        <Timeline />
      </main>

      {/* Navigation Tabs for Mobile */}
      <MobileNav currentPath="/admin" />
      
      {/* Mobile bottom padding to prevent content overlap */}
      <div className="xl:hidden h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}></div>
    </div>
  );
}
