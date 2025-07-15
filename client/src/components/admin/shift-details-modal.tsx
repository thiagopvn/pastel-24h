import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, User, Package, CreditCard, Coins, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShiftDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: number;
}

interface ShiftDetails {
  shift: {
    id: number;
    userId: number;
    startTime: string;
    initialCash: string;
    initialCoins: string;
    tempFinalCash?: string;
    tempFinalCoins?: string;
    user: {
      name: string;
      email: string;
    };
  };
  records: Array<{
    id: number;
    productId: number;
    entryQty: number;
    arrivalQty: number;
    leftoverQty: number;
    discardQty: number;
    consumedQty: number;
    soldQty: number;
    priceSnapshot: string;
    itemTotal: string;
    product: {
      name: string;
      category: string;
    };
  }>;
  payments: {
    cash: string;
    pix: string;
    stoneCard: string;
    stoneVoucher: string;
    pagBankCard: string;
  } | null;
  collaborators: Array<{
    id: number;
    name: string;
    email: string;
  }>;
}

export function ShiftDetailsModal({ isOpen, onClose, shiftId }: ShiftDetailsModalProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: shiftDetails, refetch, isLoading, error } = useQuery<ShiftDetails>({
    queryKey: [`/api/admin/shift-details/${shiftId}`],
    enabled: isOpen && shiftId > 0,
    refetchInterval: autoRefresh ? 5000 : false, // Auto-refresh every 5 seconds
    retry: 3,
  });

  console.log("ShiftDetailsModal state:", { 
    isOpen, 
    shiftId, 
    isLoading, 
    hasData: !!shiftDetails, 
    error: error?.message 
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue || 0);
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotals = () => {
    if (!shiftDetails?.records) return { totalSales: 0, totalProducts: 0 };
    
    const totalSales = shiftDetails.records.reduce((sum, record) => 
      sum + parseFloat(record.itemTotal || '0'), 0
    );
    
    const totalProducts = shiftDetails.records.reduce((sum, record) => 
      sum + record.soldQty, 0
    );

    return { totalSales, totalProducts };
  };

  const { totalSales, totalProducts } = calculateTotals();

  if (isLoading || !shiftDetails) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Turno #{shiftId}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            {isLoading ? (
              <div className="animate-pulse text-gray-500">Carregando detalhes...</div>
            ) : error ? (
              <div className="text-center text-red-500">
                <p>Erro ao carregar detalhes do turno</p>
                <p className="text-sm">{error.message}</p>
                <Button variant="outline" onClick={() => refetch()} className="mt-2">
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>Turno não encontrado</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Monitoramento em Tempo Real - Turno #{shiftDetails.shift.id}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
              <Badge variant={autoRefresh ? "default" : "secondary"}>
                {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? "Pausar" : "Retomar"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Funcionário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{shiftDetails.shift.user.name}</p>
                <p className="text-sm text-gray-500">{shiftDetails.shift.user.email}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Início do Turno
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{formatTime(shiftDetails.shift.startTime)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Resumo Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Vendas: {formatCurrency(totalSales)}</p>
                <p className="text-sm">Produtos: {totalProducts} unidades</p>
              </CardContent>
            </Card>
          </div>

          {/* Colaboradores */}
          {shiftDetails.collaborators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Colaboradores no Turno</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {shiftDetails.collaborators.map((collaborator) => (
                    <Badge key={collaborator.id} variant="outline">
                      {collaborator.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Caixa Atual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Estado do Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Dinheiro Inicial</p>
                  <p className="font-semibold">{formatCurrency(shiftDetails.shift.initialCash)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Moedas Iniciais</p>
                  <p className="font-semibold">{formatCurrency(shiftDetails.shift.initialCoins)}</p>
                </div>
                {shiftDetails.shift.tempFinalCash && (
                  <div>
                    <p className="text-sm text-gray-600">Dinheiro Contado</p>
                    <p className="font-semibold text-blue-600">{formatCurrency(shiftDetails.shift.tempFinalCash)}</p>
                  </div>
                )}
                {shiftDetails.shift.tempFinalCoins && (
                  <div>
                    <p className="text-sm text-gray-600">Moedas Contadas</p>
                    <p className="font-semibold text-blue-600">{formatCurrency(shiftDetails.shift.tempFinalCoins)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formas de Pagamento */}
          {shiftDetails.payments && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Formas de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Dinheiro</p>
                    <p className="font-semibold">{formatCurrency(shiftDetails.payments.cash)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">PIX</p>
                    <p className="font-semibold">{formatCurrency(shiftDetails.payments.pix)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Stone D/C</p>
                    <p className="font-semibold">{formatCurrency(shiftDetails.payments.stoneCard)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Stone Voucher</p>
                    <p className="font-semibold">{formatCurrency(shiftDetails.payments.stoneVoucher)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">PagBank D/C</p>
                    <p className="font-semibold">{formatCurrency(shiftDetails.payments.pagBankCard)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Produtos em Movimento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produtos em Movimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shiftDetails.records.length > 0 ? (
                <div className="space-y-3">
                  {shiftDetails.records.map((record) => (
                    <div key={record.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{record.product.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {record.product.category}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(record.itemTotal)}</p>
                          <p className="text-sm text-gray-500">{formatCurrency(record.priceSnapshot)} cada</p>
                        </div>
                      </div>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-sm">
                        <div>
                          <p className="text-gray-600">Entrada</p>
                          <p className="font-medium">{record.entryQty}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Chegada</p>
                          <p className="font-medium">{record.arrivalQty}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Sobra</p>
                          <p className="font-medium">{record.leftoverQty}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Descarte</p>
                          <p className="font-medium text-red-600">{record.discardQty}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Consumo</p>
                          <p className="font-medium text-orange-600">{record.consumedQty}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Vendido</p>
                          <p className="font-medium text-green-600">{record.soldQty}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum produto movimentado ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}