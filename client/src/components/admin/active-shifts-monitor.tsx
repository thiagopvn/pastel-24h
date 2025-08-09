import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Shift, ShiftRecord, Product } from "@shared/schema";

interface ShiftWithUser extends Shift {
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export default function ActiveShiftsMonitor() {
  const { toast } = useToast();
  const [editingRecord, setEditingRecord] = useState<{
    shiftId: number;
    productId: number;
    field: string;
    value: number;
  } | null>(null);

  // Query para turnos ativos com auto-refresh
  const { data: activeShifts, isLoading, error } = useQuery<ShiftWithUser[]>({
    queryKey: ["admin-active-shifts"],
    queryFn: async () => {
      const response = await api.get("/api/admin/active-shifts");
      return response;
    },
    refetchInterval: 10000, // Refetch a cada 10 segundos
    staleTime: 5000, // 5 segundos antes de considerar dados obsoletos
  });

  // Query para produtos
  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await api.get("/api/products");
      return response;
    },
    staleTime: 60000, // Cache products for 1 minute
  });

  // Estados de carregamento e erro
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Turnos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando turnos ativos...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Turnos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Erro ao carregar turnos ativos. Tente novamente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Turnos Ativos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activeShifts || activeShifts.length === 0 ? (
          <p className="text-muted-foreground">Nenhum turno ativo no momento.</p>
        ) : (
          <div className="space-y-4">
            {activeShifts.map((shift) => (
              <div key={shift.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{shift.user?.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Turno iniciado: {new Date(shift.startTime).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="default">Ativo</Badge>
                    <ShiftDetailsDialog shift={shift} products={products} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ShiftDetailsDialogProps {
  shift: ShiftWithUser;
  products?: Product[];
}

function ShiftDetailsDialog({ shift, products }: ShiftDetailsDialogProps) {
  const { toast } = useToast();
  const [editingRecord, setEditingRecord] = useState<{
    productId: number;
    field: string;
    value: string;
  } | null>(null);

  const { data: shiftRecords, isLoading } = useQuery<ShiftRecord[]>({
    queryKey: ["/api/shift-records", shift.id],
    queryFn: async () => {
      const response = await api.get(`/api/shift-records?shiftId=${shift.id}`);
      return response;
    },
    enabled: !!shift.id,
    staleTime: 5000, // 5 seconds
  });

  const updateRecordMutation = useMutation({
    mutationFn: async ({ productId, field, value }: {
      productId: number;
      field: string;
      value: number;
    }) => {
      const existingRecord = shiftRecords?.find(r => r.productId === productId);
      const payload = {
        ...existingRecord,
        productId,
        [field]: value,
        shiftId: shift.id,
      };
      
      const res = await api.post("/api/shift-records", payload);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-records", shift.id] });
      setEditingRecord(null);
      toast({ title: "Registro atualizado com sucesso!" });
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar registro:", error);
      toast({ 
        title: "Erro ao atualizar registro", 
        variant: "destructive" 
      });
    },
  });

  const handleSave = () => {
    if (!editingRecord) return;
    
    const numValue = Number(editingRecord.value);
    if (isNaN(numValue) || numValue < 0) {
      toast({ 
        title: "Valor inválido", 
        description: "Digite um número válido maior ou igual a zero.",
        variant: "destructive" 
      });
      return;
    }

    updateRecordMutation.mutate({
      productId: editingRecord.productId,
      field: editingRecord.field,
      value: numValue
    });
  };

  const getProductName = (productId: number) => {
    return products?.find(p => p.id === productId)?.name || `Produto ${productId}`;
  };

  const getRecordValue = (productId: number, field: string) => {
    const record = shiftRecords?.find(r => r.productId === productId);
    return (record as any)?.[field] || 0;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          Monitorar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Monitoramento do Turno - {shift.user?.name}
          </DialogTitle>
          <DialogDescription>
            Monitore e edite os registros de produtos em tempo real durante o turno ativo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Funcionário</p>
              <p className="font-medium">{shift.user?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Início do Turno</p>
              <p className="font-medium">
                {new Date(shift.startTime).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {isLoading ? (
            <p>Carregando registros...</p>
          ) : (
            <div className="space-y-2">
              <h4 className="font-medium">Registros de Produtos</h4>
              <div className="border rounded-lg">
                <div className="grid grid-cols-6 gap-2 p-2 bg-muted text-sm font-medium">
                  <div>Produto</div>
                  <div>Entrada</div>
                  <div>Saída</div>
                  <div>Falta</div>
                  <div>Vendido</div>
                  <div>Ações</div>
                </div>
                
                {products?.map((product) => {
                  const hasRecord = shiftRecords?.some(r => r.productId === product.id);
                  if (!hasRecord) return null;

                  return (
                    <div key={product.id} className="grid grid-cols-6 gap-2 p-2 border-t">
                      <div className="text-sm">{product.name}</div>
                      
                      {/* Entrada */}
                      <div>
                        {editingRecord?.productId === product.id && editingRecord.field === 'entryQty' ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editingRecord.value}
                              onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                value: e.target.value
                              })}
                              className="h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleSave}
                              disabled={updateRecordMutation.isPending}
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setEditingRecord(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{getRecordValue(product.id, 'entryQty')}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingRecord({
                                productId: product.id,
                                field: 'entryQty',
                                value: String(getRecordValue(product.id, 'entryQty'))
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Saída */}
                      <div>
                        {editingRecord?.productId === product.id && editingRecord.field === 'exitQty' ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editingRecord.value}
                              onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                value: e.target.value
                              })}
                              className="h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleSave}
                              disabled={updateRecordMutation.isPending}
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setEditingRecord(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{getRecordValue(product.id, 'exitQty')}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingRecord({
                                productId: product.id,
                                field: 'exitQty',
                                value: String(getRecordValue(product.id, 'exitQty'))
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Outros campos não editáveis */}
                      <div className="text-sm">{getRecordValue(product.id, 'lossQty')}</div>
                      <div className="text-sm">{getRecordValue(product.id, 'soldQty')}</div>
                      <div></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}