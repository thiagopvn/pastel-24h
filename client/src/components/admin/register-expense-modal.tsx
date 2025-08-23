import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface RegisterExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: string; reason: string }) => void;
  isLoading?: boolean;
}

export function RegisterExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: RegisterExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!amount || !reason.trim()) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Por favor, insira um valor válido maior que zero.");
      return;
    }

    // Submeter
    onSubmit({
      amount: parsedAmount.toFixed(2),
      reason: reason.trim(),
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      setAmount("");
      setReason("");
      setError("");
      onClose();
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permitir apenas números, vírgula e ponto
    if (value === "" || /^[0-9]*[,.]?[0-9]*$/.test(value)) {
      setAmount(value);
    }
  };

  const getFormattedValue = () => {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      return formatCurrency(parsedAmount);
    }
    return "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Gasto Administrativo</DialogTitle>
            <DialogDescription>
              Registre um gasto feito a partir do saldo dos envelopes administrativos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="amount">Valor do Gasto</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                disabled={isLoading}
                autoFocus
              />
              {amount && getFormattedValue() && (
                <p className="text-sm text-muted-foreground">
                  Valor: {getFormattedValue()}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo/Descrição</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Compra de copos descartáveis, Pagamento de conta de luz..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Descreva detalhadamente o que foi comprado ou pago.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar Gasto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}