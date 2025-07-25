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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import type { Shift } from "@shared/schema";
import { formatCurrency } from "@/lib/calculations";
import { MIN_CASH_RECOMMENDED, MIN_COINS_RECOMMENDED, MAX_CASH_DIVERGENCE } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";

const closeShiftSchema = z.object({
  countedCash: z.string().min(1, "Informe o valor contado em dinheiro"),
  countedCoins: z.string().min(1, "Informe o valor contado em moedas"),
  notes: z.string().optional(),
  confirmLowCash: z.boolean().optional(),
  confirmLowCoins: z.boolean().optional(),
});

type CloseShiftForm = z.infer<typeof closeShiftSchema>;

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  onConfirm: (data: CloseShiftForm) => void;
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
  const [showWarnings, setShowWarnings] = useState(false);

  const form = useForm<CloseShiftForm>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: {
      countedCash: shift.tempFinalCash || "",
      countedCoins: shift.tempFinalCoins || "",
      notes: "",
      confirmLowCash: false,
      confirmLowCoins: false,
    },
  });

  // Update form values when shift data changes
  useEffect(() => {
    if (shift.tempFinalCash && shift.tempFinalCoins) {
      form.setValue("countedCash", shift.tempFinalCash);
      form.setValue("countedCoins", shift.tempFinalCoins);
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

  const countedCash = parseFloat(form.watch("countedCash") || "0");
  const countedCoins = parseFloat(form.watch("countedCoins") || "0");

  // Calculate expected cash considering withdrawals
  const initialCash = parseFloat(shift.initialCash || "200.00");
  const initialCoins = parseFloat(shift.initialCoins || "50.00");
  const cashSales = parseFloat(paymentData?.cash || "0");

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

  // Calculate divergence when counted cash changes
  useEffect(() => {
    if (countedCash >= 0 && totalExpectedFinal >= 0) {
      // Total contado = dinheiro contado + moedas contadas
      const totalCounted = countedCash + countedCoins;
      
      // Divergência total considerando dinheiro + moedas
      const divergence = totalCounted - totalExpectedFinal;
      setCashDivergence(divergence);
    }
  }, [countedCash, countedCoins, totalExpectedFinal]);

  const handleSubmit = (data: CloseShiftForm) => {
    // Check low cash/coins warnings
    if (countedCash < MIN_CASH_RECOMMENDED || countedCoins < MIN_COINS_RECOMMENDED) {
      if (!showWarnings) {
        setShowWarnings(true);
        return;
      }

      if (countedCash < MIN_CASH_RECOMMENDED && !data.confirmLowCash) {
        form.setError("confirmLowCash", { message: "Confirmação obrigatória" });
        return;
      }

      if (countedCoins < MIN_COINS_RECOMMENDED && !data.confirmLowCoins) {
        form.setError("confirmLowCoins", { message: "Confirmação obrigatória" });
        return;
      }
    }

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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Fechamento de Turno</DialogTitle>
          <DialogDescription>
            Conte o dinheiro físico e informe os valores finais do caixa.
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
                  {cashAdjustments?.map((adjustment: any, index: number) => (
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

            {/* Step 1: Physical Count */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  1
                </span>
                Contagem Física
              </h3>

              <FormField
                control={form.control}
                name="countedCash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Dinheiro Final Contado (R$)
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
                      Conte todas as cédulas e informe o valor total
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="countedCoins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Moedas Finais Contadas (R$)
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
                      Conte todas as moedas e informe o valor total
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Step 2: Divergence Alert */}
            {countedCash > 0 && expectedCash > 0 && (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    2
                  </span>
                  Análise de Divergência
                </h3>

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

            {/* Step 3: Low Cash/Coins Warning */}
            {showWarnings && (countedCash < MIN_CASH_RECOMMENDED || countedCoins < MIN_COINS_RECOMMENDED) && (
              <div className="space-y-4 border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                <h3 className="font-medium flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  Valores Abaixo do Recomendado
                </h3>

                {countedCash < MIN_CASH_RECOMMENDED && (
                  <FormField
                    control={form.control}
                    name="confirmLowCash"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Confirmo que retornei cédulas ao cofre (mínimo recomendado: {formatCurrency(MIN_CASH_RECOMMENDED)})
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                {countedCoins < MIN_COINS_RECOMMENDED && (
                  <FormField
                    control={form.control}
                    name="confirmLowCoins"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Confirmo que retornei moedas ao cofre (mínimo recomendado: {formatCurrency(MIN_COINS_RECOMMENDED)})
                          </FormLabel>
                          <FormMessage />
                        </div>
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