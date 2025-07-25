import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { User, Users, Plus, Edit, Trash2, LogOut, Utensils } from "lucide-react";
import { ROLES, TRANSPORT_TYPES } from "@/lib/constants";
import type { User as UserType, TransportMode } from "@shared/schema";
import MobileNav from "@/components/navigation/mobile-nav";
import { formatCurrency } from "@/lib/calculations";

export default function UserManagement() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedTransportModeId, setSelectedTransportModeId] = useState<number | null>(null);

  if (user?.role !== 'admin') {
    return <Redirect to="/" />;
  }

  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: transportModes = [] } = useQuery<TransportMode[]>({
    queryKey: ["/api/admin/transport"],
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserType> }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDialogOpen(false);
      setEditingUser(null);
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar usuário",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; password: string; role: string; transportType?: string; transportModeId?: number | null }) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar usuário",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao excluir usuário",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (user: UserType) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedTransportModeId(user.transportModeId || null);
    setIsDialogOpen(true);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    const formData = new FormData(e.currentTarget);
    const updatedData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: selectedRole,
      transportModeId: selectedTransportModeId,
    };

    updateUserMutation.mutate({ id: editingUser.id, data: updatedData });
  };

  const handleDelete = (id: number) => {
    if (id === user?.id) {
      toast({
        title: "Erro",
        description: "Você não pode excluir sua própria conta",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm("Tem certeza que deseja excluir este usuário?")) {
      deleteUserMutation.mutate(id);
    }
  };

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      role: selectedRole,
      transportModeId: selectedTransportModeId,
    };

    createUserMutation.mutate(userData);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
  };

  const getTransportModeName = (transportModeId?: number | null) => {
    if (!transportModeId) return null;
    const mode = transportModes.find(m => m.id === transportModeId);
    return mode ? `${mode.name} - ${formatCurrency(parseFloat(mode.roundTripPrice))}` : null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Utensils className="h-8 w-8 text-orange-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
                <p className="text-gray-600">Administrar funcionários do sistema</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                onClick={() => {
                  setSelectedRole("");
                  setSelectedTransportModeId(null);
                  setIsCreateDialogOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Usuário
              </Button>
              <Button variant="outline" onClick={handleLogout} className="hidden sm:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-600" />
            <span className="text-lg font-medium text-gray-900">
              {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="grid gap-6">
          {users.map((userData) => (
            <Card key={userData.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-100 rounded-full">
                      <User className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{userData.name}</h3>
                      <p className="text-gray-600">{userData.email}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge className={getRoleBadgeColor(userData.role)}>
                          {userData.role === 'admin' ? 'Administrador' : 'Funcionário'}
                        </Badge>
                        {userData.transportType && (
                          <Badge variant="outline">
                            {userData.transportType}
                          </Badge>
                        )}
                        {getTransportModeName(userData.transportModeId) && (
                          <Badge variant="secondary">
                            {getTransportModeName(userData.transportModeId)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(userData)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(userData.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {users.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum usuário encontrado</h3>
              <p className="text-gray-600">Não há usuários cadastrados no sistema.</p>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha as informações do novo usuário e clique em criar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <Label htmlFor="create-name">Nome</Label>
              <Input
                id="create-name"
                name="name"
                required
                placeholder="Digite o nome completo"
              />
            </div>
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
                placeholder="Digite o email"
              />
            </div>
            <div>
              <Label htmlFor="create-password">Senha</Label>
              <Input
                id="create-password"
                name="password"
                type="password"
                required
                placeholder="Digite a senha"
              />
            </div>
            <div>
              <Label htmlFor="create-role">Papel</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-transportMode">Meio de Transporte</Label>
              <Select 
                value={selectedTransportModeId?.toString() || "0"} 
                onValueChange={(value) => setSelectedTransportModeId(value && value !== "0" ? parseInt(value) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o meio de transporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nenhum</SelectItem>
                  {transportModes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id.toString()}>
                      {mode.name} - {formatCurrency(parseFloat(mode.roundTripPrice))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário e clique em salvar.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingUser.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={editingUser.email}
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Papel</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
              </div>
              <div>
                <Label htmlFor="transportMode">Meio de Transporte</Label>
                <Select 
                  value={selectedTransportModeId?.toString() || "0"} 
                  onValueChange={(value) => setSelectedTransportModeId(value && value !== "0" ? parseInt(value) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o meio de transporte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nenhum</SelectItem>
                    {transportModes.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id.toString()}>
                        {mode.name} - {formatCurrency(parseFloat(mode.roundTripPrice))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <MobileNav currentPath="/admin/users" />
      
      {/* Mobile bottom padding to prevent content overlap */}
      <div className="xl:hidden h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}></div>
    </div>
  );
}