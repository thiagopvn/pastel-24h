import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import type { Timeline as TimelineType } from "@shared/schema";

const EventMetadata = ({ event }: { event: TimelineType }) => {
  if (!event.metadata || typeof event.metadata !== 'object') {
    return null;
  }

  const metadata = event.metadata as any;
  let details = [];

  switch (event.action) {
    case 'shift_opened':
      details = [
        { label: 'Turno ID', value: metadata.shiftId },
        { label: 'Herdado do Turno', value: metadata.inheritedFromShiftId ? `#${metadata.inheritedFromShiftId}` : 'N/A' },
        { label: 'Caixa Informado', value: metadata.manualCash ? formatCurrency(metadata.manualCash) : 'N/A' },
        { label: 'Moedas Informadas', value: metadata.manualCoins ? formatCurrency(metadata.manualCoins) : 'N/A' },
        { label: 'Produtos Herdados', value: metadata.carryProductsCount ? `${metadata.carryProductsCount} itens` : 'Nenhum' },
      ];
      break;
    case 'shift_closed':
      details = [
        { label: 'Turno ID', value: metadata.shiftId },
        { label: 'Vendas Totais', value: metadata.totalSales ? formatCurrency(metadata.totalSales) : 'N/A' },
        { label: 'Vendas em Dinheiro', value: metadata.cashSales ? formatCurrency(metadata.cashSales) : 'N/A' },
        { label: 'Divergência', value: metadata.cashDivergence ? formatCurrency(metadata.cashDivergence) : 'N/A', color: metadata.cashDivergence && parseFloat(metadata.cashDivergence) < 0 ? 'text-red-500' : 'text-green-500' },
        { label: 'Caixa Contado', value: metadata.countedFinalCash ? formatCurrency(metadata.countedFinalCash) : 'N/A' },
        { label: 'Moedas Contadas', value: metadata.countedFinalCoins ? formatCurrency(metadata.countedFinalCoins) : 'N/A' },
        { label: 'Envelope (Notas)', value: metadata.envelopeCash ? formatCurrency(metadata.envelopeCash) : 'N/A' },
        { label: 'Envelope (Moedas)', value: metadata.envelopeCoins ? formatCurrency(metadata.envelopeCoins) : 'N/A' },
        { label: 'Troco p/ Próximo (Notas)', value: metadata.cashForNextShift ? formatCurrency(metadata.cashForNextShift) : 'N/A' },
        { label: 'Troco p/ Próximo (Moedas)', value: metadata.coinsForNextShift ? formatCurrency(metadata.coinsForNextShift) : 'N/A' },
      ];
      break;
    case 'initial_cash_updated':
      details = [
        { label: 'Turno ID', value: metadata.shiftId },
        { label: 'Novo Caixa Inicial', value: metadata.initialCash ? formatCurrency(metadata.initialCash) : 'N/A' },
        { label: 'Novas Moedas Iniciais', value: metadata.initialCoins ? formatCurrency(metadata.initialCoins) : 'N/A' },
      ];
      break;
    case 'cash_divergence':
      details = [
        { label: 'Turno ID', value: metadata.shiftId },
        { label: 'Valor da Divergência', value: metadata.divergenceAmount ? formatCurrency(metadata.divergenceAmount) : 'N/A', color: metadata.divergenceAmount && parseFloat(metadata.divergenceAmount) < 0 ? 'text-red-500' : 'text-green-500' },
        { label: 'Tipo', value: metadata.divergenceType || 'N/A' },
      ];
      break;
    case 'opening_discrepancy':
      details = [
        { label: 'Turno ID', value: metadata.shiftId },
        { label: 'Discrepância', value: metadata.discrepancy || 'N/A' },
        { label: 'Observações', value: metadata.notes || 'Nenhuma' },
      ];
      break;
    case 'cash_withdrawal':
      details = [
        { label: 'Turno ID', value: metadata.shiftId },
        { label: 'Valor Retirado', value: metadata.amount ? formatCurrency(metadata.amount) : 'N/A' },
        { label: 'Motivo', value: metadata.reason || 'N/A' },
        { label: 'Caixa Antes', value: metadata.beforeAmount ? formatCurrency(metadata.beforeAmount) : 'N/A' },
        { label: 'Caixa Depois', value: metadata.afterAmount ? formatCurrency(metadata.afterAmount) : 'N/A' },
      ];
      break;
    default:
      details = Object.entries(metadata)
        .filter(([_, value]) => value != null && value !== '')
        .map(([key, value]) => ({ 
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), 
          value: String(value) 
        }));
  }

  return (
    <div className="mt-2 pl-4 border-l-2 border-gray-200 text-xs text-gray-500 space-y-1">
      {details.map((detail, index) => detail.value && detail.value !== 'N/A' ? (
        <div key={index} className="flex justify-between">
          <span className="font-medium">{detail.label}:</span>
          <span className={detail.color || ''}>{detail.value}</span>
        </div>
      ) : null)}
    </div>
  );
};

export default function Timeline() {
  const { data: timeline, isLoading } = useQuery<TimelineType[]>({
    queryKey: ["/api/admin/timeline"],
    refetchInterval: 40000,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-4">
                <div className="w-2 h-2 bg-gray-200 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getEventColor = (action: string) => {
    switch (action) {
      case 'shift_opened':
        return 'bg-green-500';
      case 'shift_closed':
        return 'bg-blue-500';
      case 'cash_divergence':
        return 'bg-red-500';
      case 'opening_discrepancy':
        return 'bg-orange-500';
      case 'cash_withdrawal':
        return 'bg-yellow-500';
      case 'initial_cash_updated':
        return 'bg-purple-500';
      case 'product_updated':
        return 'bg-indigo-500';
      case 'user_created':
        return 'bg-teal-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Timeline de Ações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {timeline && timeline.length > 0 ? (
            timeline.map((event) => (
              <div key={event.id} className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-2 h-2 ${getEventColor(event.action)} rounded-full mt-2`}></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.description}</p>
                      {(event as any).user && <p className="text-xs text-gray-500">por: {(event as any).user.name}</p>}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(event.createdAt!), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                  <EventMetadata event={event} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-600 py-8">
              Nenhuma atividade recente
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
