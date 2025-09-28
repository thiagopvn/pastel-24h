import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Calculator } from "lucide-react";
import type { Shift } from "@shared/schema";
import { formatCurrency } from "@/lib/calculations";
import { MAX_CASH_DIVERGENCE } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";

const closeShiftSchema = z.object({
  countedFinalCash: z.string().min(1, "Informe o valor contado em dinheiro"),
  countedFinalCoins: z.string().min(1, "Informe o valor contado em moedas"),
  envelopeCash: z.string().min(1, "Informe o valor para o envelope em dinheiro"),
  envelopeCoins: z.string().min(1, "Informe o valor para o envelope em moedas"),
  notes: z.string().optional(),
});

type CloseShiftForm = z.infer<typeof closeShiftSchema>;

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  onConfirm: (data: any) => void;
  isClosing: boolean;
  divergenceDetails?: any;
  livePayments?: {
    cash: number;
    pix: number;
    stoneCard: number;
    stoneVoucher: number;
    pagBankCard: number;
  };
}

export function CloseShiftModal({
  isOpen,
  onClose,
  shift,
  onConfirm,
  isClosing,
  divergenceDetails,
  livePayments
}: CloseShiftModalProps) {
  const { user } = useAuth();
  const [cashDivergence, setCashDivergence] = useState(0);
  const [salesInconsistency, setSalesInconsistency] = useState(false);
  const [salesDifference, setSalesDifference] = useState(0);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState('');

  const form = useForm<CloseShiftForm>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: {
      countedFinalCash: shift.tempFinalCash || "",
      countedFinalCoins: shift.tempFinalCoins || "",
      envelopeCash: "",
      envelopeCoins: "",
      notes: "",
    },
  });

  // Update form values when shift data changes
  useEffect(() => {
    if (shift.tempFinalCash && shift.tempFinalCoins) {
      form.setValue("countedFinalCash", shift.tempFinalCash);
      form.setValue("countedFinalCoins", shift.tempFinalCoins);
    }
  }, [shift.tempFinalCash, shift.tempFinalCoins, form]);

  // Reset all divergence states when modal opens/closes
  useEffect(() => {
    if (isOpen && !divergenceDetails) {
      // Reset divergence states when opening modal without previous divergence
      setCashDivergence(0);
      setSalesInconsistency(false);
      setSalesDifference(0);
      // Clear form errors and reset notes field
      form.clearErrors("notes");
      form.setValue("notes", "");
    }
  }, [isOpen, divergenceDetails, form]);

  // Reset states when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setCashDivergence(0);
      setSalesInconsistency(false);
      setSalesDifference(0);
    }
  }, [isOpen]);

  // Handle divergence details from error response
  useEffect(() => {
    if (divergenceDetails) {
      if (divergenceDetails.salesInconsistency) {
        setSalesInconsistency(true);
        setSalesDifference(parseFloat(divergenceDetails.salesDifference || 0));
      }
      if (divergenceDetails.cashDivergence) {
        setCashDivergence(parseFloat(divergenceDetails.cashDivergence || 0));
      }
    }
  }, [divergenceDetails]);

  // Get expected cash from API with real-time refresh
  const { data: paymentData } = useQuery({
    queryKey: [`/api/shift-payments?shiftId=${shift.id}`],
    enabled: isOpen,
    refetchInterval: 2000, // Refetch every 2 seconds when modal is open
    staleTime: 0, // Always consider data stale for fresh updates
  });

  // Get cash adjustments/withdrawals from the current shift
  const { data: cashAdjustments } = useQuery({
    queryKey: ["/api/cash-adjustments", shift.id],
    enabled: isOpen,
  });

  // Registros de produtos movimentados
  const { data: shiftRecords } = useQuery<any[]>({
    queryKey: [`/api/shift-records?shiftId=${shift.id}`],
    enabled: isOpen,
  });

  // Colaboradores do turno
  const { data: collaborators } = useQuery<any[]>({
    queryKey: [`/api/shift-collaborators?shiftId=${shift.id}`],
    enabled: isOpen,
  });

  // Consumo de colaboradores
  const { data: collaboratorConsumptions } = useQuery<any[]>({
    queryKey: [`/api/shifts/${shift.id}/collaborator-consumption`],
    enabled: isOpen,
  });

  const countedFinalCash = parseFloat(form.watch("countedFinalCash") || "0");
  const countedFinalCoins = parseFloat(form.watch("countedFinalCoins") || "0");
  const envelopeCash = parseFloat(form.watch("envelopeCash") || "0");
  const envelopeCoins = parseFloat(form.watch("envelopeCoins") || "0");

  // Calculate expected cash considering withdrawals
  const initialCash = parseFloat(shift.initialCash || "200.00");
  const initialCoins = parseFloat(shift.initialCoins || "50.00");
  // Use livePayments if provided (real-time), otherwise fallback to API data
  console.log("=== CLOSE SHIFT MODAL - PAYMENTS DEBUG ===");
  console.log("livePayments recebido:", livePayments);
  console.log("paymentData da API:", paymentData);
  const cashSales = livePayments?.cash ?? parseFloat((paymentData as any)?.cash || "0");
  console.log("cashSales calculado:", cashSales);

  // Calculate total withdrawals made during this shift
  let totalWithdrawals = 0;
  if (cashAdjustments && Array.isArray(cashAdjustments)) {
    totalWithdrawals = cashAdjustments.reduce((total, adjustment) => {
      if (adjustment.type === 'withdraw' || adjustment.type === 'adjustment') {
        return total + parseFloat(adjustment.amount || 0);
      }
      return total;
    }, 0);
  }

  // Expected cash = initial + sales - withdrawals
  const expectedCash = initialCash + cashSales - totalWithdrawals;
  
  // Total physical money initial = initial cash + initial coins
  const totalPhysicalInitial = initialCash + initialCoins;
  
  // Total expected final = expected cash + initial coins (coins don't change during shift)
  const totalExpectedFinal = expectedCash + initialCoins;

  // Calculate cash for next shift
  const cashForNextShift = countedFinalCash - envelopeCash;
  const coinsForNextShift = countedFinalCoins - envelopeCoins;
  const totalForNextShift = cashForNextShift + coinsForNextShift;

  // Calculate divergence when counted cash changes
  useEffect(() => {
    // Only calculate divergence if we have valid values and modal is open without previous divergence details
    if (isOpen && countedFinalCash >= 0 && countedFinalCoins >= 0 && totalExpectedFinal >= 0) {
      // Total contado = dinheiro contado + moedas contadas
      const totalCounted = countedFinalCash + countedFinalCoins;
      
      // Divergência total considerando dinheiro + moedas
      const divergence = totalCounted - totalExpectedFinal;
      
      // Only set if we don't have divergenceDetails from server (avoid overriding server response)
      if (!divergenceDetails) {
        setCashDivergence(divergence);
      }
    }
  }, [countedFinalCash, countedFinalCoins, totalExpectedFinal, isOpen, divergenceDetails]);

  // Calculate sales inconsistency when data is loaded
  useEffect(() => {
    if (isOpen && shiftRecords && paymentData && !divergenceDetails) {
      // Calculate total from records using itemTotal (já calculado no backend)
      const totalRecordsValue = shiftRecords.reduce((sum: number, record: any) => {
        return sum + parseFloat(record.itemTotal || "0");
      }, 0);

      // Calculate total from payments - use livePayments if available for real-time calculation
      const totalPayments = livePayments 
        ? (livePayments.cash + livePayments.pix + livePayments.stoneCard + 
           livePayments.stoneVoucher + livePayments.pagBankCard)
        : ((parseFloat((paymentData as any)?.cash || "0")) +
           (parseFloat((paymentData as any)?.pix || "0")) +
           (parseFloat((paymentData as any)?.stoneCard || "0")) +
           (parseFloat((paymentData as any)?.stoneVoucher || "0")) +
           (parseFloat((paymentData as any)?.pagBankCard || "0")));

      // Check for sales inconsistency
      const difference = Math.abs(totalPayments - totalRecordsValue);
      
      console.log(`Modal Sales Check - Records Total: R$ ${totalRecordsValue.toFixed(2)}, Payments Total: R$ ${totalPayments.toFixed(2)}, Difference: R$ ${difference.toFixed(2)}`);
      
      // Only set if we don't have divergenceDetails from server (avoid overriding server response)
      if (!divergenceDetails) {
        if (difference > 0.01) {
          setSalesInconsistency(true);
          setSalesDifference(difference);
        } else {
          setSalesInconsistency(false);
          setSalesDifference(0);
        }
      }
    }
  }, [isOpen, shiftRecords, paymentData, livePayments, divergenceDetails]); // Added divergenceDetails to dependencies

  const generateShiftClosurePDF = async (pdfData: any): Promise<string> => {
    const { shift, formData, paymentData, shiftRecords, collaborators, collaboratorConsumptions } = pdfData;

    console.log('PDF Generation - Collaborators data:', collaborators);
    console.log('PDF Generation - Collaborators length:', collaborators?.length);
    console.log('PDF Generation - Collaborator consumptions:', collaboratorConsumptions);
    console.log('PDF Generation - Shift data:', shift);

    const doc = new jsPDF();
    const now = new Date();
    
    // Helper para formatação de moeda
    const formatCurrencyPDF = (value: string | number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

    // Título
    doc.setFontSize(18);
    doc.text("Relatório de Fechamento de Turno", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(now, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, 105, 26, { align: "center" });

    // Informações do Turno
    autoTable(doc, {
      startY: 35,
      body: [
        ["Turno ID:", `#${shift.id}`, "Funcionário:", user?.name || "N/A"],
        ["Início:", format(new Date(shift.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR }), 
         "Fim:", format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })],
      ],
      theme: 'plain',
      styles: { fontSize: 10 },
    });

    // Resumo do Caixa
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("Resumo do Caixa", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Descrição', 'Valor (R$)']],
      body: [
        ['Caixa Inicial', formatCurrencyPDF(parseFloat(shift.initialCash) + parseFloat(shift.initialCoins))],
        ['Vendas em Dinheiro', formatCurrencyPDF(livePayments?.cash ?? paymentData?.cash ?? 0)],
        ['Retiradas Administrativas', formatCurrencyPDF(totalWithdrawals)],
        ['Caixa Esperado', formatCurrencyPDF(totalExpectedFinal)],
        ['Caixa Final Contado', formatCurrencyPDF(parseFloat(formData.countedFinalCash) + parseFloat(formData.countedFinalCoins))],
      ],
      theme: 'grid',
      foot: [
        ['DIVERGÊNCIA', formatCurrencyPDF(cashDivergence)]
      ],
      didParseCell: function (data) {
        if (data.row.section === 'foot') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = cashDivergence < 0 ? [255, 0, 0] : [0, 128, 0];
        }
      }
    });

    // Retirada para Envelope e Troco
    const envelopeTotal = parseFloat(formData.envelopeCash) + parseFloat(formData.envelopeCoins);
    const trocoTotal = (parseFloat(formData.countedFinalCash) + parseFloat(formData.countedFinalCoins)) - envelopeTotal;
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: [['Retirada & Troco', 'Valor (R$)']],
      body: [
        ['Retirado para Envelope', formatCurrencyPDF(envelopeTotal)],
        ['Troco para Próximo Turno', formatCurrencyPDF(trocoTotal)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] },
      foot: [
        [`(Notas: ${formatCurrencyPDF(parseFloat(formData.countedFinalCash) - parseFloat(formData.envelopeCash))} / Moedas: ${formatCurrencyPDF(parseFloat(formData.countedFinalCoins) - parseFloat(formData.envelopeCoins))})`]
      ],
      footStyles: { fontStyle: 'italic', fontSize: 8, halign: 'right' }
    });

    // Vendas por Forma de Pagamento
    finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Vendas por Forma de Pagamento", 14, finalY);
    
    const currentCash = livePayments?.cash ?? paymentData?.cash ?? 0;
    const currentPix = livePayments?.pix ?? paymentData?.pix ?? 0;
    const currentStoneCard = livePayments?.stoneCard ?? paymentData?.stoneCard ?? 0;
    const currentStoneVoucher = livePayments?.stoneVoucher ?? paymentData?.stoneVoucher ?? 0;
    const currentPagBank = livePayments?.pagBankCard ?? paymentData?.pagBankCard ?? 0;
    
    const paymentMethods = [
      ['Dinheiro', formatCurrencyPDF(currentCash)],
      ['PIX', formatCurrencyPDF(currentPix)],
      ['Stone Cartão', formatCurrencyPDF(currentStoneCard)],
      ['Stone Voucher', formatCurrencyPDF(currentStoneVoucher)],
      ['PagBank Cartão', formatCurrencyPDF(currentPagBank)],
    ];
    
    const totalPayments = currentCash + currentPix + currentStoneCard + currentStoneVoucher + currentPagBank;
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Forma de Pagamento', 'Valor']],
      body: paymentMethods,
      foot: [['TOTAL DE VENDAS', formatCurrencyPDF(totalPayments)]],
      theme: 'grid',
      footStyles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    });

    // Movimentação de Produtos
    if (shiftRecords && shiftRecords.length > 0) {
      finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text("Movimentação de Produtos", 14, finalY);
      
      const productRows = shiftRecords.map((record: any) => [
        record.product?.name || 'N/A',
        record.entryQty?.toString() || '0',
        record.arrivalQty?.toString() || '0',
        record.leftoverQty?.toString() || '0',
        record.discardQty?.toString() || '0',
        record.consumedQty?.toString() || '0',
        record.soldQty?.toString() || '0',
        formatCurrencyPDF((record.soldQty || 0) * (parseFloat(record.product?.price) || 0))
      ]);
      
      const totalSoldQuantity = shiftRecords.reduce((sum: number, r: any) => sum + (r.soldQty || 0), 0);
      const totalRevenue = shiftRecords.reduce((sum: number, r: any) => sum + ((r.soldQty || 0) * (parseFloat(r.product?.price) || 0)), 0);
      
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Produto', 'Inicial', 'Chegada', 'Sobra', 'Descarte', 'Consumo', 'Vendidos', 'Total (R$)']],
        body: productRows,
        foot: [['TOTAIS', '', '', '', '', '', totalSoldQuantity.toString(), formatCurrencyPDF(totalRevenue)]],
        theme: 'grid',
        headStyles: { fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        footStyles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
      });
    }

    // Resumo dos Colaboradores
    finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Resumo dos Colaboradores", 14, finalY);

    if (collaborators && collaborators.length > 0) {
      const collaboratorRows = collaborators.map((c: any) => [
        c.name || 'N/A',
        `${parseFloat(c.hoursWorked || '0').toFixed(2)} horas`,
        formatCurrencyPDF(c.internalConsumption || 0)
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Colaborador', 'Horas Trabalhadas', 'Consumo Interno (R$)']],
        body: collaboratorRows,
        theme: 'grid',
      });
    } else {
      autoTable(doc, {
        startY: finalY + 5,
        body: [['Nenhum colaborador registrado neste turno.']],
        theme: 'plain',
        styles: { fontSize: 10, textColor: [128, 128, 128] }
      });
    }

    // Consumo de Colaboradores
    finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Consumo de Colaboradores", 14, finalY);

    if (collaboratorConsumptions && collaboratorConsumptions.length > 0) {
      const consumptionRows = collaboratorConsumptions.map((consumption: any) => {
        const discount = (consumption.beveragesValue + consumption.pastriesValue) * 0.5;
        const products = consumption.consumedProducts 
          ? (typeof consumption.consumedProducts === 'string' 
             ? JSON.parse(consumption.consumedProducts) 
             : consumption.consumedProducts)
          : [];
        const productsList = products.map((p: any) => `${p.name} (${p.quantity}x)`).join(', ') || '-';
        
        return [
          consumption.collaborator?.name || 'N/A',
          `${consumption.hoursWorked} h`,
          formatCurrencyPDF(consumption.beveragesValue),
          formatCurrencyPDF(consumption.pastriesValue),
          `${consumption.waterQuantity}x`,
          formatCurrencyPDF(discount),
          productsList
        ];
      });

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Colaborador', 'Horas', 'Bebidas (R$)', 'Pastéis (R$)', 'Águas', 'Desconto (R$)', 'Produtos Detalhados']],
        body: consumptionRows,
        theme: 'grid',
        styles: { fontSize: 8 },
        columnStyles: {
          6: { cellWidth: 50 }
        }
      });

      // Totais de consumo
      const totalBeverages = collaboratorConsumptions.reduce((sum: number, c: any) => sum + (c.beveragesValue || 0), 0);
      const totalPastries = collaboratorConsumptions.reduce((sum: number, c: any) => sum + (c.pastriesValue || 0), 0);
      const totalWater = collaboratorConsumptions.reduce((sum: number, c: any) => sum + (c.waterQuantity || 0), 0);
      const totalDiscount = (totalBeverages + totalPastries) * 0.5;

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 2,
        body: [
          ['TOTAIS', '', formatCurrencyPDF(totalBeverages), formatCurrencyPDF(totalPastries), `${totalWater}x`, formatCurrencyPDF(totalDiscount), '']
        ],
        theme: 'grid',
        styles: { fontSize: 8, fontStyle: 'bold' },
        columnStyles: {
          6: { cellWidth: 50 }
        }
      });
    } else {
      autoTable(doc, {
        startY: finalY + 5,
        body: [['Nenhum consumo de colaborador registrado neste turno.']],
        theme: 'plain',
        styles: { fontSize: 10, textColor: [128, 128, 128] }
      });
    }

    // Informações Operacionais
    finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Informações Operacionais", 14, finalY);

    // Verifica gasExchange ou tempGasExchange
    const gasExchanged = shift.gasExchange || shift.tempGasExchange || false;
    console.log('Gas Exchange Status:', gasExchanged, 'gasExchange:', shift.gasExchange, 'tempGasExchange:', shift.tempGasExchange);

    const operationalInfo = [
      ['Troca de Gás Realizada:', gasExchanged ? 'Sim' : 'Não']
    ];

    autoTable(doc, {
      startY: finalY + 5,
      body: operationalInfo,
      theme: 'plain',
      styles: { fontSize: 10 },
    });

    // Observações
    if (formData.notes) {
      finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text("Observações", 14, finalY);
      
      autoTable(doc, {
        startY: finalY + 5,
        body: [['Observações:', formData.notes]],
        theme: 'plain',
        styles: { fontSize: 10 }
      });
    }

    // Assinatura
    const finalPageY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(10);
    doc.text("________________________________________", 105, finalPageY + 20, { align: "center" });
    doc.text(user?.name || "Funcionário", 105, finalPageY + 26, { align: "center" });
    doc.setFontSize(8);
    doc.text("Assinatura do Responsável", 105, finalPageY + 30, { align: "center" });

    // Retornar a Data URI do PDF
    return doc.output('datauristring');
  };

  const handleViewPDF = async () => {
    const formData = form.getValues();
    const pdfData = {
      shift,
      formData,
      paymentData,
      shiftRecords,
      collaborators,
      collaboratorConsumptions,
    };
    
    try {
      const dataUri = await generateShiftClosurePDF(pdfData);
      setPdfDataUri(dataUri);
      setIsPdfModalOpen(true);
    } catch (error) {
      console.error('Erro ao gerar visualização do PDF:', error);
    }
  };

  const handleSubmit = async (data: CloseShiftForm) => {
    // Check cash divergence and sales inconsistency
    const requiresNotes = Math.abs(cashDivergence) > MAX_CASH_DIVERGENCE || salesInconsistency;
    
    // Clear previous errors if divergence is resolved
    if (!requiresNotes) {
      form.clearErrors("notes");
    }
    
    if (requiresNotes && !data.notes) {
      let message = "Observação obrigatória devido a: ";
      const reasons = [];
      
      if (Math.abs(cashDivergence) > MAX_CASH_DIVERGENCE) {
        reasons.push(`divergência de caixa de ${formatCurrency(cashDivergence)}`);
      }
      
      if (salesInconsistency) {
        reasons.push(`inconsistência de vendas de ${formatCurrency(salesDifference)}`);
      }
      
      message += reasons.join(" e ");
      
      form.setError("notes", { message });
      return;
    }

    try {
      // Coleta todos os dados para o PDF
      const pdfData = {
        shift,
        formData: data,
        paymentData,
        shiftRecords,
        collaborators,
        collaboratorConsumptions,
      };
      
      // 1. Gera a Data URI do PDF
      const dataUri = await generateShiftClosurePDF(pdfData);
      
      // 2. Força o download do PDF
      const link = document.createElement('a');
      link.href = dataUri;
      const now = new Date();
      const fileName = `fechamento_turno_${shift.id}_${(user?.name || 'funcionario').replace(/\s/g, '_')}_${format(now, 'ddMMyyyy_HHmmss')}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 3. Continua com o fechamento do turno
      onConfirm(data);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      // Continua com o fechamento mesmo se o PDF falhar
      onConfirm(data);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechamento de Turno</DialogTitle>
          <DialogDescription>
            Conte o dinheiro físico e informe os valores para fechamento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Expected vs Counted Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Dinheiro Físico Inicial</p>
                  <p className="font-semibold">{formatCurrency(totalPhysicalInitial)}</p>
                  <p className="text-xs text-gray-500">
                    Caixa: {formatCurrency(initialCash)} + Moedas: {formatCurrency(initialCoins)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Vendas em Dinheiro</p>
                  <p className="font-semibold">{formatCurrency(cashSales)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Retiradas</p>
                  <p className="font-semibold text-red-600">
                    -{formatCurrency(totalWithdrawals)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Dinheiro Esperado Final</p>
                  <p className="font-semibold text-blue-600">
                    {formatCurrency(totalExpectedFinal)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Caixa: {formatCurrency(expectedCash)} + Moedas: {formatCurrency(initialCoins)}
                  </p>
                </div>
              </div>
            </div>

            {/* Show withdrawals if any */}
            {totalWithdrawals > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Retiradas Durante o Turno</h4>
                <div className="space-y-1">
                  {(cashAdjustments as any)?.map((adjustment: any, index: number) => (
                    <div key={index} className="text-sm text-yellow-700 flex justify-between">
                      <span>{adjustment.reason}</span>
                      <span className="font-medium">-{formatCurrency(parseFloat(adjustment.amount))}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-yellow-600 mt-2">
                  Essas retiradas já foram descontadas do caixa esperado
                </div>
              </div>
            )}

            {/* Step 1: Total Counted in Store */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  1
                </span>
                Total Contado na Loja
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="countedFinalCash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Cédulas (R$)
                        {shift.tempFinalCash && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Carregado
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Total em cédulas contado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="countedFinalCoins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Moedas (R$)
                        {shift.tempFinalCoins && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Carregado
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Total em moedas contado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm">
                <p className="font-medium">Total Contado: {formatCurrency(countedFinalCash + countedFinalCoins)}</p>
              </div>
            </div>

            {/* Step 2: Envelope Values */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  2
                </span>
                Retirada para Envelope Administrativo
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="envelopeCash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cédulas para Envelope (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Valor em cédulas para o envelope
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="envelopeCoins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moedas para Envelope (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Valor em moedas para o envelope
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-yellow-50 rounded p-3 text-sm">
                <p className="font-medium">Total para Envelope: {formatCurrency(envelopeCash + envelopeCoins)}</p>
              </div>
            </div>

            {/* Step 3: Cash for Next Shift */}
            <div className="space-y-4 border rounded-lg p-4 bg-green-50">
              <h3 className="font-medium flex items-center gap-2 text-green-800">
                <Calculator className="h-5 w-5" />
                Troco para Próximo Turno (Calculado Automaticamente)
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Cédulas</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(cashForNextShift)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(countedFinalCash)} - {formatCurrency(envelopeCash)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Moedas</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(coinsForNextShift)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(countedFinalCoins)} - {formatCurrency(envelopeCoins)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-2">
                <p className="font-medium text-green-800">
                  Total para Próximo Turno: {formatCurrency(totalForNextShift)}
                </p>
              </div>
            </div>

            {/* Divergence Analysis */}
            {(countedFinalCash > 0 && expectedCash > 0) || salesInconsistency ? (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium">Análise de Divergência</h3>

                {/* Sales Inconsistency Alert */}
                {salesInconsistency && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Inconsistência de vendas detectada: {formatCurrency(salesDifference)}</strong>
                      <br />
                      Diferença entre total de pagamentos e total de produtos vendidos.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Cash Divergence Alert */}
                {countedFinalCash > 0 && expectedCash > 0 && (
                  Math.abs(cashDivergence) <= MAX_CASH_DIVERGENCE && !salesInconsistency ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Divergência de caixa dentro do limite aceitável: {formatCurrency(cashDivergence)}
                      </AlertDescription>
                    </Alert>
                  ) : Math.abs(cashDivergence) > MAX_CASH_DIVERGENCE ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Divergência de caixa detectada: {formatCurrency(cashDivergence)}</strong>
                        <br />
                        Diferença entre valor contado e valor esperado.
                      </AlertDescription>
                    </Alert>
                  ) : null
                )}

                {/* Notes Field - Show when there's any divergence */}
                {(Math.abs(cashDivergence) > MAX_CASH_DIVERGENCE || salesInconsistency) && (
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-red-600">Observações (Obrigatório)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explique o motivo da divergência..."
                            className="min-h-[80px] border-red-300 focus:border-red-400"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-red-600">
                          É necessário justificar as divergências para continuar com o fechamento.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" variant="secondary" onClick={handleViewPDF}>
                Visualizar PDF
              </Button>
              <Button type="submit" disabled={isClosing}>
                {isClosing ? "Fechando..." : "Confirmar Fechamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        </DialogContent>
      </Dialog>

      {/* Modal para exibir o PDF */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização do Relatório</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={pdfDataUri}
              title="Pré-visualização do PDF"
              className="w-full h-full border-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}