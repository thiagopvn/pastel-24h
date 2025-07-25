import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Clock, CreditCard } from "lucide-react";

interface ChartsProps {
  period: string;
}

interface SalesByHour {
  hour: string;
  sales: string;
}

interface PaymentMethodStats {
  cash: string;
  pix: string;
  stoneCard: string;
  stoneVoucher: string;
  pagBankCard: string;
}

export default function Charts({ period }: ChartsProps) {
  const { data: salesByHour, isLoading: isLoadingSales } = useQuery<SalesByHour[]>({
    queryKey: ["/api/admin/sales-by-hour", period],
    refetchInterval: 30000,
    staleTime: 0,
  });

  // Format sales data for chart
  const formatSalesData = (data: SalesByHour[] | undefined) => {
    if (!data || data.length === 0) {
      // Generate empty hourly data for better visualization
      return Array.from({ length: 24 }, (_, i) => ({
        hour: i.toString().padStart(2, '0'),
        sales: 0
      }));
    }
    return data.map(item => ({
      hour: typeof item.hour === 'string' ? item.hour.padStart(2, '0') : item.hour.toString().padStart(2, '0'),
      sales: parseFloat(item.sales) || 0
    }));
  };

  const { data: paymentStats, isLoading: isLoadingPayments } = useQuery<PaymentMethodStats>({
    queryKey: ["/api/admin/payment-methods", period],
    refetchInterval: 30000,
    staleTime: 0,
  });

  const formatPaymentData = (stats: PaymentMethodStats) => {
    if (!stats) return [];
    
    const cash = parseFloat(stats.cash.toString()) || 0;
    const pix = parseFloat(stats.pix.toString()) || 0;
    const stoneCard = parseFloat(stats.stoneCard.toString()) || 0;
    const stoneVoucher = parseFloat(stats.stoneVoucher.toString()) || 0;
    const pagBankCard = parseFloat(stats.pagBankCard.toString()) || 0;
    
    const total = cash + pix + stoneCard + stoneVoucher + pagBankCard;
    if (total === 0) return [];

    const formatCurrency = (value: number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    return [
      { name: "Dinheiro", value: cash, percentage: ((cash / total) * 100).toFixed(1), display: formatCurrency(cash) },
      { name: "PIX", value: pix, percentage: ((pix / total) * 100).toFixed(1), display: formatCurrency(pix) },
      { name: "Stone D/C", value: stoneCard, percentage: ((stoneCard / total) * 100).toFixed(1), display: formatCurrency(stoneCard) },
      { name: "Stone Voucher", value: stoneVoucher, percentage: ((stoneVoucher / total) * 100).toFixed(1), display: formatCurrency(stoneVoucher) },
      { name: "PagBank D/C", value: pagBankCard, percentage: ((pagBankCard / total) * 100).toFixed(1), display: formatCurrency(pagBankCard) },
    ].filter(item => item.value > 0);
  };

  const COLORS = ['hsl(207, 90%, 54%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(258, 90%, 66%)', 'hsl(14, 90%, 53%)'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Sales by Hour Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Vendas por Hora
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSales ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-gray-500">Carregando gráfico...</div>
            </div>
          ) : (() => {
            const formattedSalesData = formatSalesData(salesByHour);
            const hasData = formattedSalesData.length > 0 && formattedSalesData.some(item => item.sales > 0);
            
            return hasData ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={formattedSalesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(hour) => `${hour}h`}
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${parseFloat(value).toFixed(2)}`}
                  />
                  <Tooltip 
                    formatter={(value) => [`R$ ${parseFloat(value as string).toFixed(2)}`, "Vendas"]}
                    labelFormatter={(hour) => `${hour}h`}
                  />
                  <Bar dataKey="sales" fill="hsl(207, 90%, 54%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma venda registrada</p>
                  <p className="text-sm">para o período selecionado</p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Payment Methods Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Vendas por Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-gray-500">Carregando gráfico...</div>
            </div>
          ) : paymentStats ? (
            (() => {
              const formattedData = formatPaymentData(paymentStats);
              return formattedData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formattedData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {formattedData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [
                          `${formatPaymentData(paymentStats!).find(item => item.name === name)?.display || value}`,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {formattedData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm text-gray-700">{entry.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-gray-900">R$ {entry.value.toFixed(2)}</span>
                          <span className="text-xs text-gray-500 block">{entry.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma venda registrada</p>
                    <p className="text-sm">para o período selecionado</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum dado disponível</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
