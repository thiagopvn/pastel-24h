import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X, User, Clock, Coffee, Edit } from "lucide-react";
import type { Shift, User as UserType } from "@shared/schema";

interface CollaboratorData {
  id: number;
  name: string;
  hoursWorked?: string;
  internalConsumption?: string;
}

export default function CollaboratorsEnhanced() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCollaborator, setSelectedCollaborator] = useState<CollaboratorData | null>(null);
  const [hoursWorked, setHoursWorked] = useState<string>("0");
  const [internalConsumption, setInternalConsumption] = useState<string>("0");

  const { data: currentShift } = useQuery<Shift>({
    queryKey: ["/api/shifts/current"],
  });

  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: !!currentShift,
  });

  const { data: collaborators } = useQuery<CollaboratorData[]>({
    queryKey: ["/api/shift-collaborators", currentShift?.id],
    enabled: !!currentShift?.id,
  });

  const addCollaboratorMutation = useMutation({
    mutationFn: async (data: { userId: number; hoursWorked: string; internalConsumption: string }) => {
      const res = await apiRequest("POST", "/api/shifts/add-collaborator", {
        shiftId: currentShift?.id,
        userId: data.userId,
        hoursWorked: data.hoursWorked,
        internalConsumption: data.internalConsumption,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators", currentShift?.id] });
      toast({ title: "Colaborador adicionado com sucesso!" });
      setIsDialogOpen(false);
      setSelectedUserId("");
      setHoursWorked("0");
      setInternalConsumption("0");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar colaborador", variant: "destructive" });
    },
  });

  const updateCollaboratorMutation = useMutation({
    mutationFn: async (data: { userId: number; hoursWorked: string; internalConsumption: string }) => {
      const res = await apiRequest("PUT", `/api/shifts/${currentShift?.id}/collaborators/${data.userId}`, {
        hoursWorked: data.hoursWorked,
        internalConsumption: data.internalConsumption,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators", currentShift?.id] });
      toast({ title: "Colaborador atualizado com sucesso!" });
      setIsEditDialogOpen(false);
      setSelectedCollaborator(null);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar colaborador", variant: "destructive" });
    },
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/shifts/${currentShift?.id}/collaborators/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators", currentShift?.id] });
      toast({ title: "Colaborador removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover colaborador", variant: "destructive" });
    },
  });

  const handleAddCollaborator = () => {
    if (selectedUserId) {
      addCollaboratorMutation.mutate({
        userId: parseInt(selectedUserId),
        hoursWorked,
        internalConsumption,
      });
    }
  };

  const handleUpdateCollaborator = () => {
    if (selectedCollaborator) {
      updateCollaboratorMutation.mutate({
        userId: selectedCollaborator.id,
        hoursWorked,
        internalConsumption,
      });
    }
  };

  const handleEditClick = (collaborator: CollaboratorData) => {
    setSelectedCollaborator(collaborator);
    setHoursWorked(collaborator.hoursWorked || "0");
    setInternalConsumption(collaborator.internalConsumption || "0");
    setIsEditDialogOpen(true);
  };

  const handleRemoveCollaborator = (userId: number) => {
    if (confirm("Tem certeza que deseja remover este colaborador?")) {
      removeCollaboratorMutation.mutate(userId);
    }
  };

  // Filter out users who are already collaborators
  const availableUsers = allUsers?.filter(user => 
    !collaborators?.some(collab => collab.id === user.id)
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Colaboradores do Turno
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="collaborator">Funcionário</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="collaborator">
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="hours">Horas Trabalhadas</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  placeholder="Ex: 8.5"
                />
              </div>

              <div>
                <Label htmlFor="consumption">Consumo Interno (R$)</Label>
                <Input
                  id="consumption"
                  type="number"
                  step="0.01"
                  min="0"
                  value={internalConsumption}
                  onChange={(e) => setInternalConsumption(e.target.value)}
                  placeholder="Ex: 25.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddCollaborator}
                disabled={!selectedUserId || addCollaboratorMutation.isPending}
              >
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {collaborators && collaborators.length > 0 ? (
          <div className="space-y-3">
            {collaborators.map((collaborator) => (
              <div key={collaborator.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {collaborator.name}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditClick(collaborator)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveCollaborator(collaborator.id)}
                      disabled={removeCollaboratorMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="h-3 w-3" />
                    <span>{collaborator.hoursWorked || "0"} horas</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Coffee className="h-3 w-3" />
                    <span>R$ {collaborator.internalConsumption || "0.00"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 py-4">
            Nenhum colaborador adicionado
          </div>
        )}
      </CardContent>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Input
                value={selectedCollaborator?.name || ""}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-hours">Horas Trabalhadas</Label>
              <Input
                id="edit-hours"
                type="number"
                step="0.5"
                min="0"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                placeholder="Ex: 8.5"
              />
            </div>

            <div>
              <Label htmlFor="edit-consumption">Consumo Interno (R$)</Label>
              <Input
                id="edit-consumption"
                type="number"
                step="0.01"
                min="0"
                value={internalConsumption}
                onChange={(e) => setInternalConsumption(e.target.value)}
                placeholder="Ex: 25.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateCollaborator}
              disabled={updateCollaboratorMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}