import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Timeline as TimelineType } from "@shared/schema";

export default function Timeline() {
  const { data: timeline, isLoading } = useQuery<TimelineType[]>({
    queryKey: ["/api/admin/timeline"],
    refetchInterval: 20000,
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
      case 'cash_withdrawal':
        return 'bg-yellow-500';
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
                    <p className="text-sm font-medium text-gray-900">{event.description}</p>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(event.createdAt!), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                  {event.metadata && (
                    <p className="text-sm text-gray-600 mt-1">
                      {typeof event.metadata === 'object' && event.metadata !== null
                        ? Object.entries(event.metadata).map(([key, value]) => `${key}: ${value}`).join(', ')
                        : String(event.metadata)
                      }
                    </p>
                  )}
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
