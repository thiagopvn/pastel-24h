import { useState, useEffect } from "react";
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

const consumptionFormSchema = z.object({
  collaboratorId: z.number().min(1, "Selecione um colaborador"),
  hoursWorked: z.number().min(0, "Horas trabalhadas deve ser um número positivo"),
  beveragesValue: z.number().min(0, "Valor de bebidas deve ser um número positivo"),
  pastriesValue: z.number().min(0, "Valor de pastéis deve ser um número positivo"),
  waterQuantity: z.number().int().min(0, "Quantidade de águas deve ser um número inteiro positivo"),
  consumedProducts: z.array(z.object({
    productId: z.number().int().positive("ID do produto deve ser um número inteiro positivo"),
    name: z.string().min(1, "Nome do produto é obrigatório"),
    quantity: z.number().int().positive("Quantidade deve ser um número inteiro positivo"),
    price: z.string().min(1, "Preço é obrigatório"),
  })).default([]),
});

type ConsumptionFormData = z.infer<typeof consumptionFormSchema>;

export default function CollaboratorsEnhanced() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedConsumption, setSelectedConsumption] = useState<CollaboratorConsumption | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productQuantity, setProductQuantity] = useState<number>(1);

  const form = useForm<ConsumptionFormData>({
    resolver: zodResolver(consumptionFormSchema),
    defaultValues: {
      collaboratorId: 0,
      hoursWorked: 0,
      beveragesValue: 0,
      pastriesValue: 0,
      waterQuantity: 0,
      consumedProducts: []
    }
  });

  const editForm = useForm<ConsumptionFormData>({
    resolver: zodResolver(consumptionFormSchema),
    defaultValues: {
      collaboratorId: 0,
      hoursWorked: 0,
      beveragesValue: 0,
      pastriesValue: 0,
      waterQuantity: 0,
      consumedProducts: []
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

  const { data: consumptions, refetch: refetchConsumptions } = useQuery<CollaboratorConsumption[]>({
    queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumption`],
    enabled: !!currentShift?.id,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: false, // Desabilitar refetch automático
    refetchOnWindowFocus: false, // Desabilitar refetch ao focar a janela
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/shifts/${currentShift?.id}/collaborator-consumption`);
      const data = await response.json();
      console.log(`[QUERY] Fetched consumptions for shift ${currentShift?.id}:`, data);
      return data;
    }
  });

  const createConsumptionMutation = useMutation({
    mutationFn: async (data: ConsumptionFormData) => {
      const res = await apiRequest("POST", `/api/shifts/${currentShift?.id}/collaborator-consumption`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumption`] });
      toast({ title: "Consumo de colaborador adicionado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
      setSelectedProductId("");
      setProductQuantity(1);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao adicionar consumo", 
        description: error?.message || "Verifique os dados e tente novamente",
        variant: "destructive" 
      });
    },
  });

  const updateConsumptionMutation = useMutation({
    mutationFn: async (data: { id: number; updates: ConsumptionFormData }) => {
      const res = await apiRequest("PUT", `/api/shifts/${currentShift?.id}/collaborator-consumption/${data.id}`, data.updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumption`] });
      toast({ title: "Consumo atualizado com sucesso!" });
      setIsEditDialogOpen(false);
      setSelectedConsumption(null);
      editForm.reset();
      setSelectedProductId("");
      setProductQuantity(1);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar consumo", 
        description: error?.message || "Verifique os dados e tente novamente",
        variant: "destructive" 
      });
    },
  });

  const deleteConsumptionMutation = useMutation({
    mutationFn: async (consumptionId: number) => {
      console.log(`[DELETE] Deleting consumption ${consumptionId} from shift ${currentShift?.id}`);
      const res = await apiRequest("DELETE", `/api/shifts/${currentShift?.id}/collaborator-consumption/${consumptionId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to delete: ${res.status}`);
      }
      return res.json();
    },
    onMutate: async (consumptionId: number) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ 
        queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumption`] 
      });

      // Guardar snapshot dos dados anteriores para rollback
      const previousConsumptions = queryClient.getQueryData<CollaboratorConsumption[]>(
        [`/api/shifts/${currentShift?.id}/collaborator-consumption`]
      );

      // Atualização otimista - remover item imediatamente
      queryClient.setQueryData<CollaboratorConsumption[]>(
        [`/api/shifts/${currentShift?.id}/collaborator-consumption`],
        (old) => old?.filter(c => c.id !== consumptionId) ?? []
      );

      // Retornar contexto para rollback
      return { previousConsumptions };
    },
    onError: (error: any, _consumptionId, context) => {
      console.error("[DELETE] Error:", error);
      
      // Rollback em caso de erro
      if (context?.previousConsumptions) {
        queryClient.setQueryData(
          [`/api/shifts/${currentShift?.id}/collaborator-consumption`],
          context.previousConsumptions
        );
      }
      
      toast({
        title: "Erro ao remover consumo",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    },
    onSettled: async () => {
      console.log(`[DELETE] Settled - refetching data for shift ${currentShift?.id}`);
      
      // Pequeno delay para garantir que o backend processou a exclusão
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Forçar invalidação e refetch
      await queryClient.invalidateQueries({
        queryKey: [`/api/shifts/${currentShift?.id}/collaborator-consumption`],
        exact: true,
      });
      
      // Refetch explícito como backup
      await refetchConsumptions();
    },
    onSuccess: () => {
      console.log(`[DELETE] Success - consumption deleted`);
      toast({ title: "Consumo removido com sucesso!" });
    },
  });

  const addProduct = (formInstance: typeof form | typeof editForm) => {
    if (!selectedProductId || productQuantity <= 0) {
      toast({ title: "Selecione um produto e informe a quantidade", variant: "destructive" });
      return;
    }

    const product = products?.find(p => p.id === parseInt(selectedProductId));
    if (!product) return;

    const currentProducts = formInstance.getValues("consumedProducts");
    
    // Verificar se produto já existe na lista
    const existingIndex = currentProducts.findIndex(p => p.productId === product.id);
    
    if (existingIndex >= 0) {
      // Se já existe, somar a quantidade
      const updatedProducts = [...currentProducts];
      updatedProducts[existingIndex].quantity += productQuantity;
      formInstance.setValue("consumedProducts", updatedProducts);
    } else {
      // Se não existe, adicionar novo
      const newProduct = {
        productId: product.id,
        name: product.name,
        quantity: productQuantity,
        price: product.price
      };
      formInstance.setValue("consumedProducts", [...currentProducts, newProduct]);
    }

    setSelectedProductId("");
    setProductQuantity(1);
  };

  const removeProduct = (productId: number, formInstance: typeof form | typeof editForm) => {
    const currentProducts = formInstance.getValues("consumedProducts");
    const updatedProducts = currentProducts.filter(p => p.productId !== productId);
    formInstance.setValue("consumedProducts", updatedProducts);
  };

  const handleSubmit = (data: ConsumptionFormData) => {
    createConsumptionMutation.mutate(data);
  };

  const handleEdit = (consumption: CollaboratorConsumption) => {
    setSelectedConsumption(consumption);
    
    // Parse consumed products if needed
    let consumedProducts = [];
    try {
      if (typeof consumption.consumedProducts === 'string') {
        consumedProducts = JSON.parse(consumption.consumedProducts);
      } else if (Array.isArray(consumption.consumedProducts)) {
        consumedProducts = consumption.consumedProducts;
      }
    } catch (error) {
      console.error('Error parsing consumed products:', error);
      consumedProducts = [];
    }
    
    // Set form values with parsed data
    editForm.reset({
      collaboratorId: consumption.collaboratorId,
      hoursWorked: consumption.hoursWorked,
      beveragesValue: parseFloat(consumption.beveragesValue.toString()) || 0,
      pastriesValue: parseFloat(consumption.pastriesValue.toString()) || 0,
      waterQuantity: consumption.waterQuantity || 0,
      consumedProducts: consumedProducts
    });
    
    // Reset product selection state
    setSelectedProductId("");
    setProductQuantity(1);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (data: ConsumptionFormData) => {
    if (!selectedConsumption) return;

    // Ensure numeric values are properly formatted
    const formattedData = {
      ...data,
      hoursWorked: Number(data.hoursWorked),
      beveragesValue: Number(data.beveragesValue),
      pastriesValue: Number(data.pastriesValue),
      waterQuantity: Math.floor(Number(data.waterQuantity)),
      consumedProducts: data.consumedProducts || []
    };

    updateConsumptionMutation.mutate({
      id: selectedConsumption.id,
      updates: formattedData
    });
  };

  const calculateDiscount = (beveragesValue: number, pastriesValue: number) => {
    return (beveragesValue + pastriesValue) * 0.5;
  };

  // Calculate totals from consumed products
  const calculateProductTotals = (consumedProducts: any[], allProducts: Product[]) => {
    let beveragesTotal = 0;
    let pastriesTotal = 0;

    consumedProducts.forEach(consumedProduct => {
      const product = allProducts.find(p => p.id === consumedProduct.productId);
      if (product) {
        const productTotal = parseFloat(product.price) * consumedProduct.quantity;
        
        // Categorize based on product category and name
        const categoryLower = product.category.toLowerCase();
        const nameLower = product.name.toLowerCase();
        
        // Check if it's water (água) - water is free, not included in beverages value
        const isWater = categoryLower.includes('água') || nameLower.includes('água');
        
        // Check if it's a beverage (excluding water)
        const isBeverage = 
          !isWater && ( // Exclude water from beverages
            categoryLower.includes('bebida') || 
            categoryLower.includes('refrigerante') ||
            categoryLower.includes('suco') ||
            categoryLower.includes('cafe') ||
            categoryLower.includes('café') ||
            nameLower.includes('coca') ||
            nameLower.includes('guaraná') ||
            nameLower.includes('fanta') ||
            nameLower.includes('sprite')
          );
        
        // Only add to totals if not water (water is free)
        if (!isWater) {
          if (isBeverage) {
            beveragesTotal += productTotal;
          } else {
            pastriesTotal += productTotal;
          }
        }
      }
    });

    return { beveragesTotal, pastriesTotal };
  };

  // Auto-sync form values when consumed products change
  useEffect(() => {
    if (!products) return;

    const consumedProducts = form.watch("consumedProducts");
    const { beveragesTotal, pastriesTotal } = calculateProductTotals(consumedProducts, products);
    
    // Only update if there are consumed products to avoid overriding manual input
    if (consumedProducts.length > 0) {
      form.setValue("beveragesValue", beveragesTotal);
      form.setValue("pastriesValue", pastriesTotal);
    }
  }, [form.watch("consumedProducts"), products, form]);

  // Auto-sync edit form values when consumed products change
  useEffect(() => {
    if (!products) return;

    const consumedProducts = editForm.watch("consumedProducts");
    const { beveragesTotal, pastriesTotal } = calculateProductTotals(consumedProducts, products);
    
    // Only update if there are consumed products to avoid overriding manual input
    if (consumedProducts.length > 0) {
      editForm.setValue("beveragesValue", beveragesTotal);
      editForm.setValue("pastriesValue", pastriesTotal);
    }
  }, [editForm.watch("consumedProducts"), products, editForm]);

  // Filter out users who are already added as collaborators
  const availableUsers = allUsers?.filter(user => 
    !consumptions?.some(consumption => consumption.collaboratorId === user.id)
  ) || [];

  if (!currentShift) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-gray-600">
            Abra um turno para gerenciar colaboradores
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          Consumo de Colaboradores
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Consumo de Colaborador</DialogTitle>
              <DialogDescription>
                Registre as horas trabalhadas e os produtos consumidos pelo colaborador durante o turno.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="collaboratorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colaborador</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um colaborador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hoursWorked"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas Trabalhadas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="beveragesValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Bebidas (R$) {form.watch("consumedProducts").length > 0 && "(Calculado automaticamente)"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          readOnly={form.watch("consumedProducts").length > 0}
                          className={form.watch("consumedProducts").length > 0 ? "bg-gray-100" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pastriesValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Pastéis (R$) {form.watch("consumedProducts").length > 0 && "(Calculado automaticamente)"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          readOnly={form.watch("consumedProducts").length > 0}
                          className={form.watch("consumedProducts").length > 0 ? "bg-gray-100" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="waterQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade de Águas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Seleção de produtos detalhados */}
                <div className="space-y-3">
                  <Label>Produtos Consumidos (Detalhado)</Label>
                  <div className="flex gap-2">
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecionar produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} - R$ {product.price}
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
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => addProduct(form)}
                      disabled={!selectedProductId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Lista de produtos selecionados */}
                  {form.watch("consumedProducts").length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Produtos selecionados:</p>
                      {form.watch("consumedProducts").map((product, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">
                            {product.name} - {product.quantity}x - R$ {product.price}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProduct(product.productId, form)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(form.watch("beveragesValue") > 0 || form.watch("pastriesValue") > 0) && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Desconto (50%): R$ {calculateDiscount(form.watch("beveragesValue"), form.watch("pastriesValue")).toFixed(2)}
                    </p>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createConsumptionMutation.isPending}
                  >
                    {createConsumptionMutation.isPending ? "Adicionando..." : "Adicionar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {!consumptions || consumptions.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhum consumo de colaborador registrado
          </p>
        ) : (
          <div className="space-y-2">
            {consumptions.map((consumption) => {
              const collaborator = allUsers?.find(u => u.id === consumption.collaboratorId);
              const discount = calculateDiscount(consumption.beveragesValue, consumption.pastriesValue);
              
              return (
                <div key={consumption.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{collaborator?.name || "Colaborador não encontrado"}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {consumption.hoursWorked}h
                      </div>
                      {consumption.beveragesValue > 0 && (
                        <div className="flex items-center gap-1">
                          <Coffee className="h-3 w-3" />
                          R$ {consumption.beveragesValue.toFixed(2)}
                        </div>
                      )}
                      {consumption.pastriesValue > 0 && (
                        <div className="flex items-center gap-1">
                          <Utensils className="h-3 w-3" />
                          R$ {consumption.pastriesValue.toFixed(2)}
                        </div>
                      )}
                      {consumption.waterQuantity > 0 && (
                        <div className="flex items-center gap-1">
                          <DropletIcon className="h-3 w-3" />
                          {consumption.waterQuantity}x
                        </div>
                      )}
                      {discount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Desconto: R$ {discount.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(consumption)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteConsumptionMutation.mutate(consumption.id)}
                      disabled={deleteConsumptionMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Consumo de Colaborador</DialogTitle>
            <DialogDescription>
              Atualize as informações de consumo. As alterações no estoque serão ajustadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="hoursWorked"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas Trabalhadas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="beveragesValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de Bebidas (R$) {editForm.watch("consumedProducts").length > 0 && "(Calculado automaticamente)"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        readOnly={editForm.watch("consumedProducts").length > 0}
                        className={editForm.watch("consumedProducts").length > 0 ? "bg-gray-100" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="pastriesValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de Pastéis (R$) {editForm.watch("consumedProducts").length > 0 && "(Calculado automaticamente)"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        readOnly={editForm.watch("consumedProducts").length > 0}
                        className={editForm.watch("consumedProducts").length > 0 ? "bg-gray-100" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="waterQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de Águas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Seleção de produtos detalhados - Edit */}
              <div className="space-y-3">
                <Label>Produtos Consumidos (Detalhado)</Label>
                <div className="flex gap-2">
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} - R$ {product.price}
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
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => addProduct(editForm)}
                    disabled={!selectedProductId}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Lista de produtos selecionados - Edit */}
                {editForm.watch("consumedProducts").length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Produtos selecionados:</p>
                    {editForm.watch("consumedProducts").map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">
                          {product.name} - {product.quantity}x - R$ {product.price}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(product.productId, editForm)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(editForm.watch("beveragesValue") > 0 || editForm.watch("pastriesValue") > 0) && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Desconto (50%): R$ {calculateDiscount(editForm.watch("beveragesValue"), editForm.watch("pastriesValue")).toFixed(2)}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={updateConsumptionMutation.isPending}
                >
                  {updateConsumptionMutation.isPending ? "Atualizando..." : "Atualizar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}