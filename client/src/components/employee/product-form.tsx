import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, AlertTriangle, Lock } from "lucide-react";
import type { Product, Shift, ShiftRecord } from "@shared/schema";
import { CATEGORIES } from "@/lib/constants";
import { calculateSold, calculateTotal } from "@/lib/calculations";

export default function ProductForm() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("Pastéis Comuns");
  const [records, setRecords] = useState<Map<number, Partial<ShiftRecord>>>(new Map());

  const { data: currentShift } = useQuery<Shift>({
    queryKey: ["/api/shifts/current"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: existingRecords } = useQuery<ShiftRecord[]>({
    queryKey: ["/api/shift-records", currentShift?.id],
    enabled: !!currentShift?.id,
  });

  const saveRecordMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await apiRequest("POST", "/api/shift-records", {
        ...record,
        shiftId: currentShift?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-records"] });
      toast({ title: "Registro salvo com sucesso!" });
    },
    onError: (error: any) => {
      console.error("Erro ao salvar registro:", error);
      toast({ title: "Erro ao salvar registro", variant: "destructive" });
    },
  });

  const filteredProducts = products?.filter(p => p.category === activeCategory) || [];

  const updateRecord = (productId: number, field: string, value: number) => {
    // Bloqueia completamente a edição de entryQty
    if (field === 'entryQty') {
      toast({ 
        title: "Campo bloqueado", 
        description: "O campo Entrada não pode ser editado.",
        variant: "destructive" 
      });
      return;
    }

    setRecords(prev => {
      const newRecords = new Map(prev);
      const current = newRecords.get(productId) || {};
      newRecords.set(productId, { ...current, [field]: value, productId });
      return newRecords;
    });
  };

  const getRecord = (productId: number) => {
    const existing = existingRecords?.find(r => r.productId === productId);
    const current = records.get(productId);
    return { ...existing, ...current };
  };

  const handleSave = (productId: number) => {
    const record = getRecord(productId);
    if (record && currentShift) {
      saveRecordMutation.mutate(record);
    }
  };

  if (!currentShift) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-gray-600">
            Abra um turno para registrar produtos
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Controle de Produtos
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Categories Tabs */}
        <div className="flex overflow-x-auto space-x-2 pb-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "outline"}
              size="sm"
              className="flex-shrink-0"
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Product Items */}
        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const record = getRecord(product.id);
            const entryQty = record?.entryQty || 0;
            const arrivalQty = record?.arrivalQty || 0;
            const leftoverQty = record?.leftoverQty || 0;
            const discardQty = record?.discardQty || 0;
            const consumedQty = record?.consumedQty || 0;

            const soldQty = calculateSold(entryQty, arrivalQty, leftoverQty, discardQty, consumedQty);
            const totalSales = calculateTotal(soldQty, parseFloat(product.price));
            const isLowStock = entryQty < (product.minStock || 0);

            return (
              <div key={product.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      R$ {parseFloat(product.price).toFixed(2)}
                    </span>
                    {isLowStock && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        ESTOQUE BAIXO
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      Entrada
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <Lock className="h-3 w-3 mr-1" />
                        Bloqueado
                      </Badge>
                    </Label>
                    <Input
                      type="number"
                      value={entryQty}
                      onChange={(e) => {
                        e.preventDefault();
                        // Não faz nada - campo sempre bloqueado
                      }}
                      className="text-sm bg-blue-50 border-blue-200 cursor-not-allowed text-blue-800 opacity-75"
                      readOnly={true}
                      disabled={true}
                      title="Este campo é somente leitura e não pode ser alterado"
                      tabIndex={-1}
                    />
                    <div className="text-xs text-blue-600 mt-1 flex items-center">
                      <Lock className="w-3 h-3 mr-1" />
                      Campo de entrada é somente leitura
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Chegada</Label>
                    <Input
                      type="number"
                      value={arrivalQty}
                      onChange={(e) => updateRecord(product.id, 'arrivalQty', parseInt(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Sobra</Label>
                    <Input
                      type="number"
                      value={leftoverQty}
                      onChange={(e) => updateRecord(product.id, 'leftoverQty', parseInt(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Descarte</Label>
                    <Input
                      type="number"
                      value={discardQty}
                      onChange={(e) => updateRecord(product.id, 'discardQty', parseInt(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Consumo Interno</Label>
                    <Input
                      type="number"
                      value={consumedQty}
                      onChange={(e) => updateRecord(product.id, 'consumedQty', parseInt(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      Vendidos
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        Auto
                      </Badge>
                    </Label>
                    <Input
                      type="number"
                      value={soldQty}
                      readOnly
                      className="text-sm bg-gray-50 border-gray-200 cursor-not-allowed"
                      title="Calculado automaticamente: (Entrada + Chegada) - Sobra - Descarte - Consumo"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-600">Total Vendas:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-green-600">
                      R$ {totalSales.toFixed(2)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleSave(product.id)}
                      disabled={saveRecordMutation.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}