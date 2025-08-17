import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, User, Clock, Coffee, Edit, Utensils, DropletIcon, Trash2 } from "lucide-react";
import type { Shift, User as UserType, Product, CollaboratorConsumption } from "@shared/schema";

// Schema para adicionar horas ao colaborador
const hoursFormSchema = z.object({
  hoursWorked: z.string().min(1, "Informe as horas trabalhadas"),
});

type HoursFormData = z.infer<typeof hoursFormSchema>;

export default function CollaboratorsEnhanced() {
  const { toast } = useToast();
  const [isConsumptionDialogOpen, setIsConsumptionDialogOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productQuantity, setProductQuantity] = useState<number>(1);

  const hoursForm = useForm<HoursFormData>({
    resolver: zodResolver(hoursFormSchema),
    defaultValues: {
      hoursWorked: "0.00",
    }
  });

  const { data: currentShift } = useQuery<Shift>({
    queryKey: ["/api/shifts/current"],
  });

  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: !!currentShift,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!currentShift,
  });

  // Buscar colaboradores do turno
  const { data: shiftCollaborators } = useQuery({
    queryKey: [`/api/shifts/${currentShift?.id}/collaborators`],
    enabled: !!currentShift?.id,
  });

  // Buscar consumos de um colaborador específico
  const { data: collaboratorConsumptions, refetch: refetchConsumptions } = useQuery<CollaboratorConsumption[]>({
    queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumptions/${selectedCollaborator?.userId}`],
    enabled: !!currentShift?.id && !!selectedCollaborator?.userId,
    staleTime: 0,
    gcTime: 0,
  });

  // Mutation para adicionar colaborador ao turno
  const addCollaboratorMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/shifts/${currentShift?.id}/collaborators`, { userId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shifts/${currentShift?.id}/collaborators`] });
      toast({ title: "Colaborador adicionado ao turno!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao adicionar colaborador", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  // Mutation para remover colaborador do turno
  const removeCollaboratorMutation = useMutation({
    mutationFn: async (collaboratorId: number) => {
      const res = await apiRequest("DELETE", `/api/shifts/${currentShift?.id}/collaborators/${collaboratorId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shifts/${currentShift?.id}/collaborators`] });
      toast({ title: "Colaborador removido do turno!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao remover colaborador", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  // Mutation para atualizar horas trabalhadas
  const updateHoursMutation = useMutation({
    mutationFn: async ({ collaboratorRecordId, hours }: { collaboratorRecordId: number; hours: string }) => {
      const res = await apiRequest("PUT", `/api/shifts/${currentShift?.id}/collaborators/${collaboratorRecordId}`, { 
        hoursWorked: hours 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shifts/${currentShift?.id}/collaborators`] });
      const hours = hoursForm.getValues("hoursWorked");
      toast({ 
        title: "Horas atualizadas!", 
        description: `${selectedCollaborator?.user?.name}: ${hours} horas trabalhadas` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar horas", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  // Mutation para adicionar item de consumo
  const addConsumptionItemMutation = useMutation({
    mutationFn: async (data: { collaboratorUserId: number; productId: number; quantity: number }) => {
      const res = await apiRequest("POST", `/api/shifts/${currentShift?.id}/collaborator-consumptions`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumptions/${selectedCollaborator?.userId}`] 
      });
      const productName = products?.find(p => p.id === parseInt(selectedProductId))?.name || "Produto";
      toast({ 
        title: "Item adicionado!", 
        description: `${productName} (${productQuantity}x) adicionado ao consumo` 
      });
      setSelectedProductId("");
      setProductQuantity(1);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao adicionar item", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  // Mutation para remover item de consumo
  const removeConsumptionItemMutation = useMutation({
    mutationFn: async (consumptionId: number) => {
      const res = await apiRequest("DELETE", `/api/shifts/${currentShift?.id}/collaborator-consumptions/${consumptionId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumptions/${selectedCollaborator?.userId}`] 
      });
      toast({ title: "Item removido do consumo!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao remover item", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const openConsumptionDialog = (collaborator: any) => {
    console.log("Opening consumption dialog for collaborator:", collaborator);
    setSelectedCollaborator(collaborator);
    setIsConsumptionDialogOpen(true);
    
    // Buscar dados de horas do colaborador
    if (collaborator) {
      hoursForm.setValue("hoursWorked", collaborator.hoursWorked || "0.00");
    }
    
    // Force refetch consumptions after a small delay to ensure state is updated
    setTimeout(() => {
      refetchConsumptions();
    }, 100);
  };

  const handleAddProduct = () => {
    if (!selectedProductId || productQuantity <= 0 || !selectedCollaborator) {
      toast({ title: "Selecione um produto e informe a quantidade", variant: "destructive" });
      return;
    }

    addConsumptionItemMutation.mutate({
      collaboratorUserId: selectedCollaborator.userId,
      productId: parseInt(selectedProductId),
      quantity: productQuantity
    });
  };

  const handleUpdateHours = (data: HoursFormData) => {
    if (!selectedCollaborator) return;
    
    updateHoursMutation.mutate({
      collaboratorRecordId: selectedCollaborator.id, // ID do registro shift_collaborators
      hours: data.hoursWorked
    });
  };

  // Calcular totais do consumo
  const calculateConsumptionTotals = () => {
    if (!collaboratorConsumptions || !products) {
      return { beveragesTotal: 0, pastriesTotal: 0, waterQuantity: 0 };
    }

    let beveragesTotal = 0;
    let pastriesTotal = 0;
    let waterQuantity = 0;

    collaboratorConsumptions.forEach((consumption) => {
      const product = products.find(p => p.id === consumption.productId);
      
      if (product) {
        const price = parseFloat(consumption.priceSnapshot);
        const total = price * consumption.quantity;
        
        if (product.name.toLowerCase().includes('água')) {
          waterQuantity += consumption.quantity;
        } else if (product.category === 'Bebidas') {
          beveragesTotal += total;
        } else if (product.category?.includes('Pastéis')) {
          pastriesTotal += total;
        }
      }
    });

    return { beveragesTotal, pastriesTotal, waterQuantity };
  };

  const collaborators = allUsers?.filter(u => u.role === 'employee' && u.id !== currentShift?.userId) || [];
  const activeCollaborators = Array.isArray(shiftCollaborators) ? shiftCollaborators : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Gerenciar Colaboradores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!currentShift ? (
            <p className="text-muted-foreground">Você precisa abrir um turno para gerenciar colaboradores.</p>
          ) : (
            <div className="space-y-4">
              {/* Adicionar Colaborador */}
              <div className="flex gap-2">
                <Select onValueChange={(value) => addCollaboratorMutation.mutate(parseInt(value))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um colaborador para adicionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {collaborators
                      .filter(u => !activeCollaborators.some((c: any) => c.userId === u.id))
                      .map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lista de Colaboradores Ativos */}
              <div className="space-y-2">
                {activeCollaborators.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum colaborador no turno.</p>
                ) : (
                  activeCollaborators.map((collaborator: any) => {
                    const user = allUsers?.find(u => u.id === collaborator.userId);
                    return (
                      <div key={collaborator.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{user?.name}</span>
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {collaborator.hoursWorked || "0.00"} horas
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openConsumptionDialog(collaborator)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Consumo
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeCollaboratorMutation.mutate(collaborator.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Consumo Detalhado */}
      <Dialog open={isConsumptionDialogOpen} onOpenChange={setIsConsumptionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Consumo do Colaborador</DialogTitle>
            <DialogDescription>
              Colaborador: {selectedCollaborator?.user?.name || "..."}<br/>
              Registre as horas trabalhadas e os produtos consumidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Horas Trabalhadas */}
            <Form {...hoursForm}>
              <form onSubmit={hoursForm.handleSubmit(handleUpdateHours)} className="space-y-4">
                <FormField
                  control={hoursForm.control}
                  name="hoursWorked"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas Trabalhadas</FormLabel>
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
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={updateHoursMutation.isPending}
                >
                  {updateHoursMutation.isPending ? "Salvando..." : "Salvar Horas"}
                </Button>
              </form>
            </Form>

            {/* Totais Calculados (Apenas Visualização) */}
            {(() => {
              const totals = calculateConsumptionTotals();
              const totalValue = totals.beveragesTotal + totals.pastriesTotal;
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 border rounded-lg">
                      <Label className="text-xs text-muted-foreground">Bebidas</Label>
                      <p className="text-lg font-semibold">R$ {totals.beveragesTotal.toFixed(2)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <Label className="text-xs text-muted-foreground">Pastéis</Label>
                      <p className="text-lg font-semibold">R$ {totals.pastriesTotal.toFixed(2)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <Label className="text-xs text-muted-foreground">Águas</Label>
                      <p className="text-lg font-semibold">{totals.waterQuantity} un</p>
                    </div>
                  </div>
                  <div className="p-3 border-2 border-primary rounded-lg bg-primary/5">
                    <Label className="text-sm font-medium">Total do Consumo</Label>
                    <p className="text-xl font-bold text-primary">R$ {totalValue.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      Valor integral registrado (desconto aplicado apenas no relatório semanal)
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Adicionar Produto ao Consumo */}
            <div className="space-y-2">
              <Label>Adicionar Produto ao Consumo</Label>
              <div className="flex gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map(product => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} - {product.category} - R$ {product.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={productQuantity}
                  onChange={(e) => setProductQuantity(parseInt(e.target.value) || 1)}
                  className="w-20"
                  placeholder="Qtd"
                />
                <Button 
                  onClick={handleAddProduct} 
                  size="icon"
                  disabled={addConsumptionItemMutation.isPending}
                >
                  {addConsumptionItemMutation.isPending ? "..." : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Lista de Produtos Consumidos */}
            <div className="space-y-2">
              <Label>Produtos Consumidos</Label>
              {!collaboratorConsumptions ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Carregando produtos consumidos...
                </div>
              ) : collaboratorConsumptions.length > 0 ? (
                <div className="space-y-1">
                  {collaboratorConsumptions.map((consumption) => {
                    const product = products?.find(p => p.id === consumption.productId);
                    return (
                      <div key={consumption.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {product?.category === 'Bebidas' ? (
                            <Coffee className="h-4 w-4 text-muted-foreground" />
                          ) : product?.category === 'Pastéis' ? (
                            <Utensils className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <DropletIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">
                            {product?.name} - {consumption.quantity}x R$ {consumption.priceSnapshot}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeConsumptionItemMutation.mutate(consumption.id)}
                          disabled={removeConsumptionItemMutation.isPending}
                        >
                          {removeConsumptionItemMutation.isPending ? 
                            "..." : 
                            <Trash2 className="h-4 w-4 text-destructive" />
                          }
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum produto consumido ainda.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsumptionDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}