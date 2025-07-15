import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Wallet, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  period: string;
}

interface SalesStats {
  totalSales: number;
  avgTicket: number;
  physicalCash: number;
  estimatedProfit: number;
}

export default function StatsCards({ period }: StatsCardsProps) {
  const { data: stats, isLoading, isError } = useQuery<SalesStats>({
    queryKey: ["/api/admin/summary", period],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 0, // Always fetch fresh data
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(numValue || 0);
  };

  const statsData = [
    {
      title: "Vendas Totais",
      value: formatCurrency(stats?.totalSales || 0),
      icon: DollarSign,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      description: "Total de vendas no período"
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(stats?.avgTicket || 0),
      icon: ShoppingCart,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      description: "Valor médio por venda"
    },
    {
      title: "Caixa Físico",
      value: formatCurrency(stats?.physicalCash || 0),
      icon: Wallet,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      description: "Dinheiro disponível em caixa"
    },
    {
      title: "Lucro Estimado",
      value: formatCurrency(stats?.estimatedProfit || 0),
      icon: TrendingUp,
      bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600",
      description: "Estimativa de lucro líquido"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className={`flex-shrink-0 p-3 ${stat.bgColor} rounded-lg`}>
                <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 truncate">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
