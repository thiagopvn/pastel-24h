import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, DollarSign, TrendingUp, TrendingDown, Receipt, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { api } from "@/lib/apiClient";
import { RegisterExpenseModal } from "@/components/admin/register-expense-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Transaction {
  id: string;
  shiftId?: number;
  userId: number;
  type: "entrada" | "saida";
  amount: string;
  description: string;
  user: string;
  date: Date;
  createdAt: Date;
  runningBalance: string;
}

interface FinancialBalance {
  balance: string;
  totalWithdrawals: string;
  totalExpenses: string;
  transactionCount: number;
}

export function FinancialControl() {
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Query para buscar o saldo
  const { data: balance, isLoading: balanceLoading } = useQuery<FinancialBalance>({
    queryKey: ["/api/admin/financial/balance"],
    queryFn: () => api.get("/api/admin/financial/balance"),
  });

  // Query para buscar o extrato
  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/financial/statement"],
    queryFn: () => api.get("/api/admin/financial/statement"),
  });

  // Mutation para registrar gasto
  const registerExpenseMutation = useMutation({
    mutationFn: (data: { amount: string; reason: string }) =>
      api.post("/api/admin/financial/expense", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial/statement"] });
      setIsExpenseModalOpen(false);
    },
  });

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "entrada":
        return "Entrada";
      case "saida":
        return "Saída";
      default:
        return type;
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case "entrada":
        return <Badge className="bg-green-500 text-white font-semibold">Entrada</Badge>;
      case "saida":
        return <Badge className="bg-red-500 text-white font-semibold">Saída</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Controle Financeiro</h1>
        </div>
        <Button onClick={() => setIsExpenseModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Registrar Gasto
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(parseFloat(balance?.balance || "0"))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {balance?.transactionCount || 0} transações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(parseFloat(balance?.totalWithdrawals || "0"))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Retiradas dos caixas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(parseFloat(balance?.totalExpenses || "0"))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Gastos administrativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transações</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {balance?.transactionCount || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Total de movimentações
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Extrato */}
      <Card>
        <CardHeader>
          <CardTitle>Extrato de Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>{getTransactionTypeBadge(transaction.type)}</TableCell>
                    <TableCell>
                      {transaction.description}
                      {transaction.shiftId && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (Turno #{transaction.shiftId})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {transaction.user || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          transaction.type === "entrada"
                            ? "text-green-600 font-bold"
                            : "text-red-600 font-bold"
                        }
                      >
                        {transaction.type === "entrada" ? "+" : "-"}
                        {formatCurrency(parseFloat(transaction.amount))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(parseFloat(transaction.runningBalance))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <AlertDescription>
                Nenhuma transação encontrada. As entradas serão registradas automaticamente
                quando houver retiradas para envelope administrativo nos fechamentos de turno.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Modal de Registro de Gasto */}
      <RegisterExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSubmit={(data) => registerExpenseMutation.mutate(data)}
        isLoading={registerExpenseMutation.isPending}
      />
    </div>
  );
}