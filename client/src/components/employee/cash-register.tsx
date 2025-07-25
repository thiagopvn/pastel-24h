import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertTriangle, Flame, Save, HelpCircle, Calculator, Coins, Banknote, DollarSign, Info } from "lucide-react";
import type { Shift, ShiftPayment } from "@shared/schema";

export default function CashRegister() {
  const { toast } = useToast();
  const [payments, setPayments] = useState({
    cash: 0,
    pix: 0,
    stoneCard: 0,
    stoneVoucher: 0,
    pagBankCard: 0,
  });
  const [finalCash, setFinalCash] = useState(0);
  const [finalCoins, setFinalCoins] = useState(0);
  const [gasExchange, setGasExchange] = useState(false);

  const { data: currentShift } = useQuery<Shift>({
    queryKey: ["/api/shifts/current"],
  });

  const { data: existingPayments } = useQuery<ShiftPayment>({
    queryKey: ["/api/shift-payments", currentShift?.id],
    enabled: !!currentShift?.id,
  });

  const savePaymentsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/shift-payments", {
        ...data,
        shiftId: currentShift?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      toast({ title: "Pagamentos salvos com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar pagamentos", variant: "destructive" });
    },
  });

  const saveValuesMutation = useMutation({
    mutationFn: async () => {
      // Converter números para strings (campos decimal no banco)
      const paymentsFormatted = {
        cash: payments.cash.toString(),
        pix: payments.pix.toString(),
        stoneCard: payments.stoneCard.toString(),
        stoneVoucher: payments.stoneVoucher.toString(),
        pagBankCard: payments.pagBankCard.toString(),
      };

      // Salvar os pagamentos
      const paymentRes = await apiRequest("POST", "/api/shift-payments", {
        ...paymentsFormatted,
        shiftId: currentShift?.id,
      });

      // Salvar os valores de caixa temporários para o fechamento
      const cashRes = await apiRequest("POST", "/api/shifts/temp-cash", {
        shiftId: currentShift?.id,
        tempFinalCash: finalCash.toString(),
        tempFinalCoins: finalCoins.toString(),
        gasExchange,
      });

      return { paymentRes: await paymentRes.json(), cashRes: await cashRes.json() };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      toast({ 
        title: "Valores salvos com sucesso!", 
        description: "Os valores serão carregados automaticamente no fechamento do turno."
      });
    },
    onError: (error: any) => {
      console.error("Erro ao salvar valores:", error);
      toast({ 
        title: "Erro ao salvar valores", 
        description: "Verifique os valores e tente novamente.",
        variant: "destructive" 
      });
    },
  });

  const updatePayment = (field: string, value: number) => {
    setPayments(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveValues = () => {
    if (!currentShift) {
      toast({ 
        title: "Erro", 
        description: "Nenhum turno ativo encontrado.",
        variant: "destructive" 
      });
      return;
    }
    
    saveValuesMutation.mutate();
  };

  // Query para buscar ajustes de caixa do turno atual
  const { data: cashAdjustments } = useQuery({
    queryKey: ["/api/cash-adjustments", currentShift?.id],
    enabled: !!currentShift?.id,
  });

  const calculateDivergence = () => {
    if (!currentShift) return 0;
    const initialCash = parseFloat(currentShift.initialCash);
    const initialCoins = parseFloat(currentShift.initialCoins);
    const cashSales = payments.cash || 0;
    
    // Valores esperados (inicial + vendas em dinheiro)
    const expectedCash = initialCash + cashSales;
    const expectedCoins = initialCoins; // Moedas não mudam com vendas
    
    // Calcular total de ajustes feitos pelo administrador
    let totalAdjustments = 0;
    if (cashAdjustments && Array.isArray(cashAdjustments)) {
      totalAdjustments = cashAdjustments.reduce((total, adjustment) => {
        if (adjustment.type === 'withdraw' || adjustment.type === 'adjustment') {
          return total + parseFloat(adjustment.amount || 0);
        }
        return total;
      }, 0);
    }
    
    // Divergência considerando dinheiro + moedas
    const totalExpected = expectedCash + expectedCoins;
    const totalCounted = finalCash + finalCoins;
    const baseDivergence = totalCounted - totalExpected;
    
    return baseDivergence + totalAdjustments;
  };

  const calculateTotalSales = () => {
    return (payments.cash || 0) + (payments.pix || 0) + 
           (payments.stoneCard || 0) + (payments.stoneVoucher || 0) + 
           (payments.pagBankCard || 0);
  };

  // Query to get records and calculate sales from products
  const { data: shiftRecords } = useQuery({
    queryKey: ["/api/shift-records"],
    enabled: !!currentShift,
  });

  const calculateSalesFromRecords = () => {
    if (!shiftRecords || !Array.isArray(shiftRecords)) return 0;
    return shiftRecords.reduce((total, record) => {
      return total + parseFloat(record.itemTotal || 0);
    }, 0);
  };

  const divergence = calculateDivergence();
  const totalSales = calculateTotalSales();
  const minCash = 200; // Minimum recommended cash
  const minCoins = 50; // Minimum recommended coins

  if (!currentShift) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-gray-600">
            Abra um turno para registrar caixa
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Registro de Caixa
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-500 hover:text-blue-600" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Registre aqui os valores de caixa e pagamentos recebidos durante o turno</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Seção de Contagem de Caixa */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Contagem Final do Caixa</h3>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-gray-400 hover:text-green-600" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Conte todo o dinheiro e moedas que estão no caixa ao final do turno</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="finalCash" className="flex items-center gap-2 text-sm font-medium">
                  <Banknote className="h-4 w-4 text-green-600" />
                  Dinheiro Final (Notas)
                </Label>
                <Input
                  id="finalCash"
                  type="number"
                  step="0.01"
                  value={finalCash}
                  onChange={(e) => setFinalCash(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="text-center text-lg font-medium"
                />
                <p className="text-xs text-gray-500">Some todas as notas do caixa</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="finalCoins" className="flex items-center gap-2 text-sm font-medium">
                  <Coins className="h-4 w-4 text-amber-600" />
                  Moedas Finais
                </Label>
                <Input
                  id="finalCoins"
                  type="number"
                  step="0.01"
                  value={finalCoins}
                  onChange={(e) => setFinalCoins(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="text-center text-lg font-medium"
                />
                <p className="text-xs text-gray-500">Some todas as moedas do caixa</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Seção de Métodos de Pagamento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Métodos de Pagamento Recebidos</h3>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-gray-400 hover:text-blue-600" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Registre o total recebido em cada método de pagamento durante o turno</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-purple-700">
                  <DollarSign className="h-4 w-4" />
                  PIX
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total de vendas recebidas via PIX</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payments.pix}
                  onChange={(e) => updatePayment('pix', parseFloat(e.target.value) || 0)}
                  className="text-center font-medium"
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-orange-700">
                  <CreditCard className="h-4 w-4" />
                  Stone D/C
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Máquina Stone - Débito e Crédito</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payments.stoneCard}
                  onChange={(e) => updatePayment('stoneCard', parseFloat(e.target.value) || 0)}
                  className="text-center font-medium"
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <CreditCard className="h-4 w-4" />
                  Stone Voucher
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Máquina Stone - Vale Refeição/Alimentação</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payments.stoneVoucher}
                  onChange={(e) => updatePayment('stoneVoucher', parseFloat(e.target.value) || 0)}
                  className="text-center font-medium"
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <CreditCard className="h-4 w-4" />
                  PagBank D/C
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Máquina PagBank - Débito e Crédito</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payments.pagBankCard}
                  onChange={(e) => updatePayment('pagBankCard', parseFloat(e.target.value) || 0)}
                  className="text-center font-medium"
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <Banknote className="h-4 w-4" />
                  Dinheiro (Vendas)
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total de vendas pagas em dinheiro (não inclui o troco inicial)</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payments.cash}
                  onChange={(e) => updatePayment('cash', parseFloat(e.target.value) || 0)}
                  className="text-center font-medium"
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Seção de Ajustes Administrativos */}
          {cashAdjustments && cashAdjustments.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-2 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold text-sm">Ajustes Administrativos</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-yellow-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Retiradas e ajustes feitos por administradores são automaticamente considerados</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {cashAdjustments.map((adjustment: any) => (
                  <div key={adjustment.id} className="text-xs text-yellow-700 flex justify-between items-center bg-white p-2 rounded border border-yellow-200">
                    <span className="font-medium">{adjustment.type === 'withdraw' ? 'Retirada' : 'Ajuste'}: {adjustment.reason}</span>
                    <span className="font-bold text-red-600">-R$ {parseFloat(adjustment.amount).toFixed(2)}</span>
                  </div>
                ))}
                <div className="text-xs text-yellow-600 pt-2 border-t border-yellow-200 font-medium">
                  ℹ️ Esses valores são automaticamente considerados no cálculo de divergência
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Resumo de Vendas */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900">Resumo de Vendas</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total Sales Summary */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-green-900 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total Pagamentos:
                  </span>
                  <span className="text-xl font-bold text-green-900">R$ {calculateTotalSales().toFixed(2)}</span>
                </div>
                <div className="text-xs text-green-700">
                  Soma de todos os métodos de pagamento registrados
                </div>
              </div>

              {/* Sales from Products */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-300 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Vendas por Produtos:
                  </span>
                  <span className="text-xl font-bold text-blue-900">R$ {calculateSalesFromRecords().toFixed(2)}</span>
                </div>
                <div className="text-xs text-blue-700">
                  Calculado automaticamente dos registros de produtos
                </div>
              </div>
            </div>

            {/* Payment vs Product Sales Difference Alert */}
            {Math.abs(calculateTotalSales() - calculateSalesFromRecords()) > 0.01 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Diferença Encontrada:</strong> R$ {Math.abs(calculateTotalSales() - calculateSalesFromRecords()).toFixed(2)} entre pagamentos e vendas de produtos. Verifique os valores.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Alertas e Validações */}
          <div className="space-y-3">
            {/* Cash Divergence Alert - Only show negative divergence */}
            {divergence < 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Divergência de Caixa:</strong> R$ {divergence.toFixed(2)} - Há menos dinheiro no caixa do que o esperado
                </AlertDescription>
              </Alert>
            )}

            {/* Low Cash Alerts */}
            {(finalCash < minCash || finalCoins < minCoins) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção - Caixa Baixo:</strong>
                  {finalCash < minCash && ` Dinheiro abaixo do mínimo recomendado (R$ ${minCash}).`}
                  {finalCoins < minCoins && ` Moedas abaixo do mínimo recomendado (R$ ${minCoins}).`}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Gas Exchange */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <Flame className="h-6 w-6 text-orange-600" />
                <div>
                  <span className="text-sm font-semibold text-orange-900">Houve troca de botijão?</span>
                  <p className="text-xs text-orange-700">Marque se houve troca do botijão de gás durante o turno</p>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-orange-600" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Registre quando um botijão de gás foi trocado durante o turno para controle de estoque</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={gasExchange}
                onCheckedChange={setGasExchange}
                className="data-[state=checked]:bg-orange-600"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button 
              onClick={handleSaveValues}
              disabled={saveValuesMutation.isPending}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
              size="lg"
            >
              <Save className="h-5 w-5 mr-2" />
              {saveValuesMutation.isPending ? "Salvando..." : "Salvar Valores para Fechamento"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
