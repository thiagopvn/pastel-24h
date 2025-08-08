import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Edit, RotateCcw, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CorrectionFormData {
  correctionType: "product_qty" | "payment" | "cash_count";
  shiftRecordId?: number;
  productId?: number;
  fieldName?: string;
  paymentMethod?: string;
  cashType?: string;
  originalValue: string;
  correctedValue: string;
  reason: string;
  evidenceUrl?: string;
}

export default function ShiftCorrections() {
  const { user } = useAuth();
  const { shiftId } = useParams();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [correctionType, setCorrectionType] = useState<"product" | "payment" | "cash" | null>(null);
  const [formData, setFormData] = useState<CorrectionFormData>({
    correctionType: "product_qty",
    originalValue: "",
    correctedValue: "",
    reason: ""
  });
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<number | null>(null);

  if (user?.role !== 'admin') {
    return <Redirect to="/" />;
  }

  const { data: shiftDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: [`/api/admin/shift-details/${shiftId}`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/shift-details/${shiftId}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch shift details");
      return res.json();
    }
  });

  const { data: corrections = [] } = useQuery({
    queryKey: [`/api/admin/shifts/${shiftId}/corrections`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/shifts/${shiftId}/corrections`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch corrections");
      return res.json();
    }
  });

  const createCorrectionMutation = useMutation({
    mutationFn: async (data: CorrectionFormData) => {
      const res = await fetch(`/api/admin/shifts/${shiftId}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create correction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/shift-details/${shiftId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/shifts/${shiftId}/corrections`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timeline"] });
      toast({ title: "Correção aplicada com sucesso!" });
      setIsDialogOpen(false);
      setSelectedItem(null);
      setFormData({
        correctionType: "product_qty",
        originalValue: "",
        correctedValue: "",
        reason: ""
      });
    },
    onError: () => {
      toast({ 
        title: "Erro ao aplicar correção", 
        variant: "destructive" 
      });
    }
  });

  const revokeCorrectionMutation = useMutation({
    mutationFn: async (correctionId: number) => {
      const res = await fetch(`/api/admin/corrections/${correctionId}/revoke`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: revokeReason })
      });
      if (!res.ok) throw new Error("Failed to revoke correction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/shift-details/${shiftId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/shifts/${shiftId}/corrections`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timeline"] });
      toast({ title: "Correção revogada com sucesso!" });
      setRevokeDialogOpen(false);
      setRevokeReason("");
      setSelectedCorrectionId(null);
    },
    onError: () => {
      toast({ 
        title: "Erro ao revogar correção", 
        variant: "destructive" 
      });
    }
  });

  const openCorrectionDialog = (type: "product" | "payment" | "cash", item?: any) => {
    setCorrectionType(type);
    setSelectedItem(item);
    
    if (type === "product" && item) {
      setFormData({
        correctionType: "product_qty",
        shiftRecordId: item.id,
        productId: item.productId,
        fieldName: "soldQty",
        originalValue: item.soldQty?.toString() || "0",
        correctedValue: "",
        reason: ""
      });
    } else if (type === "payment") {
      setFormData({
        correctionType: "payment",
        paymentMethod: "cash",
        originalValue: shiftDetails?.payments?.cash || "0",
        correctedValue: "",
        reason: ""
      });
    } else if (type === "cash") {
      setFormData({
        correctionType: "cash_count",
        cashType: "countedFinalCash",
        originalValue: shiftDetails?.shift?.countedFinalCash || "0",
        correctedValue: "",
        reason: ""
      });
    }
    
    setIsDialogOpen(true);
  };

  const handleSubmitCorrection = () => {
    if (!formData.correctedValue || !formData.reason) {
      toast({ 
        title: "Preencha todos os campos obrigatórios", 
        variant: "destructive" 
      });
      return;
    }
    createCorrectionMutation.mutate(formData);
  };

  const openRevokeDialog = (correctionId: number) => {
    setSelectedCorrectionId(correctionId);
    setRevokeDialogOpen(true);
  };

  const handleRevokeCorrection = () => {
    if (!revokeReason || !selectedCorrectionId) {
      toast({ 
        title: "Informe o motivo da revogação", 
        variant: "destructive" 
      });
      return;
    }
    revokeCorrectionMutation.mutate(selectedCorrectionId);
  };

  const renderCorrectedValue = (original: any, corrected: any) => {
    if (corrected !== undefined && corrected !== null && corrected !== original) {
      return (
        <div className="flex items-center gap-2">
          <span className="line-through text-gray-400">
            {typeof original === 'number' ? original : formatCurrency(parseFloat(original || "0"))}
          </span>
          <span className="font-medium text-green-600">
            {typeof corrected === 'number' ? corrected : formatCurrency(parseFloat(corrected || "0"))}
          </span>
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Corrigido
          </Badge>
        </div>
      );
    }
    return <span>{typeof original === 'number' ? original : formatCurrency(parseFloat(original || "0"))}</span>;
  };

  if (isLoadingDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!shiftDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Turno não encontrado</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Correções do Turno #{shiftId}</h1>
            {shiftDetails?.shift?.status === 'closed' && (
              <Badge variant="secondary">Turno Fechado</Badge>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Funcionário: {shiftDetails?.shift?.user?.name} | 
              Data: {new Date(shiftDetails?.shift?.startTime).toLocaleDateString('pt-BR')}
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="products">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="products">Produtos</TabsTrigger>
                <TabsTrigger value="payments">Pagamentos</TabsTrigger>
                <TabsTrigger value="cash">Caixa</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
              </TabsList>
              
              <TabsContent value="products">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Vendidos</TableHead>
                        <TableHead>Sobra</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shiftDetails?.records?.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.product.name}</TableCell>
                          <TableCell>{renderCorrectedValue(record.entryQty, record.correctedEntryQty)}</TableCell>
                          <TableCell>{renderCorrectedValue(record.soldQty, record.correctedSoldQty)}</TableCell>
                          <TableCell>{renderCorrectedValue(record.leftoverQty, record.correctedLeftoverQty)}</TableCell>
                          <TableCell>{renderCorrectedValue(record.itemTotal, record.correctedTotal)}</TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => openCorrectionDialog("product", record)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="payments">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Método</TableHead>
                        <TableHead>Valor Original</TableHead>
                        <TableHead>Valor Corrigido</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Dinheiro</TableCell>
                        <TableCell>{formatCurrency(parseFloat(shiftDetails?.payments?.cash || "0"))}</TableCell>
                        <TableCell>
                          {shiftDetails?.correctedPayments?.cash 
                            ? formatCurrency(parseFloat(shiftDetails.correctedPayments.cash))
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openCorrectionDialog("payment")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>PIX</TableCell>
                        <TableCell>{formatCurrency(parseFloat(shiftDetails?.payments?.pix || "0"))}</TableCell>
                        <TableCell>
                          {shiftDetails?.correctedPayments?.pix 
                            ? formatCurrency(parseFloat(shiftDetails.correctedPayments.pix))
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                correctionType: "payment",
                                paymentMethod: "pix",
                                originalValue: shiftDetails?.payments?.pix || "0"
                              });
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="cash">
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor Original</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Caixa Final (Notas)</TableCell>
                        <TableCell>{formatCurrency(parseFloat(shiftDetails?.shift?.countedFinalCash || "0"))}</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openCorrectionDialog("cash")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Caixa Final (Moedas)</TableCell>
                        <TableCell>{formatCurrency(parseFloat(shiftDetails?.shift?.countedFinalCoins || "0"))}</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                correctionType: "cash_count",
                                cashType: "countedFinalCoins",
                                originalValue: shiftDetails?.shift?.countedFinalCoins || "0"
                              });
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="history">
                <div className="space-y-4">
                  {corrections.length === 0 ? (
                    <Alert>
                      <AlertDescription>Nenhuma correção aplicada ainda</AlertDescription>
                    </Alert>
                  ) : (
                    corrections.map((correction: any) => (
                      <Card key={correction.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{correction.correctionType}</p>
                                {correction.revokedAt && (
                                  <Badge variant="destructive">Revogada</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {correction.originalValue} → {correction.correctedValue}
                              </p>
                              <p className="text-sm text-gray-500">Motivo: {correction.reason}</p>
                              <p className="text-xs text-gray-400">
                                Aplicada em: {new Date(correction.appliedAt).toLocaleString('pt-BR')}
                              </p>
                              {correction.revokedAt && (
                                <p className="text-xs text-red-600">
                                  Revogada em: {new Date(correction.revokedAt).toLocaleString('pt-BR')} - 
                                  Motivo: {correction.revokeReason}
                                </p>
                              )}
                            </div>
                            {!correction.revokedAt && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openRevokeDialog(correction.id)}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Revogar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Dialog para nova correção */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Correção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {correctionType === "product" && (
                <>
                  <div>
                    <Label>Produto</Label>
                    <Input value={selectedItem?.product?.name || ""} disabled />
                  </div>
                  <div>
                    <Label>Campo a Corrigir</Label>
                    <Select 
                      value={formData.fieldName}
                      onValueChange={(value) => {
                        const record = selectedItem;
                        setFormData({
                          ...formData,
                          fieldName: value,
                          originalValue: record[value]?.toString() || "0"
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entryQty">Entrada</SelectItem>
                        <SelectItem value="soldQty">Vendidos</SelectItem>
                        <SelectItem value="leftoverQty">Sobra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              {correctionType === "payment" && (
                <div>
                  <Label>Método de Pagamento</Label>
                  <Select 
                    value={formData.paymentMethod}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        paymentMethod: value,
                        originalValue: shiftDetails?.payments?.[value] || "0"
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="stoneCard">Stone Cartão</SelectItem>
                      <SelectItem value="stoneVoucher">Stone Voucher</SelectItem>
                      <SelectItem value="pagBankCard">PagBank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Valor Original</Label>
                <Input value={formData.originalValue} disabled />
              </div>
              
              <div>
                <Label>Valor Corrigido *</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formData.correctedValue}
                  onChange={(e) => setFormData({...formData, correctedValue: e.target.value})}
                  placeholder="Digite o valor correto"
                />
              </div>
              
              <div>
                <Label>Motivo da Correção *</Label>
                <Textarea 
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  placeholder="Descreva o motivo da correção..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label>URL da Evidência (opcional)</Label>
                <Input 
                  type="url"
                  value={formData.evidenceUrl || ""}
                  onChange={(e) => setFormData({...formData, evidenceUrl: e.target.value})}
                  placeholder="Link para documento ou imagem"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitCorrection} disabled={createCorrectionMutation.isPending}>
                {createCorrectionMutation.isPending ? "Aplicando..." : "Aplicar Correção"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para revogar correção */}
        <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Revogar Correção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta ação irá reverter a correção aplicada. O valor voltará ao original.
                </AlertDescription>
              </Alert>
              <div>
                <Label>Motivo da Revogação *</Label>
                <Textarea 
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Descreva o motivo da revogação..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleRevokeCorrection} 
                disabled={revokeCorrectionMutation.isPending}
              >
                {revokeCorrectionMutation.isPending ? "Revogando..." : "Revogar Correção"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}