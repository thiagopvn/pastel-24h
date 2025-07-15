import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, Pause, Lock, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertShiftSchema, type Shift } from "@shared/schema";
import { z } from "zod";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CloseShiftModal } from "./close-shift-modal";
import { formatCurrency } from "@/lib/calculations";

type ShiftForm = z.infer<typeof insertShiftSchema>;

export default function ShiftStatusCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  const { data: currentShift, isLoading, refetch } = useQuery<Shift>({
    queryKey: ["/api/shifts/current"],
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const { data: lastClosedShift } = useQuery({
    queryKey: ["/api/shifts/last-closed"],
    enabled: !currentShift, // Only fetch when no current shift
  });

  // Query para buscar retiradas pendentes que devem ser consideradas no próximo turno
  const { data: pendingWithdrawals } = useQuery({
    queryKey: ["/api/admin/pending-withdrawals"],
    enabled: !currentShift, // Only when opening a new shift
  });

  const form = useForm<ShiftForm>({
    resolver: zodResolver(insertShiftSchema),
    defaultValues: {
      initialCash: "0.00",
      initialCoins: "0.00",
      gasExchange: false,
      notes: "",
    },
  });

  // Calculate initial cash considering withdrawals
  const calculateInitialCash = () => {
    if (!lastClosedShift) return "200.00"; // Default for first shift

    let inheritedCash = parseFloat(lastClosedShift.inheritedCash || "200.00");

    // Subtract pending withdrawals
    if (pendingWithdrawals && Array.isArray(pendingWithdrawals)) {
      const totalWithdrawals = pendingWithdrawals.reduce((total, withdrawal) => {
        return total + parseFloat(withdrawal.amount || 0);
      }, 0);
      inheritedCash -= totalWithdrawals;
    }

    return Math.max(inheritedCash, 0).toFixed(2); // Ensure non-negative
  };

  const calculateInitialCoins = () => {
    if (!lastClosedShift) return "50.00"; // Default for first shift

    let inheritedCoins = parseFloat(lastClosedShift.inheritedCoins || "50.00");
    return Math.max(inheritedCoins, 0).toFixed(2); // Ensure non-negative
  };

  // Update form values when data is available
  useEffect(() => {
    if (!currentShift) {
      const adjustedCash = calculateInitialCash();
      const adjustedCoins = calculateInitialCoins();

      form.setValue("initialCash", adjustedCash);
      form.setValue("initialCoins", adjustedCoins);
    }
  }, [lastClosedShift, pendingWithdrawals, currentShift]);

  const openShiftMutation = useMutation({
    mutationFn: async (data: ShiftForm) => {
      const res = await apiRequest("POST", "/api/shifts/open", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao abrir turno");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/last-closed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-withdrawals"] });
      toast({ title: "Turno aberto com sucesso!" });
      setIsOpenDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao abrir turno", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async (closeData: any) => {
      console.log("Enviando dados para fechar turno:", closeData);
      const res = await apiRequest("POST", "/api/shifts/close", closeData);
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Erro no fechamento:", errorData);
        throw new Error(errorData.message || 'Erro ao fechar turno');
      }
      const result = await res.json();
      console.log("Turno fechado com sucesso:", result);
      return result;
    },
    onSuccess: () => {
      // Force remove current shift from cache
      queryClient.setQueryData(["/api/shifts/current"], null);
      // Clear all related caches
      queryClient.removeQueries({ queryKey: ["/api/shifts"] });
      queryClient.removeQueries({ queryKey: ["/api/shift-records"] });
      queryClient.removeQueries({ queryKey: ["/api/shift-payments"] });
      queryClient.removeQueries({ queryKey: ["/api/shift-collaborators"] });
      queryClient.removeQueries({ queryKey: ["/api/cash-adjustments"] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["/api/shifts/current"] });
      // Force window refresh as last resort
      setTimeout(() => {
        window.location.reload();
      }, 500);
      toast({ title: "Turno fechado com sucesso!" });
      setIsCloseDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Erro ao fechar turno:", error);
      toast({ 
        title: "Erro ao fechar turno", 
        description: error.message || "Erro desconhecido",
        variant: "destructive" 
      });
    },
  });

  const handleOpenShift = (data: ShiftForm) => {
    openShiftMutation.mutate(data);
  };

  const handleCloseShift = async (data: any) => {
    if (!currentShift) return;

    try {
      console.log("Iniciando fechamento do turno para shift:", currentShift.id);

      // Fetch current shift records and payments with shiftId parameter
      const [recordsRes, paymentsRes] = await Promise.all([
        apiRequest("GET", `/api/shift-records?shiftId=${currentShift.id}`),
        apiRequest("GET", `/api/shift-payments?shiftId=${currentShift.id}`)
      ]);

      console.log("Response status - records:", recordsRes.status, "payments:", paymentsRes.status);

      let records = [];
      let payments = { cash: 0, pix: 0, stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 };

      if (recordsRes.ok) {
        records = await recordsRes.json();
        console.log("Records obtidos:", records);
      } else {
        console.warn("Falha ao obter records:", recordsRes.status, recordsRes.statusText);
      }

      if (paymentsRes.ok) {
        const paymentData = await paymentsRes.json();
        if (paymentData && typeof paymentData === 'object') {
          payments = paymentData;
        }
        console.log("Payments obtidos:", payments);
      } else {
        console.warn("Falha ao obter payments:", paymentsRes.status, paymentsRes.statusText);
      }

      // Prepare closing data with counted values from the form
      const closeData = {
        shiftId: currentShift.id,
        records: records || [],
        payments: payments,
        notes: data.notes || "",
        finalCash: data.countedCash, // Using counted value from form
        finalCoins: data.countedCoins, // Using counted value from form
        gasExchange: false
      };

      console.log("Dados de fechamento preparados:", closeData);
      closeShiftMutation.mutate(closeData);
    } catch (error) {
      console.error("Erro no handleCloseShift:", error);
      toast({ 
        title: "Erro ao coletar dados do turno", 
        description: "Não foi possível obter os dados necessários para fechar o turno",
        variant: "destructive" 
      });
    }
  };

  const getDuration = () => {
    if (!currentShift?.startTime) return "0min";
    return formatDistanceToNow(new Date(currentShift.startTime), { 
      locale: ptBR,
      addSuffix: false 
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Status do Turno</h2>
          {currentShift ? (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
              <Clock className="h-3 w-3 inline mr-1" />
              Turno Aberto
            </span>
          ) : (
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
              Sem Turno
            </span>
          )}
        </div>

        {currentShift ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Dinheiro Total Inicial</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(parseFloat(currentShift.initialCash) + parseFloat(currentShift.initialCoins))}
                </p>
                <p className="text-xs text-gray-500">
                  Caixa: {formatCurrency(parseFloat(currentShift.initialCash))} + 
                  Moedas: {formatCurrency(parseFloat(currentShift.initialCoins))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Tempo de Turno</p>
                <p className="text-lg font-semibold text-gray-900">{getDuration()}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Iniciado às {new Date(currentShift.startTime).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">Nenhum turno em andamento</p>
          </div>
        )}

        {!currentShift ? (
          <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Abrir Novo Turno
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abrir Novo Turno</DialogTitle>
                <DialogDescription>
                  Configure os valores iniciais para começar um novo turno.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleOpenShift)} className="space-y-4">
                {/* Resumo de Herança */}
                {lastClosedShift && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Resumo do Turno Anterior
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-blue-700">Turno:</span> #{lastClosedShift.shift.id}
                      </div>
                      <div>
                        <span className="text-blue-700">Fechado em:</span> {new Date(lastClosedShift.shift.endTime).toLocaleString('pt-BR')}
                      </div>
                      <div>
                        <span className="text-blue-700">Caixa Final:</span> {formatCurrency(parseFloat(lastClosedShift.shift.finalCash || '0'))}
                      </div>
                      <div>
                        <span className="text-blue-700">Moedas Finais:</span> {formatCurrency(parseFloat(lastClosedShift.shift.finalCoins || '0'))}
                      </div>
                      {lastClosedShift.shift.cashDivergence && parseFloat(lastClosedShift.shift.cashDivergence) !== 0 && (
                        <div className="col-span-2">
                          <span className="text-red-700">⚠️ Divergência:</span> {formatCurrency(parseFloat(lastClosedShift.shift.cashDivergence))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mostrar retiradas pendentes se houverem */}
                {pendingWithdrawals && pendingWithdrawals.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Retiradas Pendentes
                    </h4>
                    <div className="space-y-1">
                      {pendingWithdrawals.map((withdrawal: any, index: number) => (
                        <div key={index} className="text-xs text-yellow-700 flex justify-between">
                          <span>{withdrawal.reason}</span>
                          <span className="font-medium">-{formatCurrency(parseFloat(withdrawal.amount))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-yellow-600 mt-2">
                      Essas retiradas serão automaticamente deduzidas do caixa inicial
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="initialCash" className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                    Caixa Inicial (R$)
                    <Badge variant="secondary" className="text-xs">Automático</Badge>
                  </Label>
                  <Input
                    id="initialCash"
                    type="number"
                    step="0.01"
                    {...form.register("initialCash")}
                    value={calculateInitialCash()}
                    readOnly
                    className="bg-blue-50 border-blue-200 cursor-not-allowed"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    {lastClosedShift 
                      ? `Herdado do turno #${lastClosedShift.shift.id}`
                      : "Primeiro turno - valor padrão R$ 200,00"
                    }
                    {pendingWithdrawals && pendingWithdrawals.length > 0 && 
                      ` - descontadas ${pendingWithdrawals.length} retirada(s)`
                    }
                  </p>
                </div>

                <div>
                  <Label htmlFor="initialCoins" className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                    Moedas Iniciais (R$)
                    <Badge variant="secondary" className="text-xs">Automático</Badge>
                  </Label>
                  <Input
                    id="initialCoins"
                    type="number"
                    step="0.01"
                    {...form.register("initialCoins")}
                    value={calculateInitialCoins()}
                    readOnly
                    className="bg-blue-50 border-blue-200 cursor-not-allowed"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    {lastClosedShift 
                      ? `Herdado do turno #${lastClosedShift.shift.id}`
                      : "Primeiro turno - valor padrão R$ 50,00"
                    }
                  </p>
                </div>

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    {...form.register("notes")}
                    placeholder="Observações sobre o turno"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={openShiftMutation.isPending}
                    className="flex-1"
                  >
                    {openShiftMutation.isPending ? "Abrindo..." : "Abrir Turno"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpenDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <>
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => setIsCloseDialogOpen(true)}
            >
              <Pause className="h-4 w-4 mr-2" />
              Fechar Turno
            </Button>

            <CloseShiftModal
              isOpen={isCloseDialogOpen}
              onClose={() => setIsCloseDialogOpen(false)}
              shift={currentShift}
              onConfirm={handleCloseShift}
              isClosing={closeShiftMutation.isPending}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}