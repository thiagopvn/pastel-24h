import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X, User } from "lucide-react";
import type { Shift, User as UserType } from "@shared/schema";

export default function Collaborators() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: currentShift } = useQuery<Shift>({
    queryKey: ["/api/shifts/current"],
  });

  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!currentShift,
  });

  const { data: collaborators } = useQuery<UserType[]>({
    queryKey: ["/api/shift-collaborators", currentShift?.id],
    enabled: !!currentShift?.id,
  });

  const addCollaboratorMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/shifts/add-collaborator", {
        shiftId: currentShift?.id,
        userId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shift-collaborators", currentShift?.id] });
      toast({ title: "Colaborador adicionado com sucesso!" });
      setIsDialogOpen(false);
      setSelectedUserId("");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar colaborador", variant: "destructive" });
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
      addCollaboratorMutation.mutate(parseInt(selectedUserId));
    }
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
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
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
              <div className="flex gap-2">
                <Button
                  onClick={handleAddCollaborator}
                  disabled={!selectedUserId || addCollaboratorMutation.isPending}
                  className="flex-1"
                >
                  Adicionar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {collaborators && collaborators.length > 0 ? (
          <div className="space-y-2">
            {collaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {collaborator.name}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveCollaborator(collaborator.id)}
                  disabled={removeCollaboratorMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 py-4">
            Nenhum colaborador adicionado
          </div>
        )}
      </CardContent>
    </Card>
  );
}
