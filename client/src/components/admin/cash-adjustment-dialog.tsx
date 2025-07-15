import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, AlertTriangle, Clock, Info } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/calculations";

const cashAdjustmentSchema = z.object({
  amount: z.string().min(1, "Informe o valor"),
  reason: z.string().min(10, "Descreva o motivo (mínimo 10 caracteres)"),
  type: z.enum(["withdraw", "adjustment"]),
});

type CashAdjustmentForm = z.infer<typeof cashAdjustmentSchema>;

// Componente para mostrar o valor atual do caixa
function CurrentCashDisplay() {
  const { data: currentShift } = useQuery({
    queryKey: ["/api/shifts/current"],
  });

  const { data: shiftPayments } = useQuery({
    queryKey: ["/api/shift-payments"],
    enabled: !!currentShift?.id,
  });

  // Query para buscar registros de produtos para calcular vendas
  const { data: shiftRecords } = useQuery({
    queryKey: ["/api/shift-records"],
    enabled: !!currentShift?.id,
  });

  // Query para buscar ajustes de caixa para deduzir do valor atual
  const { data: cashAdjustments } = useQuery({
    queryKey: ["/api/cash-adjustments", currentShift?.id],
    enabled: !!currentShift?.id,
  });

  if (!currentShift) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Clock className="h-4 w-4" />
        <span className="text-sm">Nenhum turno ativo</span>
      </div>
    );
  }

  const initialCash = parseFloat(currentShift.initialCash || "0");

  // Calcular vendas totais dos registros de produtos
  let totalSalesFromRecords = 0;
  if (shiftRecords && Array.isArray(shiftRecords)) {
    totalSalesFromRecords = shiftRecords.reduce((total, record) => {
      return total + parseFloat(record.itemTotal || 0);
    }, 0);
  }

  // Usar vendas em dinheiro registradas ou assumir que é igual ao total de vendas se não houver pagamentos registrados
  const cashSales = parseFloat(shiftPayments?.cash || "0") || totalSalesFromRecords;

  // Calcular total de ajustes/retiradas feitos neste turno
  let totalAdjustments = 0;
  if (cashAdjustments && Array.isArray(cashAdjustments)) {
    totalAdjustments = cashAdjustments.reduce((total, adjustment) => {
      if (adjustment.type === 'withdraw' || adjustment.type === 'adjustment') {
        return total + parseFloat(adjustment.amount || 0);
      }
      return total;
    }, 0);
  }

  const currentCashValue = initialCash + cashSales - totalAdjustments;

  return (
    <div className="text-right">
      <div className="text-2xl font-bold text-blue-900">
        {formatCurrency(currentCashValue)}
      </div>
      <div className="text-xs text-blue-600">
        Inicial: {formatCurrency(initialCash)} + Vendas: {formatCurrency(cashSales)}
        {totalAdjustments > 0 && ` - Retiradas: ${formatCurrency(totalAdjustments)}`}
      </div>
      {totalSalesFromRecords > 0 && !shiftPayments?.cash && (
        <div className="text-xs text-orange-600 mt-1">
          * Assumindo vendas em dinheiro (pagamentos não registrados ainda)
        </div>
      )}
      {totalAdjustments > 0 && (
        <div className="text-xs text-red-600 mt-1">
          {cashAdjustments.length} ajuste(s) administrativo(s) aplicado(s)
        </div>
      )}
    </div>
  );
}

export function CashAdjustmentDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CashAdjustmentForm>({
    resolver: zodResolver(cashAdjustmentSchema),
    defaultValues: {
      amount: "",
      reason: "",
      type: "withdraw",
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: async (data: CashAdjustmentForm) => {
      const res = await apiRequest("POST", "/api/admin/cash-withdraw", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao processar ajuste");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas ao caixa
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/last-closed"] });

      toast({ 
        title: "Ajuste registrado com sucesso!",
        description: "O valor foi deduzido do caixa atual e será considerado em turnos futuros."
      });
      setIsOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao registrar ajuste", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (data: CashAdjustmentForm) => {
    adjustmentMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DollarSign className="h-4 w-4 mr-2" />
          Retirada de Caixa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Retirada/Ajuste de Caixa</DialogTitle>
          <DialogDescription>
            Registre retiradas ou ajustes no caixa. Esta ação criará um registro de auditoria 
            e será automaticamente considerada no cálculo de turnos futuros.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Informação do Caixa Atual */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Valor Atual no Caixa</span>
                </div>
                <CurrentCashDisplay />
              </div>
              <div className="text-xs text-blue-600 mt-2">
                Calculado automaticamente com base no turno ativo e vendas registradas
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Esta retirada será automaticamente considerada 
                no cálculo do saldo inicial de turnos futuros, evitando divergências falsas.
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Esta ação será registrada no sistema com seu nome, 
                data/hora e IP. O valor será deduzido do caixa atual.
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Operação</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={field.value === "withdraw" ? "default" : "outline"}
                        onClick={() => field.onChange("withdraw")}
                        className="flex-1"
                      >
                        Retirada
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "adjustment" ? "default" : "outline"}
                        onClick={() => field.onChange("adjustment")}
                        className="flex-1"
                      >
                        Ajuste
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o motivo da retirada/ajuste..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={adjustmentMutation.isPending}
                className="flex-1"
              >
                {adjustmentMutation.isPending ? "Processando..." : "Confirmar"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}