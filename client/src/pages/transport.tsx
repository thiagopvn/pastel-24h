import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Bus, Plus, Edit, Trash2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TransportMode } from "@shared/schema";
import MobileNav from "@/components/navigation/mobile-nav";
import { formatCurrency } from "@/lib/calculations";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const transportSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  roundTripPrice: z.string().refine(val => parseFloat(val) > 0, "Preço deve ser maior que zero"),
});

type TransportForm = z.infer<typeof transportSchema>;

/**
 * Transport Management Page
 * CRUD interface for managing transport modes and pricing
 */
export default function TransportManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransport, setEditingTransport] = useState<TransportMode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (user?.role !== 'admin') {
    return <Redirect to="/" />;
  }

  // Fetch transport modes
  const { data: transportModes = [], isLoading } = useQuery<TransportMode[]>({
    queryKey: ["/api/admin/transport"],
  });

  // Filter transport modes based on search
  const filteredTransports = transportModes.filter(transport =>
    transport.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredTransports.length / itemsPerPage);
  const paginatedTransports = filteredTransports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const form = useForm<TransportForm>({
    resolver: zodResolver(transportSchema),
    defaultValues: {
      name: "",
      roundTripPrice: "0",
    },
  });

  /**
   * Create transport mutation
   */
  const createMutation = useMutation({
    mutationFn: async (data: TransportForm) => {
      const res = await apiRequest("POST", "/api/admin/transport", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transport"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/weekly-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Transporte criado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar transporte", 
        description: error.message || "Nome já existe",
        variant: "destructive" 
      });
    },
  });

  /**
   * Update transport mutation
   */
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TransportForm }) => {
      const res = await apiRequest("PUT", `/api/admin/transport/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transport"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/weekly-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Transporte atualizado com sucesso!" });
      setIsDialogOpen(false);
      setEditingTransport(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar transporte", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  /**
   * Delete transport mutation
   */
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/transport/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transport"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Transporte excluído com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao excluir transporte", 
        description: error.message || "Transporte em uso",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (data: TransportForm) => {
    if (editingTransport) {
      updateMutation.mutate({ id: editingTransport.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (transport: TransportMode) => {
    setEditingTransport(transport);
    form.reset({
      name: transport.name,
      roundTripPrice: transport.roundTripPrice,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este transporte?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleNew = () => {
    setEditingTransport(null);
    form.reset();
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Bus className="h-5 w-5" />
                Gestão de Transportes
              </CardTitle>
              <Button onClick={handleNew}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Transporte
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar transporte..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center py-8">Carregando transportes...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Preço (ida/volta)</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransports.map((transport) => (
                        <TableRow key={transport.id}>
                          <TableCell className="font-medium">{transport.name}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(transport.roundTripPrice))}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(transport)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(transport.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {[...Array(totalPages)].map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => setCurrentPage(i + 1)}
                              isActive={currentPage === i + 1}
                              className="cursor-pointer"
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}

                {paginatedTransports.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm ? "Nenhum transporte encontrado" : "Nenhum transporte cadastrado"}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTransport ? "Editar Transporte" : "Novo Transporte"}
              </DialogTitle>
              <DialogDescription>
                {editingTransport 
                  ? "Altere as informações do transporte" 
                  : "Preencha os dados do novo meio de transporte"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Ex: Ônibus, Van, Uber"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="roundTripPrice">Preço (ida/volta)</Label>
                <Input
                  id="roundTripPrice"
                  type="number"
                  step="0.01"
                  {...form.register("roundTripPrice")}
                  placeholder="0.00"
                />
                {form.formState.errors.roundTripPrice && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.roundTripPrice.message}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending 
                    ? "Salvando..." 
                    : editingTransport ? "Atualizar" : "Criar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <MobileNav currentPath="/admin/transport" />
      
      {/* Mobile bottom padding to prevent content overlap */}
      <div className="xl:hidden h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}></div>
    </div>
  );
}