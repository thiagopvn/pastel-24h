import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Edit, Trash2, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type Product } from "@shared/schema";
import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";
import MobileNav from "@/components/navigation/mobile-nav";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ProductForm = z.infer<typeof insertProductSchema>;

// Product já tem sortOrder como number obrigatório, não precisamos estender
type ProductWithSortOrder = Product;

function SortableProductRow({ product, onEdit, onDelete, deletePending }: {
  product: ProductWithSortOrder;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  deletePending: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell>{product.category}</TableCell>
      <TableCell>R$ {parseFloat(product.price).toFixed(2)}</TableCell>
      <TableCell>{product.minStock}</TableCell>
      <TableCell>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(product)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(product.id)}
            disabled={deletePending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ProductManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (user?.role !== 'admin') {
    return <Redirect to="/" />;
  }

  const { data: products, isLoading } = useQuery<ProductWithSortOrder[]>({
    queryKey: ["/api/products"],
  });

  // Filtrar e ordenar produtos por categoria
  const filteredAndSortedProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = [...products];
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    // Ordenar por sortOrder
    return filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [products, selectedCategory]);

  const form = useForm<ProductForm>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      category: "Pastéis Comuns",
      price: "0",
      minStock: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      const res = await apiRequest("POST", "/api/admin/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto criado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar produto", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductForm }) => {
      const res = await apiRequest("PUT", `/api/admin/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto atualizado com sucesso!" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar produto", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/products/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir produto", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (order: Array<{id: number; sortOrder: number}>) => {
      const res = await apiRequest("PUT", "/api/admin/products/order", order);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Ordem dos produtos atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro ao reordenar produtos", variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredAndSortedProducts.findIndex((p) => p.id === active.id);
      const newIndex = filteredAndSortedProducts.findIndex((p) => p.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedProducts = arrayMove(filteredAndSortedProducts, oldIndex, newIndex);
        
        // Criar nova ordem com sortOrder atualizado
        const newOrder = reorderedProducts.map((product, index) => ({
          id: product.id,
          sortOrder: index
        }));

        // Atualizar localmente primeiro para feedback imediato
        queryClient.setQueryData(["/api/products"], (old: ProductWithSortOrder[] | undefined) => {
          if (!old) return old;
          
          // Atualizar sortOrder de todos os produtos afetados
          return old.map(product => {
            const orderItem = newOrder.find(o => o.id === product.id);
            if (orderItem) {
              return { ...product, sortOrder: orderItem.sortOrder };
            }
            return product;
          });
        });

        // Enviar para o servidor
        reorderMutation.mutate(newOrder);
      }
    }
  };

  const handleSubmit = (data: ProductForm) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      category: product.category,
      price: product.price,
      minStock: product.minStock || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    form.reset();
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestão de Produtos
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleNewProduct}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Produto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingProduct ? "Editar Produto" : "Novo Produto"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        placeholder="Nome do produto"
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="category">Categoria</Label>
                      <Select
                        value={form.watch("category")}
                        onValueChange={(value) => form.setValue("category", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        {...form.register("price")}
                        placeholder="0.00"
                      />
                      {form.formState.errors.price && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.price.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="minStock">Estoque Mínimo</Label>
                      <Input
                        id="minStock"
                        type="number"
                        {...form.register("minStock", { valueAsNumber: true })}
                        placeholder="0"
                      />
                      {form.formState.errors.minStock && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.minStock.message}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                      >
                        {editingProduct ? "Atualizar" : "Criar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando produtos...</div>
            ) : (
              <div className="overflow-x-auto">
                <p className="text-sm text-gray-500 mb-4">
                  Arraste os produtos pela alça para reordenar
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Estoque Mín.</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={filteredAndSortedProducts.map(p => p.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {filteredAndSortedProducts?.map((product) => (
                          <SortableProductRow
                            key={product.id}
                            product={product}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            deletePending={deleteMutation.isPending}
                          />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </DndContext>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileNav currentPath="/admin/products" />
      
      {/* Mobile bottom padding to prevent content overlap */}
      <div className="xl:hidden h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}></div>
    </div>
  );
}