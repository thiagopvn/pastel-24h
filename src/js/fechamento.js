document.addEventListener('DOMContentLoaded', async () => {
    protectRoute(['admin']);
    
    const TRANSPORTE_VALOR = 4.00;
    
    const dataInicioInput = document.getElementById('dataInicio');
    const dataFimInput = document.getElementById('dataFim');
    const valorHoraInput = document.getElementById('valorHora');
    const btnCarregar = document.getElementById('btnCarregar');
    const btnSemanaAtual = document.getElementById('btnSemanaAtual');
    const btnExportExcel = document.getElementById('btnExportExcel');
    const btnExportPDF = document.getElementById('btnExportPDF');
    const statusContainer = document.getElementById('statusContainer');
    const statusMessage = document.getElementById('statusMessage');
    const emptyMessage = document.getElementById('emptyMessage');
    const table = document.getElementById('fechamentoTable');
    
    let funcionarios = [];
    let turnosData = {};
    let diasSemana = [];
    
    const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    async function init() {
        setSemanaAtual();
        setupEventListeners();
        await carregarDados();
    }
    
    function setupEventListeners() {
        btnCarregar.addEventListener('click', carregarDados);
        btnSemanaAtual.addEventListener('click', async () => {
            setSemanaAtual();
            await carregarDados();
        });
        btnExportExcel.addEventListener('click', exportToExcel);
        btnExportPDF.addEventListener('click', exportToPDF);
        valorHoraInput.addEventListener('input', recalcTotals);
        
        dataInicioInput.addEventListener('change', () => {
            const inicio = new Date(dataInicioInput.value);
            if (inicio) {
                const fim = new Date(inicio);
                fim.setDate(inicio.getDate() + 6);
                dataFimInput.value = formatDate(fim);
            }
        });
        
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.addEventListener('input', (e) => {
                if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
                    recalcTotals();
                }
            });
        }
    }
    
    function setSemanaAtual() {
        const hoje = new Date();
        const diaSemana = hoje.getDay();
        
        const segunda = new Date(hoje);
        segunda.setDate(hoje.getDate() - diaSemana + 1);
        if (diaSemana === 0) {
            segunda.setDate(hoje.getDate() - 6);
        }
        
        const domingo = new Date(segunda);
        domingo.setDate(segunda.getDate() + 6);
        
        dataInicioInput.value = formatDate(segunda);
        dataFimInput.value = formatDate(domingo);
    }
    
    async function carregarDados() {
        showStatus('Carregando funcionários...');
        
        try {
            const dataInicio = new Date(dataInicioInput.value);
            const dataFim = new Date(dataFimInput.value);
            
            if (!dataInicio || !dataFim || dataInicio > dataFim) {
                throw new Error('Período inválido');
            }
            
            diasSemana = [];
            const currentDate = new Date(dataInicio);
            while (currentDate <= dataFim) {
                diasSemana.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            showStatus('Carregando funcionários...');
            funcionarios = await loadFuncionarios();
            
            if (funcionarios.length === 0) {
                throw new Error('Nenhum funcionário encontrado');
            }
            
            showStatus('Carregando turnos fechados...');
            turnosData = await loadTurnos(dataInicio, dataFim);
            
            buildTable();
            hideStatus();
            
            recalcTotals();
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            showError(`Erro: ${error.message}`);
        }
    }
    
    async function loadFuncionarios() {
        try {
            const snapshot = await db.collection('usuarios')
                .where('role', 'in', ['funcionario', 'admin'])
                .get();
            
            const users = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                users.push({
                    uid: doc.id,
                    nome: data.nome || data.displayName || data.email || 'Sem nome',
                    email: data.email,
                    role: data.role
                });
            });
            
            users.sort((a, b) => a.nome.localeCompare(b.nome));
            
            return users;
        } catch (error) {
            console.error('Erro ao carregar funcionários:', error);
            return [];
        }
    }
    
    async function loadTurnos(dataInicio, dataFim) {
        try {
            const turnos = {};
            
            const currentDate = new Date(dataInicio);
            while (currentDate <= dataFim) {
                const dateStr = formatDate(currentDate);
                
                const turnosPromises = ['Manhã', 'Tarde', 'Noite'].map(periodo => 
                    db.collection('turnos')
                        .doc(`${dateStr}_${periodo}`)
                        .get()
                );
                
                const turnosDocs = await Promise.all(turnosPromises);
                
                turnosDocs.forEach(doc => {
                    if (doc.exists && doc.data().status === 'fechado') {
                        const data = doc.data();
                        
                        if (data.funcionarios) {
                            Object.entries(data.funcionarios).forEach(([uid, funcData]) => {
                                if (!turnos[dateStr]) turnos[dateStr] = {};
                                if (!turnos[dateStr][uid]) turnos[dateStr][uid] = {
                                    horas: 0,
                                    alimentacao: 0,
                                    transporteQtd: 0,
                                    consumo: 0
                                };
                                
                                turnos[dateStr][uid].horas += funcData.horasTotais || 0;
                                turnos[dateStr][uid].alimentacao += funcData.alimentacao || 0;
                                turnos[dateStr][uid].transporteQtd += funcData.transporteQtd || 0;
                                turnos[dateStr][uid].consumo += funcData.consumoValor || 0;
                            });
                        }
                    }
                });
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            return turnos;
        } catch (error) {
            console.error('Erro ao carregar turnos:', error);
            return {};
        }
    }
    
    function buildTable() {
        emptyMessage.classList.add('hidden');
        table.classList.remove('hidden');
        
        const thead = table.querySelector('thead');
        thead.innerHTML = `
            <tr class="bg-primary-50">
                <th rowspan="2" class="sticky-col px-4 py-3 text-left text-xs font-medium text-primary-700 uppercase tracking-wider border-r-2 border-primary-200">
                    Funcionário
                </th>
                ${diasSemana.map(dia => `
                    <th colspan="3" class="px-2 py-2 text-center text-xs font-medium text-primary-700 uppercase tracking-wider border-r border-primary-100">
                        ${DIAS_SEMANA[dia.getDay()]} ${dia.getDate()}/${dia.getMonth() + 1}
                    </th>
                `).join('')}
                <th colspan="7" class="px-2 py-2 text-center text-xs font-medium text-primary-700 uppercase tracking-wider bg-primary-100">
                    Totais
                </th>
            </tr>
            <tr class="bg-primary-50">
                ${diasSemana.map(() => `
                    <th class="px-1 py-2 text-center text-xs font-medium text-gray-600">Hs</th>
                    <th class="px-1 py-2 text-center text-xs font-medium text-gray-600">Alim</th>
                    <th class="px-1 py-2 text-center text-xs font-medium text-gray-600 border-r border-primary-100">Transp</th>
                `).join('')}
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-primary-100">Total Hs</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-primary-100">Total Alim</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-primary-100">Total Transp</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-primary-100">Consumo</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-primary-100">Desc.</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-primary-100">Adic.</th>
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-primary-100 font-bold">A Receber</th>
            </tr>
        `;
        
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = funcionarios.map(func => {
            let rowHtml = `
                <tr class="border-b hover:bg-gray-50" data-uid="${func.uid}">
                    <td class="sticky-col px-4 py-2 text-sm font-medium text-gray-900 bg-white border-r-2 border-gray-200">
                        ${func.nome}
                    </td>
            `;
            
            diasSemana.forEach((dia, diaIndex) => {
                const dateStr = formatDate(dia);
                const turnoData = turnosData[dateStr]?.[func.uid] || {};
                
                rowHtml += `
                    <td class="px-1 py-1 editable-cell">
                        <input type="number" 
                               id="${func.uid}_${diaIndex}_hs"
                               value="${turnoData.horas || ''}"
                               min="0" step="0.5" 
                               class="w-full px-2 py-2 text-base text-center border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                               style="min-height: 36px;">
                    </td>
                    <td class="px-1 py-1 editable-cell">
                        <input type="number" 
                               id="${func.uid}_${diaIndex}_alim"
                               value="${turnoData.alimentacao || ''}"
                               min="0" step="0.01" 
                               class="w-full px-2 py-2 text-base text-center border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                               style="min-height: 36px;">
                    </td>
                    <td class="px-1 py-1 editable-cell border-r border-gray-200">
                        <input type="number" 
                               id="${func.uid}_${diaIndex}_transp"
                               value="${turnoData.transporteQtd || ''}"
                               min="0" step="1" 
                               class="w-full px-2 py-2 text-base text-center border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                               style="min-height: 36px;">
                    </td>
                `;
            });
            
            let totalConsumo = 0;
            diasSemana.forEach(dia => {
                const dateStr = formatDate(dia);
                const turnoData = turnosData[dateStr]?.[func.uid] || {};
                totalConsumo += turnoData.consumo || 0;
            });
            
            rowHtml += `
                <td id="${func.uid}_total_hs" class="px-2 py-2 text-base text-center font-medium bg-gray-50">0</td>
                <td id="${func.uid}_total_alim" class="px-2 py-2 text-base text-center font-medium bg-gray-50">0</td>
                <td id="${func.uid}_total_transp" class="px-2 py-2 text-base text-center font-medium bg-gray-50">0</td>
                <td id="${func.uid}_consumo" class="px-2 py-2 text-base text-center font-medium bg-gray-50 text-red-600" data-value="${totalConsumo}">${formatCurrency(totalConsumo)}</td>
                <td class="px-1 py-1 editable-cell bg-gray-50">
                    <input type="number" 
                           id="${func.uid}_desconto"
                           value="0"
                           min="0" step="0.01" 
                           class="w-full px-2 py-2 text-base text-center text-red-600 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                           style="min-height: 36px;">
                </td>
                <td class="px-1 py-1 editable-cell bg-gray-50">
                    <input type="number" 
                           id="${func.uid}_adicional"
                           value="0"
                           min="0" step="0.01" 
                           class="w-full px-2 py-2 text-base text-center text-green-600 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                           style="min-height: 36px;">
                </td>
                <td id="${func.uid}_total_receber" class="px-2 py-2 text-base text-center font-bold bg-primary-50 text-primary-700">R$ 0,00</td>
            </tr>
            `;
            
            return rowHtml;
        }).join('');
        
        const tfoot = table.querySelector('tfoot');
        tfoot.innerHTML = `
            <tr class="total-row">
                <td class="sticky-col px-4 py-3 text-sm font-bold text-primary-700 bg-white border-r-2 border-primary-200">
                    TOTAIS GERAIS
                </td>
                ${diasSemana.map((_, index) => `
                    <td colspan="3" id="total_dia_${index}" class="px-2 py-3 text-sm text-center font-bold text-primary-700 border-r border-primary-200">
                        R$ 0,00
                    </td>
                `).join('')}
                <td id="total_geral_hs" class="px-2 py-3 text-sm text-center font-bold">0</td>
                <td id="total_geral_alim" class="px-2 py-3 text-sm text-center font-bold">R$ 0,00</td>
                <td id="total_geral_transp" class="px-2 py-3 text-sm text-center font-bold">R$ 0,00</td>
                <td id="total_geral_consumo" class="px-2 py-3 text-sm text-center font-bold text-red-600">R$ 0,00</td>
                <td id="total_geral_desconto" class="px-2 py-3 text-sm text-center font-bold text-red-600">R$ 0,00</td>
                <td id="total_geral_adicional" class="px-2 py-3 text-sm text-center font-bold text-green-600">R$ 0,00</td>
                <td id="total_geral_receber" class="px-2 py-3 text-sm text-center font-bold text-primary-700 text-lg">R$ 0,00</td>
            </tr>
        `;
    }
    
    function recalcTotals() {
        const valorHora = parseFloat(valorHoraInput.value) || 0;
        
        let totalGeralHs = 0;
        let totalGeralAlim = 0;
        let totalGeralTransp = 0;
        let totalGeralConsumo = 0;
        let totalGeralDesconto = 0;
        let totalGeralAdicional = 0;
        let totalGeralReceber = 0;
        
        const totaisPorDia = diasSemana.map(() => ({ horas: 0, alimentacao: 0, transporte: 0 }));
        
        funcionarios.forEach(func => {
            let totalHs = 0;
            let totalAlim = 0;
            let totalTranspQtd = 0;
            
            diasSemana.forEach((dia, diaIndex) => {
                const hs = parseFloat(document.getElementById(`${func.uid}_${diaIndex}_hs`)?.value) || 0;
                const alim = parseFloat(document.getElementById(`${func.uid}_${diaIndex}_alim`)?.value) || 0;
                const transpQtd = parseFloat(document.getElementById(`${func.uid}_${diaIndex}_transp`)?.value) || 0;
                
                totalHs += hs;
                totalAlim += alim;
                totalTranspQtd += transpQtd;
                
                totaisPorDia[diaIndex].horas += hs * valorHora;
                totaisPorDia[diaIndex].alimentacao += alim;
                totaisPorDia[diaIndex].transporte += transpQtd * TRANSPORTE_VALOR;
            });
            
            const consumoElement = document.getElementById(`${func.uid}_consumo`);
            const consumo = parseFloat(consumoElement?.dataset.value) || 0;
            
            const desconto = parseFloat(document.getElementById(`${func.uid}_desconto`)?.value) || 0;
            const adicional = parseFloat(document.getElementById(`${func.uid}_adicional`)?.value) || 0;
            
            const totalTranspValor = totalTranspQtd * TRANSPORTE_VALOR;
            const totalReceber = (totalHs * valorHora) + totalAlim + totalTranspValor + adicional - desconto - consumo;
            
            document.getElementById(`${func.uid}_total_hs`).textContent = totalHs.toFixed(1);
            document.getElementById(`${func.uid}_total_alim`).textContent = formatCurrency(totalAlim);
            document.getElementById(`${func.uid}_total_transp`).textContent = formatCurrency(totalTranspValor);
            document.getElementById(`${func.uid}_total_receber`).textContent = formatCurrency(Math.max(0, totalReceber));
            
            totalGeralHs += totalHs;
            totalGeralAlim += totalAlim;
            totalGeralTransp += totalTranspValor;
            totalGeralConsumo += consumo;
            totalGeralDesconto += desconto;
            totalGeralAdicional += adicional;
            totalGeralReceber += Math.max(0, totalReceber);
        });
        
        totaisPorDia.forEach((total, index) => {
            const totalDia = total.horas + total.alimentacao + total.transporte;
            document.getElementById(`total_dia_${index}`).textContent = formatCurrency(totalDia);
        });
        
        document.getElementById('total_geral_hs').textContent = totalGeralHs.toFixed(1);
        document.getElementById('total_geral_alim').textContent = formatCurrency(totalGeralAlim);
        document.getElementById('total_geral_transp').textContent = formatCurrency(totalGeralTransp);
        document.getElementById('total_geral_consumo').textContent = formatCurrency(totalGeralConsumo);
        document.getElementById('total_geral_desconto').textContent = formatCurrency(totalGeralDesconto);
        document.getElementById('total_geral_adicional').textContent = formatCurrency(totalGeralAdicional);
        document.getElementById('total_geral_receber').textContent = formatCurrency(totalGeralReceber);
    }
    
    function exportToExcel() {
        try {
            const wb = XLSX.utils.book_new();
            
            const data = [];
            
            const header1 = ['Funcionário'];
            const header2 = [''];
            
            diasSemana.forEach(dia => {
                const diaSemana = DIAS_SEMANA[dia.getDay()];
                const dataStr = `${dia.getDate()}/${dia.getMonth() + 1}`;
                header1.push(diaSemana + ' ' + dataStr, '', '');
                header2.push('Hs', 'Alim', 'Transp');
            });
            
            header1.push('Total Hs', 'Total Alim', 'Total Transp', 'Consumo', 'Desconto', 'Adicional', 'Total a Receber');
            header2.push('', '', '', '', '', '', '');
            
            data.push(header1);
            data.push(header2);
            
            funcionarios.forEach(func => {
                const row = [func.nome];
                
                diasSemana.forEach((_, diaIndex) => {
                    const hs = document.getElementById(`${func.uid}_${diaIndex}_hs`)?.value || '';
                    const alim = document.getElementById(`${func.uid}_${diaIndex}_alim`)?.value || '';
                    const transp = document.getElementById(`${func.uid}_${diaIndex}_transp`)?.value || '';
                    row.push(hs, alim, transp);
                });
                
                row.push(
                    document.getElementById(`${func.uid}_total_hs`).textContent,
                    document.getElementById(`${func.uid}_total_alim`).textContent,
                    document.getElementById(`${func.uid}_total_transp`).textContent,
                    document.getElementById(`${func.uid}_consumo`).textContent,
                    document.getElementById(`${func.uid}_desconto`).value,
                    document.getElementById(`${func.uid}_adicional`).value,
                    document.getElementById(`${func.uid}_total_receber`).textContent
                );
                
                data.push(row);
            });
            
            const totalRow = ['TOTAIS GERAIS'];
            diasSemana.forEach((_, index) => {
                const total = document.getElementById(`total_dia_${index}`).textContent;
                totalRow.push(total, '', '');
            });
            
            totalRow.push(
                document.getElementById('total_geral_hs').textContent,
                document.getElementById('total_geral_alim').textContent,
                document.getElementById('total_geral_transp').textContent,
                document.getElementById('total_geral_consumo').textContent,
                document.getElementById('total_geral_desconto').textContent,
                document.getElementById('total_geral_adicional').textContent,
                document.getElementById('total_geral_receber').textContent
            );
            
            data.push(totalRow);
            
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            XLSX.utils.book_append_sheet(wb, ws, 'Fechamento');
            
            const fileName = `Fechamento_${formatDate(new Date())}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            showStatus('Excel exportado com sucesso!', 'success');
            setTimeout(hideStatus, 3000);
            
        } catch (error) {
            console.error('Erro ao exportar Excel:', error);
            showError('Erro ao exportar para Excel');
        }
    }
    
    function exportToPDF() {
        try {
            const element = document.getElementById('fechamentoTable');
            
            const opt = {
                margin: 10,
                filename: `Fechamento_${formatDate(new Date())}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };
            
            html2pdf().set(opt).from(element).save();
            
            showStatus('PDF exportado com sucesso!', 'success');
            setTimeout(hideStatus, 3000);
            
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            showError('Erro ao exportar para PDF');
        }
    }
    
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }
    
    function showStatus(message, type = 'info') {
        statusContainer.classList.remove('hidden', 'bg-blue-50', 'bg-green-50', 'bg-red-50');
        statusContainer.classList.remove('border-blue-200', 'border-green-200', 'border-red-200');
        statusContainer.classList.remove('text-blue-700', 'text-green-700', 'text-red-700');
        
        if (type === 'success') {
            statusContainer.classList.add('bg-green-50', 'border-green-200', 'text-green-700');
            statusMessage.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
        } else if (type === 'error') {
            statusContainer.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
            statusMessage.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
        } else {
            statusContainer.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-700');
            statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${message}`;
        }
    }
    
    function hideStatus() {
        statusContainer.classList.add('hidden');
    }
    
    function showError(message) {
        showStatus(message, 'error');
        setTimeout(hideStatus, 5000);
    }
    
    init();
});