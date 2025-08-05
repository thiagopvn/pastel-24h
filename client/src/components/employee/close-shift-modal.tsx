import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Calculator } from "lucide-react";
import type { Shift } from "@shared/schema";
import { formatCurrency } from "@/lib/calculations";
import { MAX_CASH_DIVERGENCE } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";

const closeShiftSchema = z.object({
  countedFinalCash: z.string().min(1, "Informe o valor contado em dinheiro"),
  countedFinalCoins: z.string().min(1, "Informe o valor contado em moedas"),
  envelopeCash: z.string().min(1, "Informe o valor para o envelope em dinheiro"),
  envelopeCoins: z.string().min(1, "Informe o valor para o envelope em moedas"),
  notes: z.string().optional(),
});

type CloseShiftForm = z.infer<typeof closeShiftSchema>;

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  onConfirm: (data: any) => void;
  isClosing: boolean;
}

export function CloseShiftModal({
  isOpen,
  onClose,
  shift,
  onConfirm,
  isClosing
}: CloseShiftModalProps) {
  const [cashDivergence, setCashDivergence] = useState(0);

  const form = useForm<CloseShiftForm>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: {
      countedFinalCash: shift.tempFinalCash || "",
      countedFinalCoins: shift.tempFinalCoins || "",
      envelopeCash: "",
      envelopeCoins: "",
      notes: "",
    },
  });

  // Update form values when shift data changes
  useEffect(() => {
    if (shift.tempFinalCash && shift.tempFinalCoins) {
      form.setValue("countedFinalCash", shift.tempFinalCash);
      form.setValue("countedFinalCoins", shift.tempFinalCoins);
    }
  }, [shift.tempFinalCash, shift.tempFinalCoins, form]);

  // Get expected cash from API
  const { data: paymentData } = useQuery({
    queryKey: [`/api/shift-payments?shiftId=${shift.id}`],
    enabled: isOpen,
  });

  // Get cash adjustments/withdrawals from the current shift
  const { data: cashAdjustments } = useQuery({
    queryKey: ["/api/cash-adjustments", shift.id],
    enabled: isOpen,
  });

  const countedFinalCash = parseFloat(form.watch("countedFinalCash") || "0");
  const countedFinalCoins = parseFloat(form.watch("countedFinalCoins") || "0");
  const envelopeCash = parseFloat(form.watch("envelopeCash") || "0");
  const envelopeCoins = parseFloat(form.watch("envelopeCoins") || "0");

  // Calculate expected cash considering withdrawals
  const initialCash = parseFloat(shift.initialCash || "200.00");
  const initialCoins = parseFloat(shift.initialCoins || "50.00");
  const cashSales = parseFloat((paymentData as any)?.cash || "0");

  // Calculate total withdrawals made during this shift
  let totalWithdrawals = 0;
  if (cashAdjustments && Array.isArray(cashAdjustments)) {
    totalWithdrawals = cashAdjustments.reduce((total, adjustment) => {
      if (adjustment.type === 'withdraw' || adjustment.type === 'adjustment') {
        return total + parseFloat(adjustment.amount || 0);
      }
      return total;
    }, 0);
  }

  // Expected cash = initial + sales - withdrawals
  const expectedCash = initialCash + cashSales - totalWithdrawals;
  
  // Total physical money initial = initial cash + initial coins
  const totalPhysicalInitial = initialCash + initialCoins;
  
  // Total expected final = expected cash + initial coins (coins don't change during shift)
  const totalExpectedFinal = expectedCash + initialCoins;

  // Calculate cash for next shift
  const cashForNextShift = countedFinalCash - envelopeCash;
  const coinsForNextShift = countedFinalCoins - envelopeCoins;
  const totalForNextShift = cashForNextShift + coinsForNextShift;

  // Calculate divergence when counted cash changes
  useEffect(() => {
    if (countedFinalCash >= 0 && totalExpectedFinal >= 0) {
      // Total contado = dinheiro contado + moedas contadas
      const totalCounted = countedFinalCash + countedFinalCoins;
      
      // Divergência total considerando dinheiro + moedas
      const divergence = totalCounted - totalExpectedFinal;
      setCashDivergence(divergence);
    }
  }, [countedFinalCash, countedFinalCoins, totalExpectedFinal]);

  const handleSubmit = (data: CloseShiftForm) => {
    // Check cash divergence
    if (Math.abs(cashDivergence) > MAX_CASH_DIVERGENCE && !data.notes) {
      form.setError("notes", { 
        message: `Divergência de ${formatCurrency(cashDivergence)}. Observação obrigatória.` 
      });
      return;
    }

    onConfirm(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechamento de Turno</DialogTitle>
          <DialogDescription>
            Conte o dinheiro físico e informe os valores para fechamento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Expected vs Counted Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Dinheiro Físico Inicial</p>
                  <p className="font-semibold">{formatCurrency(totalPhysicalInitial)}</p>
                  <p className="text-xs text-gray-500">
                    Caixa: {formatCurrency(initialCash)} + Moedas: {formatCurrency(initialCoins)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Vendas em Dinheiro</p>
                  <p className="font-semibold">{formatCurrency(cashSales)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Retiradas</p>
                  <p className="font-semibold text-red-600">
                    -{formatCurrency(totalWithdrawals)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Dinheiro Esperado Final</p>
                  <p className="font-semibold text-blue-600">
                    {formatCurrency(totalExpectedFinal)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Caixa: {formatCurrency(expectedCash)} + Moedas: {formatCurrency(initialCoins)}
                  </p>
                </div>
              </div>
            </div>

            {/* Show withdrawals if any */}
            {totalWithdrawals > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Retiradas Durante o Turno</h4>
                <div className="space-y-1">
                  {(cashAdjustments as any)?.map((adjustment: any, index: number) => (
                    <div key={index} className="text-sm text-yellow-700 flex justify-between">
                      <span>{adjustment.reason}</span>
                      <span className="font-medium">-{formatCurrency(parseFloat(adjustment.amount))}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-yellow-600 mt-2">
                  Essas retiradas já foram descontadas do caixa esperado
                </div>
              </div>
            )}

            {/* Step 1: Total Counted in Store */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  1
                </span>
                Total Contado na Loja
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="countedFinalCash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Cédulas (R$)
                        {shift.tempFinalCash && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Carregado
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Total em cédulas contado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="countedFinalCoins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Moedas (R$)
                        {shift.tempFinalCoins && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Carregado
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Total em moedas contado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm">
                <p className="font-medium">Total Contado: {formatCurrency(countedFinalCash + countedFinalCoins)}</p>
              </div>
            </div>

            {/* Step 2: Envelope Values */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  2
                </span>
                Retirada para Envelope Administrativo
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="envelopeCash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cédulas para Envelope (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Valor em cédulas para o envelope
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="envelopeCoins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moedas para Envelope (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Valor em moedas para o envelope
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-yellow-50 rounded p-3 text-sm">
                <p className="font-medium">Total para Envelope: {formatCurrency(envelopeCash + envelopeCoins)}</p>
              </div>
            </div>

            {/* Step 3: Cash for Next Shift */}
            <div className="space-y-4 border rounded-lg p-4 bg-green-50">
              <h3 className="font-medium flex items-center gap-2 text-green-800">
                <Calculator className="h-5 w-5" />
                Troco para Próximo Turno (Calculado Automaticamente)
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Cédulas</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(cashForNextShift)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(countedFinalCash)} - {formatCurrency(envelopeCash)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Moedas</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(coinsForNextShift)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(countedFinalCoins)} - {formatCurrency(envelopeCoins)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-2">
                <p className="font-medium text-green-800">
                  Total para Próximo Turno: {formatCurrency(totalForNextShift)}
                </p>
              </div>
            </div>

            {/* Divergence Analysis */}
            {countedFinalCash > 0 && expectedCash > 0 && (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium">Análise de Divergência</h3>

                {Math.abs(cashDivergence) <= MAX_CASH_DIVERGENCE ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Divergência dentro do limite aceitável: {formatCurrency(cashDivergence)}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Divergência detectada: {formatCurrency(cashDivergence)}</strong>
                      <br />
                      Observação obrigatória para prosseguir com o fechamento.
                    </AlertDescription>
                  </Alert>
                )}

                {Math.abs(cashDivergence) > MAX_CASH_DIVERGENCE && (
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações (Obrigatório)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explique o motivo da divergência..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isClosing}>
                {isClosing ? "Fechando..." : "Confirmar Fechamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}