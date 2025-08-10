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
  
  const [editingCash, setEditingCash] = useState<{
    field: 'initialCash' | 'initialCoins';
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

  const updateInitialCashMutation = useMutation({
    mutationFn: async (data: { 
      shiftId: number; 
      initialCash?: string; 
      initialCoins?: string 
    }) => {
      const res = await api.put(`/api/admin/shifts/${data.shiftId}/initial-cash`, data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-active-shifts'] });
      toast({ title: "Caixa inicial atualizado com sucesso!" });
      setEditingCash(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar caixa inicial", 
        description: error.message,
        variant: "destructive" 
      });
    }
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

  const handleSaveCash = () => {
    if (!editingCash) return;
    
    const cleanValue = editingCash.value.replace(',', '.');
    const numValue = parseFloat(cleanValue);
    
    if (isNaN(numValue) || numValue < 0) {
      toast({ 
        title: "Valor inválido", 
        description: "Digite um valor válido maior ou igual a zero.",
        variant: "destructive" 
      });
      return;
    }
    
    const payload: { shiftId: number; initialCash?: string; initialCoins?: string } = {
      shiftId: shift.id,
      [editingCash.field]: String(numValue)
    };
    
    updateInitialCashMutation.mutate(payload);
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

          {/* Seção Estado do Caixa */}
          <div className="space-y-2">
            <h4 className="font-medium">Estado do Caixa</h4>
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Dinheiro Inicial</p>
                {editingCash?.field === 'initialCash' ? (
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={editingCash.value}
                      onChange={(e) => setEditingCash({
                        ...editingCash,
                        value: e.target.value
                      })}
                      className="h-8 w-24"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={handleSaveCash}
                      disabled={updateInitialCashMutation.isPending}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingCash(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      R$ {parseFloat(shift.initialCash ?? '0').toFixed(2)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditingCash({
                        field: 'initialCash',
                        value: shift.initialCash ?? '0'
                      })}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Moedas Iniciais</p>
                {editingCash?.field === 'initialCoins' ? (
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={editingCash.value}
                      onChange={(e) => setEditingCash({
                        ...editingCash,
                        value: e.target.value
                      })}
                      className="h-8 w-24"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={handleSaveCash}
                      disabled={updateInitialCashMutation.isPending}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingCash(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      R$ {parseFloat(shift.initialCoins ?? '0').toFixed(2)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditingCash({
                        field: 'initialCoins',
                        value: shift.initialCoins ?? '0'
                      })}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <p>Carregando registros...</p>
          ) : (
            <div className="space-y-2">
              <h4 className="font-medium">Registros de Produtos</h4>
              <div className="border rounded-lg">
                <div className="grid grid-cols-7 gap-2 p-2 bg-muted text-sm font-medium">
                  <div>Produto</div>
                  <div>Entrada</div>
                  <div>Chegada</div>
                  <div>Sobra</div>
                  <div>Descarte</div>
                  <div>Consumo</div>
                  <div>Vendido</div>
                </div>
                
                {products?.map((product) => {
                  const hasRecord = shiftRecords?.some(r => r.productId === product.id);
                  if (!hasRecord) return null;

                  // Calcular vendido
                  const entryQty = getRecordValue(product.id, 'entryQty');
                  const arrivalQty = getRecordValue(product.id, 'arrivalQty');
                  const leftoverQty = getRecordValue(product.id, 'leftoverQty');
                  const discardQty = getRecordValue(product.id, 'discardQty');
                  const consumedQty = getRecordValue(product.id, 'consumedQty');
                  const soldQty = entryQty + arrivalQty - leftoverQty - discardQty - consumedQty;

                  return (
                    <div key={product.id} className="grid grid-cols-7 gap-2 p-2 border-t">
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
                              className="h-8 text-xs w-16"
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
                            <span className="text-sm">{entryQty}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingRecord({
                                productId: product.id,
                                field: 'entryQty',
                                value: String(entryQty)
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Chegada */}
                      <div>
                        {editingRecord?.productId === product.id && editingRecord.field === 'arrivalQty' ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editingRecord.value}
                              onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                value: e.target.value
                              })}
                              className="h-8 text-xs w-16"
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
                            <span className="text-sm">{arrivalQty}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingRecord({
                                productId: product.id,
                                field: 'arrivalQty',
                                value: String(arrivalQty)
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Sobra */}
                      <div>
                        {editingRecord?.productId === product.id && editingRecord.field === 'leftoverQty' ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editingRecord.value}
                              onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                value: e.target.value
                              })}
                              className="h-8 text-xs w-16"
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
                            <span className="text-sm">{leftoverQty}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingRecord({
                                productId: product.id,
                                field: 'leftoverQty',
                                value: String(leftoverQty)
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Descarte */}
                      <div>
                        {editingRecord?.productId === product.id && editingRecord.field === 'discardQty' ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editingRecord.value}
                              onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                value: e.target.value
                              })}
                              className="h-8 text-xs w-16"
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
                            <span className="text-sm">{discardQty}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingRecord({
                                productId: product.id,
                                field: 'discardQty',
                                value: String(discardQty)
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Consumo */}
                      <div>
                        {editingRecord?.productId === product.id && editingRecord.field === 'consumedQty' ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editingRecord.value}
                              onChange={(e) => setEditingRecord({
                                ...editingRecord,
                                value: e.target.value
                              })}
                              className="h-8 text-xs w-16"
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
                            <span className="text-sm">{consumedQty}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingRecord({
                                productId: product.id,
                                field: 'consumedQty',
                                value: String(consumedQty)
                              })}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Vendido - Campo apenas de leitura (calculado) */}
                      <div className="text-sm font-medium">{soldQty}</div>
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