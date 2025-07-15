import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CreditCard, Calculator, TrendingDown, Save } from "lucide-react";

interface PaymentBreakdownProps {
  period: string;
}

interface PaymentMethodStats {
  cash: number;
  pix: number;
  stoneCard: number;
  stoneVoucher: number;
  pagBankCard: number;
}

export default function PaymentBreakdown({ period }: PaymentBreakdownProps) {
  const { toast } = useToast();
  const [interestRates, setInterestRates] = useState({
    pix: 0,
    stoneCard: 3.5,
    stoneVoucher: 2.5,
    pagBankCard: 3.2,
  });

  // Load payment configuration from database
  const { data: paymentConfig } = useQuery({
    queryKey: ["/api/admin/payment-config"],
  });

  // Update rates when config is loaded
  useEffect(() => {
    if (paymentConfig) {
      setInterestRates({
        pix: parseFloat(paymentConfig.pixRate) || 0,
        stoneCard: parseFloat(paymentConfig.stoneCardRate) || 3.5,
        stoneVoucher: parseFloat(paymentConfig.stoneVoucherRate) || 2.5,
        pagBankCard: parseFloat(paymentConfig.pagBankCardRate) || 3.2,
      });
    }
  }, [paymentConfig]);

  // Save payment configuration
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        pix: interestRates.pix,
        stoneCard: interestRates.stoneCard,
        stoneVoucher: interestRates.stoneVoucher,
        pagBankCard: interestRates.pagBankCard,
      };

      console.log("Enviando para salvar:", payload);
      const res = await apiRequest("POST", "/api/admin/payment-config", payload);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao salvar configurações');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-config"] });
      toast({
        title: "Configurações salvas!",
        description: "As taxas de juros foram atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  const { data: paymentStats, isLoading } = useQuery<PaymentMethodStats>({
    queryKey: ["/api/admin/payment-methods", period],
    refetchInterval: 30000,
    staleTime: 0,
  });

  // Função auxiliar para converter valor para número
  const toNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }
    return 0;
  };

  const calculateNetAmount = (amount: number, rate: number) => {
    const interestAmount = amount * (rate / 100);
    return amount - interestAmount;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Extrair e validar valores dos métodos de pagamento
  const paymentAmounts = useMemo(() => {
    if (!paymentStats) {
      return {
        cash: 0,
        pix: 0,
        stoneCard: 0,
        stoneVoucher: 0,
        pagBankCard: 0
      };
    }

    return {
      cash: toNumber(paymentStats.cash),
      pix: toNumber(paymentStats.pix),
      stoneCard: toNumber(paymentStats.stoneCard),
      stoneVoucher: toNumber(paymentStats.stoneVoucher),
      pagBankCard: toNumber(paymentStats.pagBankCard)
    };
  }, [paymentStats]);

  // Calcular valores líquidos
  const netAmounts = useMemo(() => {
    return {
      cash: paymentAmounts.cash,
      pix: calculateNetAmount(paymentAmounts.pix, interestRates.pix),
      stoneCard: calculateNetAmount(paymentAmounts.stoneCard, interestRates.stoneCard),
      stoneVoucher: calculateNetAmount(paymentAmounts.stoneVoucher, interestRates.stoneVoucher),
      pagBankCard: calculateNetAmount(paymentAmounts.pagBankCard, interestRates.pagBankCard)
    };
  }, [paymentAmounts, interestRates]);

  // Calcular totais
  const totals = useMemo(() => {
    const gross = Object.values(paymentAmounts).reduce((sum, value) => sum + value, 0);
    const net = Object.values(netAmounts).reduce((sum, value) => sum + value, 0);
    const interest = gross - net;

    // Debug
    console.log('Payment Amounts:', paymentAmounts);
    console.log('Total Gross:', gross);
    console.log('Total Net:', net);
    console.log('Total Interest:', interest);

    return {
      gross: gross || 0,
      net: net || 0,
      interest: interest || 0
    };
  }, [paymentAmounts, netAmounts]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Detalhamento de Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!paymentStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Detalhamento de Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Nenhum dado de pagamento disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Detalhamento de Pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuração de Juros */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Configurar Taxas de Juros (%)
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pix-rate">PIX</Label>
              <Input
                id="pix-rate"
                type="number"
                step="0.1"
                value={interestRates.pix}
                onChange={(e) => setInterestRates(prev => ({ ...prev, pix: parseFloat(e.target.value) || 0 }))}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="stone-card-rate">Stone D/C</Label>
              <Input
                id="stone-card-rate"
                type="number"
                step="0.1"
                value={interestRates.stoneCard}
                onChange={(e) => setInterestRates(prev => ({ ...prev, stoneCard: parseFloat(e.target.value) || 0 }))}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="stone-voucher-rate">Stone Voucher</Label>
              <Input
                id="stone-voucher-rate"
                type="number"
                step="0.1"
                value={interestRates.stoneVoucher}
                onChange={(e) => setInterestRates(prev => ({ ...prev, stoneVoucher: parseFloat(e.target.value) || 0 }))}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="pagbank-rate">PagBank D/C</Label>
              <Input
                id="pagbank-rate"
                type="number"
                step="0.1"
                value={interestRates.pagBankCard}
                onChange={(e) => setInterestRates(prev => ({ ...prev, pagBankCard: parseFloat(e.target.value) || 0 }))}
                className="text-sm"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={() => saveConfigMutation.mutate()}
              disabled={saveConfigMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saveConfigMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </div>

        {/* Detalhamento por Forma de Pagamento */}
        <div className="space-y-4">
          <h4 className="font-semibold">Valores por Forma de Pagamento</h4>

          {/* Dinheiro */}
          {paymentAmounts.cash > 0 && (
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <div>
                <span className="font-medium">💵 Dinheiro</span>
                <p className="text-sm text-gray-600">Sem taxas</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">{formatCurrency(paymentAmounts.cash)}</p>
              </div>
            </div>
          )}

          {/* PIX */}
          {paymentAmounts.pix > 0 && (
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <div>
                <span className="font-medium">📱 PIX</span>
                <p className="text-sm text-gray-600">Taxa: {interestRates.pix}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Bruto: {formatCurrency(paymentAmounts.pix)}</p>
                <p className="font-semibold text-blue-600">Líquido: {formatCurrency(netAmounts.pix)}</p>
              </div>
            </div>
          )}

          {/* Stone D/C */}
          {paymentAmounts.stoneCard > 0 && (
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <div>
                <span className="font-medium">💳 Stone D/C</span>
                <p className="text-sm text-gray-600">Taxa: {interestRates.stoneCard}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Bruto: {formatCurrency(paymentAmounts.stoneCard)}</p>
                <p className="font-semibold text-purple-600">Líquido: {formatCurrency(netAmounts.stoneCard)}</p>
              </div>
            </div>
          )}

          {/* Stone Voucher */}
          {paymentAmounts.stoneVoucher > 0 && (
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <div>
                <span className="font-medium">🎫 Stone Voucher</span>
                <p className="text-sm text-gray-600">Taxa: {interestRates.stoneVoucher}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Bruto: {formatCurrency(paymentAmounts.stoneVoucher)}</p>
                <p className="font-semibold text-orange-600">Líquido: {formatCurrency(netAmounts.stoneVoucher)}</p>
              </div>
            </div>
          )}

          {/* PagBank D/C */}
          {paymentAmounts.pagBankCard > 0 && (
            <div className="flex justify-between items-center p-3 bg-teal-50 rounded-lg">
              <div>
                <span className="font-medium">💳 PagBank D/C</span>
                <p className="text-sm text-gray-600">Taxa: {interestRates.pagBankCard}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Bruto: {formatCurrency(paymentAmounts.pagBankCard)}</p>
                <p className="font-semibold text-teal-600">Líquido: {formatCurrency(netAmounts.pagBankCard)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Resumo Total */}
        <div className="border-t pt-4">
          <div className="bg-gray-100 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Bruto:</span>
              <span className="font-semibold">{formatCurrency(totals.gross)}</span>
            </div>
            <div className="flex justify-between items-center text-red-600">
              <span className="font-medium flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                Total em Juros:
              </span>
              <span className="font-semibold">-{formatCurrency(totals.interest)}</span>
            </div>
            <div className="flex justify-between items-center text-green-600 text-lg border-t pt-2">
              <span className="font-bold">Total Líquido:</span>
              <span className="font-bold">{formatCurrency(totals.net)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}