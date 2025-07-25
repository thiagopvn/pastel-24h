import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Clock, Eye } from "lucide-react";
import type { Shift, User } from "@shared/schema";
import { ShiftDetailsModal } from "./shift-details-modal";

interface AlertsProps {
  period: string;
}

interface AlertsData {
  cashDivergences: Array<{
    shift: Shift;
    user: User;
    divergence: number;
  }>;
  openShifts: Shift[];
}

export default function Alerts({ period }: AlertsProps) {
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: alertsData, isLoading } = useQuery<AlertsData>({
    queryKey: ["/api/admin/alerts", period],
    refetchInterval: 15000, // More frequent for alerts
    staleTime: 0,
  });

  const handleViewShift = (shiftId: number) => {
    setSelectedShiftId(shiftId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedShiftId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-16 bg-gray-100 rounded"></div>
                <div className="h-16 bg-gray-100 rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { cashDivergences = [], openShifts = [] } = alertsData || {};

  return (
    <div className="space-y-6">
      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas & Divergências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cashDivergences.length > 0 ? (
              cashDivergences.map((divergence, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex-1">
                      <p className="font-medium">Divergência de Caixa</p>
                      <p className="text-sm">
                        {divergence.user.name} - {new Date(divergence.shift.startTime).toLocaleDateString('pt-BR')} às{" "}
                        {new Date(divergence.shift.startTime).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} - Diferença: R$ {parseFloat(divergence.divergence).toFixed(2)}
                      </p>
                      {divergence.shift.notes && (
                        <p className="text-sm mt-1 text-gray-600 italic">
                          <strong>Observação:</strong> {divergence.shift.notes}
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))
            ) : (
              <div className="text-center text-gray-600 py-4">
                Nenhuma divergência encontrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shift Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Status dos Turnos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {openShifts.length > 0 ? (
              openShifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Turno Ativo</p>
                      <p className="text-sm text-green-600">
                        Iniciado às {new Date(shift.startTime).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleViewShift(shift.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Detalhar
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-600 py-4">
                Nenhum turno ativo
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Turno */}
      {selectedShiftId && (
        <ShiftDetailsModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          shiftId={selectedShiftId}
        />
      )}
    </div>
  );
}
