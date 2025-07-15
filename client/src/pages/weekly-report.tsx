import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Calendar, RefreshCw, Save, FileText, Download, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User, WeeklyReport, TransportMode } from "@shared/schema";
import MobileNav from "@/components/navigation/mobile-nav";
import { calculatePayroll, calculateTransportCost, formatCurrency } from "@/lib/calculations";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface EmployeeData {
  userId: number;
  name: string;
  hours: number;
  transport: number;
  food: number;
  consumption: number;
  bonus: number;
  deduction: number;
  total: number;
  daysWorked: number;
  shiftsCount: number;
  transportType?: string;
}

/**
 * Weekly Report Page Component
 * Manages weekly payroll calculations and report generation
 */
export default function WeeklyReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [hourlyRate, setHourlyRate] = useState(12.50);
  const [foodBenefit, setFoodBenefit] = useState(25.00);
  const [consumptionDiscount, setConsumptionDiscount] = useState(50);
  const [transportRates, setTransportRates] = useState<Record<string, number>>({
    bus: 8.80,
    van: 12.00,
    app: 15.00,
  });
  const [employeeData, setEmployeeData] = useState<EmployeeData[]>([]);

  if (user?.role !== 'admin') {
    return <Redirect to="/" />;
  }

  const weekStart = currentWeek;
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  // Fetch users
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch transport modes
  const { data: transportModes } = useQuery<TransportMode[]>({
    queryKey: ["/api/admin/transport"],
  });

  // Fetch payroll configuration
  const { data: payrollConfig } = useQuery({
    queryKey: ["/api/admin/payroll-config"],
  });

  // Fetch existing report
  const { data: existingReport } = useQuery<WeeklyReport>({
    queryKey: ["/api/admin/weekly-report", format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const res = await fetch(`/api/admin/weekly-report?weekStart=${format(weekStart, 'yyyy-MM-dd')}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Fetch all reports for history
  const { data: allReports } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/admin/weekly-report"],
  });

  // Load payroll configuration when available (only once on mount)
  const [hasLoadedConfig, setHasLoadedConfig] = useState(false);
  useEffect(() => {
    if (payrollConfig && typeof payrollConfig === 'object' && !hasLoadedConfig) {
      if (payrollConfig.hourlyRate) setHourlyRate(parseFloat(payrollConfig.hourlyRate) || 12.50);
      if (payrollConfig.foodBenefit !== undefined) setFoodBenefit(parseFloat(payrollConfig.foodBenefit) || 0);
      if (payrollConfig.consumptionDiscount !== undefined) setConsumptionDiscount(payrollConfig.consumptionDiscount || 50);
      if (payrollConfig.transportRates) setTransportRates(payrollConfig.transportRates || { bus: 8.80, van: 12.00, app: 15.00 });
      setHasLoadedConfig(true);
    }
  }, [payrollConfig, hasLoadedConfig]);

  // Update transport rates when transport modes change
  useEffect(() => {
    if (transportModes && transportModes.length > 0) {
      const newRates: Record<string, number> = {};
      transportModes.forEach(mode => {
        newRates[mode.name.toLowerCase()] = parseFloat(mode.roundTripPrice);
      });
      setTransportRates(prev => ({ ...prev, ...newRates }));
    }
  }, [transportModes]);

  /**
   * Load data mutation - Calculates automatic payroll data
   */
  const loadDataMutation = useMutation({
    mutationFn: async () => {
      const requestData = {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        hourlyRate,
        foodBenefit,
        consumptionDiscount,
        transportRates
      };

      const res = await apiRequest("POST", "/api/admin/weekly-report/calculate", requestData);
      const result = await res.json();
      return result.employeeData;
    },
    onSuccess: (data) => {
      setEmployeeData(data);
      toast({ 
        title: "Dados carregados com sucesso!", 
        description: `${data.length} funcionários processados automaticamente`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao carregar dados", 
        description: error.message || "Erro desconhecido",
        variant: "destructive" 
      });
    },
  });

  /**
   * Save report mutation
   */
  const saveReportMutation = useMutation({
    mutationFn: async () => {
      const reportData = {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        hourlyRate: hourlyRate.toString(),
        foodBenefit: foodBenefit.toString(),
        consumptionDiscount,
        transportRates,
        employeeData,
      };

      const res = await apiRequest("POST", "/api/admin/weekly-report", reportData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/weekly-report"] });
      toast({ title: "Relatório salvo com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao salvar relatório", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  /**
   * Update employee data with recalculation
   */
  const updateEmployee = (userId: number, field: keyof EmployeeData, value: number) => {
    setEmployeeData(prev => prev.map(emp => {
      if (emp.userId === userId) {
        const updated = { ...emp, [field]: value };

        // Recalculate total using the helper function
        updated.total = calculatePayroll(
          updated.hours,
          hourlyRate,
          updated.transport,
          updated.food,
          updated.consumption,
          consumptionDiscount,
          updated.bonus,
          updated.deduction
        );

        return updated;
      }
      return emp;
    }));
  };

  /**
   * Save payroll configuration
   */
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const configData = {
        hourlyRate,
        foodBenefit,
        consumptionDiscount,
        transportRates
      };

      const res = await apiRequest("POST", "/api/admin/payroll-config", configData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll-config"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (error: any) => {
      console.error("Erro ao salvar configurações:", error);
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    }
  });

  /**
   * Load existing report data
   */
  const loadExistingReport = () => {
    if (existingReport) {
      setHourlyRate(parseFloat(existingReport.hourlyRate));
      setFoodBenefit(parseFloat(existingReport.foodBenefit));
      setConsumptionDiscount(existingReport.consumptionDiscount || 50);
      setTransportRates(existingReport.transportRates || { bus: 8.80, van: 12.00, app: 15.00 });
      setEmployeeData(existingReport.employeeData || []);
      toast({ title: "Relatório carregado com sucesso!" });
    } else {
      toast({ title: "Nenhum relatório encontrado para esta semana", variant: "destructive" });
    }
  };

  /**
   * Export to PDF using jsPDF
   */
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Title
    doc.setFontSize(18);
    doc.text('Fechamento Semanal', 14, 22);

    // Period
    doc.setFontSize(12);
    doc.text(`Período: ${format(weekStart, 'dd/MM/yyyy')} - ${format(weekEnd, 'dd/MM/yyyy')}`, 14, 32);

    // Table data
    const tableData = employeeData.map(emp => [
      emp.name,
      `${emp.hours}h`,
      emp.daysWorked,
      formatCurrency(emp.transport),
      formatCurrency(emp.food),
      formatCurrency(emp.consumption),
      formatCurrency(emp.bonus),
      formatCurrency(emp.deduction),
      formatCurrency(emp.total)
    ]);

    // Add totals row
    const totals = calculateTotals();
    tableData.push([
      'TOTAL',
      `${totals.hours}h`,
      '',
      formatCurrency(totals.transport),
      formatCurrency(totals.food),
      formatCurrency(totals.consumption),
      '',
      '',
      formatCurrency(totals.payroll)
    ]);

    // Generate table
    autoTable(doc, {
      head: [['Funcionário', 'Horas', 'Dias', 'Transporte', 'Alimentação', 'Consumo', 'Adicional', 'Desconto', 'Total']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    // Save PDF
    doc.save(`fechamento-semanal-${format(weekStart, 'dd-MM-yyyy')}.pdf`);
    toast({ title: "PDF exportado com sucesso!" });
  };

  /**
   * Export to Excel using xlsx
   */
  const exportExcel = () => {
    const ws_data = [
      ['Fechamento Semanal'],
      [`Período: ${format(weekStart, 'dd/MM/yyyy')} - ${format(weekEnd, 'dd/MM/yyyy')}`],
      [],
      ['Funcionário', 'Horas', 'Dias', 'Transporte', 'Alimentação', 'Consumo', 'Adicional', 'Desconto', 'Total']
    ];

    // Add employee data
    employeeData.forEach(emp => {
      ws_data.push([
        emp.name,
        emp.hours,
        emp.daysWorked,
        emp.transport,
        emp.food,
        emp.consumption,
        emp.bonus,
        emp.deduction,
        emp.total
      ]);
    });

    // Add totals
    const totals = calculateTotals();
    ws_data.push([
      'TOTAL',
      totals.hours,
      '',
      totals.transport,
      totals.food,
      totals.consumption,
      '',
      '',
      totals.payroll
    ]);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fechamento");

    // Write file
    XLSX.writeFile(wb, `fechamento-semanal-${format(weekStart, 'dd-MM-yyyy')}.xlsx`);
    toast({ title: "Excel exportado com sucesso!" });
  };

  /**
   * Calculate totals for footer
   */
  const calculateTotals = () => {
    return {
      hours: employeeData.reduce((sum, emp) => sum + emp.hours, 0),
      transport: employeeData.reduce((sum, emp) => sum + emp.transport, 0),
      food: employeeData.reduce((sum, emp) => sum + emp.food, 0),
      consumption: employeeData.reduce((sum, emp) => sum + emp.consumption, 0),
      payroll: employeeData.reduce((sum, emp) => sum + emp.total, 0)
    };
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Fechamento Semanal
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Período: {format(weekStart, 'dd/MM/yyyy', { locale: ptBR })} - {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>

              {/* Week Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                >
                  Semana Atual
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status and Controls */}
            <div className="mt-4 space-y-4">
              {existingReport && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <p className="text-sm text-green-800 font-medium">
                        Relatório já existe para esta semana
                      </p>
                    </div>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={loadExistingReport}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Carregar Relatório Existente
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="weekPicker">Selecionar Semana Específica</Label>
                  <Input
                    id="weekPicker"
                    type="date"
                    value={format(currentWeek, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const selectedDate = new Date(e.target.value);
                      setCurrentWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }));
                    }}
                    className="w-full sm:w-auto"
                  />
                </div>

                {allReports && allReports.length > 0 && (
                  <div>
                    <Label>Histórico de Relatórios</Label>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        const selectedDate = new Date(value);
                        setCurrentWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }));
                      }}
                    >
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Selecionar relatório anterior" />
                      </SelectTrigger>
                      <SelectContent>
                        {allReports
                          .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
                          .map((report) => (
                          <SelectItem 
                            key={report.id} 
                            value={format(new Date(report.weekStart), 'yyyy-MM-dd')}
                          >
                            {format(new Date(report.weekStart), 'dd/MM/yyyy')} - {format(new Date(report.weekEnd), 'dd/MM/yyyy')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Configuration Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Configurações</h3>
                <Button
                  onClick={() => saveConfigMutation.mutate()}
                  disabled={saveConfigMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveConfigMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="hourlyRate">Valor da Hora (R$)</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>
                <div>
                  <Label htmlFor="foodBenefit">Benefício Alimentação (R$)</Label>
                  <Input
                    id="foodBenefit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={foodBenefit}
                    onChange={(e) => setFoodBenefit(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>
                <div>
                  <Label htmlFor="consumptionDiscount">Desconto Consumo (%)</Label>
                  <Input
                    id="consumptionDiscount"
                    type="number"
                    min="0"
                    max="100"
                    value={consumptionDiscount}
                    onChange={(e) => setConsumptionDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  />
                </div>
              </div>
            </div>

            {/* Transport Configuration */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Configurar Valores de Transporte</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(transportRates).map(([type, rate]) => (
                  <div key={type}>
                    <Label htmlFor={`${type}Rate`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} (ida/volta)
                    </Label>
                    <Input
                      id={`${type}Rate`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={rate}
                      onChange={(e) => setTransportRates(prev => ({ 
                        ...prev, 
                        [type]: Math.max(0, parseFloat(e.target.value) || 0) 
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Employee Payroll Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-center">Horas</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead className="text-right">Transporte</TableHead>
                    <TableHead className="text-right">Alimentação</TableHead>
                    <TableHead className="text-right">Consumo</TableHead>
                    <TableHead className="text-center">Adicional</TableHead>
                    <TableHead className="text-center">Desconto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeData.map((employee) => (
                    <TableRow key={employee.userId}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell className="text-center">{employee.hours.toFixed(2)}h</TableCell>
                      <TableCell className="text-center">{employee.daysWorked}</TableCell>
                      <TableCell className="text-right">{formatCurrency(employee.transport)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(employee.food)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        -{formatCurrency(employee.consumption)}
                        {consumptionDiscount > 0 && (
                          <div className="text-xs text-gray-500">
                            {consumptionDiscount}% desconto
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={employee.bonus}
                          onChange={(e) => updateEmployee(employee.userId, 'bonus', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-24 text-sm text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={employee.deduction}
                          onChange={(e) => updateEmployee(employee.userId, 'deduction', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-24 text-sm text-center"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(employee.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">TOTAL</TableCell>
                    <TableCell className="text-center font-bold">{totals.hours.toFixed(2)}h</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totals.transport)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totals.food)}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      -{formatCurrency(totals.consumption)}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {formatCurrency(totals.payroll)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => loadDataMutation.mutate()}
                disabled={loadDataMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadDataMutation.isPending ? 'animate-spin' : ''}`} />
                {loadDataMutation.isPending ? 'Carregando...' : 'Carregar Dados'}
              </Button>

              <Button
                onClick={() => saveReportMutation.mutate()}
                disabled={saveReportMutation.isPending || employeeData.length === 0}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveReportMutation.isPending ? 'Salvando...' : 'Salvar Fechamento'}
              </Button>

              <Button 
                variant="secondary" 
                className="flex-1"
                onClick={exportPDF}
                disabled={employeeData.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>

              <Button 
                variant="secondary" 
                className="flex-1"
                onClick={exportExcel}
                disabled={employeeData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <MobileNav currentPath="/admin/weekly" />
      
      {/* Mobile bottom padding to prevent content overlap */}
      <div className="xl:hidden h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}></div>
    </div>
  );
}