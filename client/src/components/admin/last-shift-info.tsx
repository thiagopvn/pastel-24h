import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Clock, User, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";

export default function LastShiftInfo() {
  const { data: lastClosedShift, isLoading } = useQuery({
    queryKey: ["/api/shifts/last-closed"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lastClosedShift || !(lastClosedShift as any).shift) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <p>Nenhum turno fechado encontrado</p>
        </CardContent>
      </Card>
    );
  }

  const shift = (lastClosedShift as any).shift;
  const user = (lastClosedShift as any).user;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Último Turno Fechado</CardTitle>
        <Badge variant="secondary">
          #{shift.id}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{user?.name ?? 'Funcionário não encontrado'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>
              {new Date(shift.startTime).toLocaleDateString('pt-BR')} - 
              {new Date(shift.endTime).toLocaleDateString('pt-BR')}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-gray-500" />
            <span>
              Vendas: {formatCurrency(parseFloat(shift.totalSales || "0"))}
            </span>
          </div>

          {shift.cashDivergence && parseFloat(shift.cashDivergence) !== 0 && (
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              <span>
                Divergência: {formatCurrency(parseFloat(shift.cashDivergence))}
              </span>
            </div>
          )}

          <div className="pt-3 border-t">
            <Link href={`/admin/shifts/${shift.id}/corrections`}>
              <Button variant="outline" size="sm" className="w-full">
                <Edit className="h-4 w-4 mr-2" />
                Corrigir Fechamento
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}