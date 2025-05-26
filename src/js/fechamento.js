document.addEventListener('DOMContentLoaded', async () => {
    protectRoute(['admin']);
    
    // Configurações globais
    const CONFIG = {
        transportePadrao: {
            onibus: 9.60,
            moto: 15.00,
            carro: 20.00,
            outros: 10.00,
            nenhum: 0
        },
        valorHoraPadrao: 10.00,
        diasSemana: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    };
    
    // Estado da aplicação
    const state = {
        funcionarios: [],
        turnosData: {},
        diasSemana: [],
        valoresTransporte: { ...CONFIG.transportePadrao },
        dadosAlterados: false
    };
    
    // Elementos DOM
    const elements = {
        dataInicio: document.getElementById('dataInicio'),
        dataFim: document.getElementById('dataFim'),
        valorHora: document.getElementById('valorHora'),
        btnCarregar: document.getElementById('btnCarregar'),
        btnSalvar: document.getElementById('btnSalvar'),
        btnSemanaAtual: document.getElementById('btnSemanaAtual'),
        btnExportExcel: document.getElementById('btnExportExcel'),
        btnExportPDF: document.getElementById('btnExportPDF'),
        btnConfigTransporte: document.getElementById('btnConfigTransporte'),
        statusContainer: document.getElementById('statusContainer'),
        statusMessage: document.getElementById('statusMessage'),
        emptyMessage: document.getElementById('emptyMessage'),
        table: document.getElementById('fechamentoTable'),
        modalTransporte: document.getElementById('modalTransporte')
    };
    
    // Inicialização
    async function init() {
        console.log('🚀 Iniciando sistema de fechamento semanal...');
        
        // Configurar semana atual (segunda a domingo)
        setSemanaAtual();
        
        // Carregar configurações salvas
        await loadConfiguracoes();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Carregar dados automaticamente
        await carregarDados();
    }
    
    function setupEventListeners() {
        elements.btnCarregar.addEventListener('click', carregarDados);
        elements.btnSalvar.addEventListener('click', salvarDados);
        elements.btnSemanaAtual.addEventListener('click', async () => {
            setSemanaAtual();
            await carregarDados();
        });
        
        elements.btnExportExcel.addEventListener('click', exportToExcel);
        elements.btnExportPDF.addEventListener('click', exportToPDF);
        elements.btnConfigTransporte.addEventListener('click', abrirModalTransporte);
        
        elements.valorHora.addEventListener('input', () => {
            state.dadosAlterados = true;
            recalcularTotais();
        });
        
        // Quando mudar data inicial, ajustar data final automaticamente
        elements.dataInicio.addEventListener('change', () => {
            const inicio = new Date(elements.dataInicio.value);
            if (inicio) {
                // Ajustar para segunda-feira se não for
                const diaSemana = inicio.getDay();
                if (diaSemana !== 1) { // 1 = segunda
                    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
                    inicio.setDate(inicio.getDate() + diff);
                    elements.dataInicio.value = formatDate(inicio);
                }
                
                // Definir domingo como fim
                const fim = new Date(inicio);
                fim.setDate(inicio.getDate() + 6);
                elements.dataFim.value = formatDate(fim);
            }
        });
        
        // Modal de transporte
        document.getElementById('btnCancelarTransporte').addEventListener('click', fecharModalTransporte);
        document.getElementById('btnSalvarTransporte').addEventListener('click', salvarConfigTransporte);
        
        // Detectar mudanças nos inputs da tabela
        elements.table.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                state.dadosAlterados = true;
                recalcularTotais();
            }
        });
        
        // Avisar antes de sair se houver mudanças não salvas
        window.addEventListener('beforeunload', (e) => {
            if (state.dadosAlterados) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }
    
    function setSemanaAtual() {
        const hoje = new Date();
        const diaSemana = hoje.getDay();
        
        // Calcular segunda-feira
        const segunda = new Date(hoje);
        const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
        segunda.setDate(hoje.getDate() + diffSegunda);
        
        // Calcular domingo
        const domingo = new Date(segunda);
        domingo.setDate(segunda.getDate() + 6);
        
        elements.dataInicio.value = formatDate(segunda);
        elements.dataFim.value = formatDate(domingo);
    }
    
    async function loadConfiguracoes() {
        try {
            // Carregar configurações do localStorage ou Firebase
            const savedTransporte = localStorage.getItem('valoresTransporte');
            if (savedTransporte) {
                state.valoresTransporte = JSON.parse(savedTransporte);
                updateModalTransporte();
            }
            
            const savedValorHora = localStorage.getItem('valorHora');
            if (savedValorHora) {
                elements.valorHora.value = savedValorHora;
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }
    
    async function carregarDados() {
        showStatus('Iniciando carregamento de dados...');
        
        try {
            const dataInicio = new Date(elements.dataInicio.value);
            const dataFim = new Date(elements.dataFim.value);
            
            if (!dataInicio || !dataFim || dataInicio > dataFim) {
                throw new Error('Período inválido. Selecione uma semana válida.');
            }
            
            // Gerar array de dias da semana (segunda a domingo)
            state.diasSemana = [];
            const currentDate = new Date(dataInicio);
            while (currentDate <= dataFim) {
                state.diasSemana.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            // Carregar funcionários
            showStatus('Carregando funcionários...');
            state.funcionarios = await loadFuncionarios();
            
            if (state.funcionarios.length === 0) {
                throw new Error('Nenhum funcionário encontrado no sistema.');
            }
            
            // Carregar turnos
            showStatus('Carregando turnos fechados...');
            state.turnosData = await loadTurnos(dataInicio, dataFim);
            
            // Construir tabela
            buildTable();
            hideStatus();
            
            // Calcular totais
            recalcularTotais();
            
            state.dadosAlterados = false;
            
            showStatus('Dados carregados com sucesso!', 'success');
            setTimeout(hideStatus, 3000);
            
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
            
            // Ordenar por nome
            users.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            
            console.log(`✅ ${users.length} funcionários carregados`);
            return users;
            
        } catch (error) {
            console.error('Erro ao carregar funcionários:', error);
            throw new Error('Falha ao carregar funcionários do banco de dados');
        }
    }
    
    async function loadTurnos(dataInicio, dataFim) {
        try {
            const turnos = {};
            
            const currentDate = new Date(dataInicio);
            while (currentDate <= dataFim) {
                const dateStr = formatDate(currentDate);
                console.log(`\n📅 Buscando turnos do dia: ${dateStr}`);
                
                // Buscar todos os turnos do dia
                const turnosSnapshot = await db.collection('turnos')
                    .where(firebase.firestore.FieldPath.documentId(), '>=', dateStr)
                    .where(firebase.firestore.FieldPath.documentId(), '<', dateStr + 'z')
                    .where('status', '==', 'fechado')
                    .get();
                
                console.log(`📊 Encontrados ${turnosSnapshot.size} turnos fechados para ${dateStr}`);
                
                turnosSnapshot.forEach(doc => {
                    const data = doc.data();
                    const turnoId = doc.id;
                    
                    console.log(`\n=== Processando turno: ${turnoId} ===`);
                    
                    // Identificar responsável
                    const responsavelId = data.fechamento?.responsavelId || data.abertura?.responsavelId;
                    const responsavelNome = data.fechamento?.responsavelNome || data.abertura?.responsavelNome;
                    
                    if (!responsavelId) {
                        console.warn(`⚠️ Turno ${turnoId} sem responsável identificado`);
                        return;
                    }
                    
                    console.log(`👤 Responsável: ${responsavelNome} (${responsavelId})`);
                    
                    // Inicializar estrutura
                    if (!turnos[dateStr]) turnos[dateStr] = {};
                    if (!turnos[dateStr][responsavelId]) {
                        turnos[dateStr][responsavelId] = {
                            nome: responsavelNome,
                            horas: 0,
                            alimentacao: 0,
                            transporteTipo: 'nenhum',
                            transporteValor: 0,
                            consumo: 0,
                            turnoId: turnoId
                        };
                    }
                    
                    // 1. Calcular horas trabalhadas
                    if (data.abertura?.hora && data.fechamento?.hora) {
                        const horasTrabalhadas = calcularHorasTrabalhadas(
                            data.abertura.hora, 
                            data.fechamento.hora
                        );
                        turnos[dateStr][responsavelId].horas += horasTrabalhadas;
                        console.log(`⏱️ Horas trabalhadas: ${horasTrabalhadas.toFixed(2)}h`);
                    }
                    
                    // 2. Calcular consumo total do funcionário
                    const consumoTotal = calcularConsumoFuncionario(data);
                    turnos[dateStr][responsavelId].consumo += consumoTotal;
                    console.log(`🍽️ Consumo total: R$ ${consumoTotal.toFixed(2)}`);
                    
                    // 3. Transporte e alimentação (dados salvos anteriormente, se houver)
                    if (data.fechamento?.transporte) {
                        turnos[dateStr][responsavelId].transporteTipo = data.fechamento.transporte.tipo || 'nenhum';
                        turnos[dateStr][responsavelId].transporteValor = data.fechamento.transporte.valor || 0;
                    }
                    
                    if (data.fechamento?.alimentacao) {
                        turnos[dateStr][responsavelId].alimentacao = data.fechamento.alimentacao || 0;
                    }
                });
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            console.log('\n📊 RESUMO FINAL DOS TURNOS:');
            console.log(JSON.stringify(turnos, null, 2));
            
            return turnos;
            
        } catch (error) {
            console.error('❌ Erro ao carregar turnos:', error);
            throw new Error('Falha ao carregar turnos do banco de dados');
        }
    }
    
    function calcularHorasTrabalhadas(horaInicio, horaFim) {
        const [horaIni, minIni] = horaInicio.split(':').map(Number);
        const [horaFin, minFin] = horaFim.split(':').map(Number);
        
        let minutosInicio = horaIni * 60 + minIni;
        let minutosFim = horaFin * 60 + minFin;
        
        // Se o horário de fim for menor, assumir que passou da meia-noite
        if (minutosFim < minutosInicio) {
            minutosFim += 24 * 60;
        }
        
        const minutosTrabalhados = minutosFim - minutosInicio;
        return minutosTrabalhados / 60;
    }
    
    function calcularConsumoFuncionario(turnoData) {
        let consumoTotal = 0;
        
        console.log('📋 Calculando consumo do funcionário...');
        
        // 1. Consumo de pastéis
        if (turnoData.itens?.pasteis) {
            Object.entries(turnoData.itens.pasteis).forEach(([key, item]) => {
                if (item.consumo && item.consumo > 0) {
                    const valorConsumo = item.consumo * (item.precoUnitario || 0);
                    if (valorConsumo > 0) {
                        console.log(`  🥟 Pastel ${key}: ${item.consumo} x R$ ${item.precoUnitario} = R$ ${valorConsumo.toFixed(2)}`);
                        consumoTotal += valorConsumo;
                    }
                }
            });
        }
        
        // 2. Consumo de caldo de cana
        if (turnoData.itens?.caldo_cana) {
            Object.entries(turnoData.itens.caldo_cana).forEach(([key, item]) => {
                if (item.consumo && item.consumo > 0) {
                    const valorConsumo = item.consumo * (item.precoUnitario || 0);
                    if (valorConsumo > 0) {
                        console.log(`  🥤 Caldo ${key}: ${item.consumo} x R$ ${item.precoUnitario} = R$ ${valorConsumo.toFixed(2)}`);
                        consumoTotal += valorConsumo;
                    }
                }
            });
        }
        
        // 3. Consumo de casquinhas
        if (turnoData.itens?.casquinhas) {
            Object.entries(turnoData.itens.casquinhas).forEach(([key, item]) => {
                if (item.consumo && item.consumo > 0) {
                    const valorConsumo = item.consumo * (item.precoUnitario || 0);
                    if (valorConsumo > 0) {
                        console.log(`  🍦 Casquinha ${key}: ${item.consumo} x R$ ${item.precoUnitario} = R$ ${valorConsumo.toFixed(2)}`);
                        consumoTotal += valorConsumo;
                    }
                }
            });
        }
        
        // 4. Consumo de refrigerantes
        if (turnoData.itens?.refrigerantes) {
            Object.entries(turnoData.itens.refrigerantes).forEach(([key, item]) => {
                if (item.consumo && item.consumo > 0) {
                    const valorConsumo = item.consumo * (item.precoUnitario || 0);
                    if (valorConsumo > 0) {
                        console.log(`  🥤 Refrigerante ${key}: ${item.consumo} x R$ ${item.precoUnitario} = R$ ${valorConsumo.toFixed(2)}`);
                        consumoTotal += valorConsumo;
                    }
                }
            });
        }
        
        // 5. Consumo interno de gelo
        if (turnoData.gelo?.gelo_pacote?.consumoInterno && turnoData.gelo.gelo_pacote.consumoInterno > 0) {
            const valorConsumo = turnoData.gelo.gelo_pacote.consumoInterno * (turnoData.gelo.gelo_pacote.precoUnitario || 0);
            if (valorConsumo > 0) {
                console.log(`  🧊 Gelo consumo interno: ${turnoData.gelo.gelo_pacote.consumoInterno} x R$ ${turnoData.gelo.gelo_pacote.precoUnitario} = R$ ${valorConsumo.toFixed(2)}`);
                consumoTotal += valorConsumo;
            }
        }
        
        console.log(`  💰 TOTAL CONSUMO: R$ ${consumoTotal.toFixed(2)}`);
        
        return consumoTotal;
    }
    
    function buildTable() {
        elements.emptyMessage.classList.add('hidden');
        elements.table.classList.remove('hidden');
        
        // Construir cabeçalho
        const thead = elements.table.querySelector('thead');
        thead.innerHTML = `
            <tr>
                <th rowspan="2" class="fixed-col col-funcionario px-4 py-3 text-left text-xs font-medium text-primary-700 uppercase tracking-wider">
                    Funcionário
                </th>
                ${state.diasSemana.map((dia, index) => `
                    <th colspan="5" class="col-dia px-2 py-2 text-center text-xs font-medium text-primary-700 uppercase tracking-wider border-l border-primary-200">
                        ${CONFIG.diasSemana[index]} ${dia.getDate()}/${dia.getMonth() + 1}
                    </th>
                `).join('')}
                <th colspan="8" class="px-2 py-2 text-center text-xs font-medium text-primary-700 uppercase tracking-wider bg-primary-100 border-l-2 border-primary-300">
                    TOTAIS DA SEMANA
                </th>
            </tr>
            <tr>
                ${state.diasSemana.map(() => `
                    <th class="compact-cell text-center text-xs font-medium text-gray-600">Hs</th>
                    <th class="compact-cell text-center text-xs font-medium text-gray-600">Alim</th>
                    <th class="compact-cell text-center text-xs font-medium text-gray-600">Transp</th>
                    <th class="compact-cell text-center text-xs font-medium text-gray-600">Tipo</th>
                    <th class="compact-cell text-center text-xs font-medium text-gray-600 border-r border-primary-200">Cons</th>
                `).join('')}
                <th class="col-total compact-cell text-center text-xs font-medium text-gray-700 bg-primary-50">Total Hs</th>
                <th class="col-total compact-cell text-center text-xs font-medium text-gray-700 bg-primary-50">Total Alim</th>
                <th class="col-total compact-cell text-center text-xs font-medium text-gray-700 bg-primary-50">Total Transp</th>
                <th class="col-total compact-cell text-center text-xs font-medium text-gray-700 bg-primary-50 consumo-cell">Consumo</th>
                <th class="col-total compact-cell text-center text-xs font-medium text-gray-700 bg-primary-50">Desc.</th>
                <th class="col-total compact-cell text-center text-xs font-medium text-gray-700 bg-primary-50">Adic.</th>
                <th class="col-final compact-cell text-center text-xs font-medium text-gray-700 bg-yellow-100 font-bold">A Receber</th>
                <th class="compact-cell text-center text-xs font-medium text-gray-700 bg-primary-50">Ações</th>
            </tr>
        `;
        
        // Construir corpo da tabela
        const tbody = elements.table.querySelector('tbody');
        tbody.innerHTML = state.funcionarios.map(func => {
            let rowHtml = `
                <tr class="border-b hover:bg-gray-50" data-uid="${func.uid}">
                    <td class="fixed-col col-funcionario px-4 py-2 text-sm font-medium text-gray-900 bg-white">
                        ${func.nome}
                        <span class="text-xs text-gray-500 block">${func.role === 'admin' ? '👑 Admin' : '👤 Func'}</span>
                    </td>
            `;
            
            // Células para cada dia da semana
            state.diasSemana.forEach((dia, diaIndex) => {
                const dateStr = formatDate(dia);
                const turnoData = state.turnosData[dateStr]?.[func.uid] || {};
                
                rowHtml += `
                    <td class="compact-cell">
                        <input type="number" 
                               id="${func.uid}_${diaIndex}_hs"
                               value="${turnoData.horas ? turnoData.horas.toFixed(1) : ''}"
                               min="0" max="24" step="0.5" 
                               class="compact-input w-full text-center border rounded focus:ring-1 focus:ring-primary-500"
                               placeholder="0">
                    </td>
                    <td class="compact-cell">
                        <input type="number" 
                               id="${func.uid}_${diaIndex}_alim"
                               value="${turnoData.alimentacao || ''}"
                               min="0" step="0.01" 
                               class="compact-input w-full text-center border rounded focus:ring-1 focus:ring-primary-500"
                               placeholder="0">
                    </td>
                    <td class="compact-cell transport-valor">
                        <span id="${func.uid}_${diaIndex}_transp_valor" class="text-sm font-medium">
                            ${turnoData.transporteValor ? formatCurrency(turnoData.transporteValor) : 'R$ 0'}
                        </span>
                    </td>
                    <td class="compact-cell">
                        <select id="${func.uid}_${diaIndex}_transp_tipo"
                                class="transport-select w-full"
                                data-uid="${func.uid}"
                                data-dia="${diaIndex}">
                            <option value="nenhum" ${turnoData.transporteTipo === 'nenhum' ? 'selected' : ''}>-</option>
                            <option value="onibus" ${turnoData.transporteTipo === 'onibus' ? 'selected' : ''}>🚌 Ônibus</option>
                            <option value="moto" ${turnoData.transporteTipo === 'moto' ? 'selected' : ''}>🏍️ Moto</option>
                            <option value="carro" ${turnoData.transporteTipo === 'carro' ? 'selected' : ''}>🚗 Carro</option>
                            <option value="outros" ${turnoData.transporteTipo === 'outros' ? 'selected' : ''}>📍 Outros</option>
                        </select>
                    </td>
                    <td class="compact-cell consumo-cell border-r border-primary-200">
                        <span id="${func.uid}_${diaIndex}_consumo" class="text-sm font-medium">
                            ${turnoData.consumo ? formatCurrency(turnoData.consumo) : '-'}
                        </span>
                    </td>
                `;
            });
            
            // Células de totais
            rowHtml += `
                <td id="${func.uid}_total_hs" class="col-total compact-cell text-center font-medium bg-gray-50">0</td>
                <td id="${func.uid}_total_alim" class="col-total compact-cell text-center font-medium bg-gray-50">0</td>
                <td id="${func.uid}_total_transp" class="col-total compact-cell text-center font-medium bg-gray-50 transport-valor">0</td>
                <td id="${func.uid}_consumo" class="col-total compact-cell text-center font-medium consumo-cell">0</td>
                <td class="col-total compact-cell">
                    <input type="number" 
                           id="${func.uid}_desconto"
                           value="0"
                           min="0" step="0.01" 
                           class="compact-input w-full text-center text-red-600 font-semibold border rounded"
                           placeholder="0">
                </td>
                <td class="col-total compact-cell">
                    <input type="number" 
                           id="${func.uid}_adicional"
                           value="0"
                           min="0" step="0.01" 
                           class="compact-input w-full text-center text-green-600 font-semibold border rounded"
                           placeholder="0">
                </td>
                <td id="${func.uid}_total_receber" class="col-final compact-cell text-center font-bold total-highlight text-lg">R$ 0,00</td>
                <td class="compact-cell text-center">
                    <button class="text-primary-600 hover:text-primary-800" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
            `;
            
            return rowHtml;
        }).join('');
        
        // Rodapé com totais gerais
        const tfoot = elements.table.querySelector('tfoot');
        tfoot.innerHTML = `
            <tr class="font-bold">
                <td class="fixed-col col-funcionario px-4 py-3 text-sm text-primary-700">
                    TOTAIS GERAIS
                </td>
                ${state.diasSemana.map((_, index) => `
                    <td colspan="5" id="total_dia_${index}" class="col-dia px-2 py-3 text-sm text-center text-primary-700 border-l border-primary-200">
                        R$ 0,00
                    </td>
                `).join('')}
                <td id="total_geral_hs" class="col-total px-2 py-3 text-sm text-center">0</td>
                <td id="total_geral_alim" class="col-total px-2 py-3 text-sm text-center">R$ 0,00</td>
                <td id="total_geral_transp" class="col-total px-2 py-3 text-sm text-center transport-valor">R$ 0,00</td>
                <td id="total_geral_consumo" class="col-total px-2 py-3 text-sm text-center consumo-cell">R$ 0,00</td>
                <td id="total_geral_desconto" class="col-total px-2 py-3 text-sm text-center text-red-600">R$ 0,00</td>
                <td id="total_geral_adicional" class="col-total px-2 py-3 text-sm text-center text-green-600">R$ 0,00</td>
                <td id="total_geral_receber" class="col-final px-2 py-3 text-center text-lg bg-yellow-200">R$ 0,00</td>
                <td class="px-2 py-3"></td>
            </tr>
        `;
        
        // Adicionar listeners para mudanças de tipo de transporte
        document.querySelectorAll('.transport-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const uid = e.target.dataset.uid;
                const dia = e.target.dataset.dia;
                const tipo = e.target.value;
                const valor = state.valoresTransporte[tipo] || 0;
                
                // Atualizar valor mostrado
                const valorSpan = document.getElementById(`${uid}_${dia}_transp_valor`);
                if (valorSpan) {
                    valorSpan.textContent = formatCurrency(valor);
                }
                
                // Recalcular totais
                recalcularTotais();
            });
        });
    }
    
    function recalcularTotais() {
        const valorHora = parseFloat(elements.valorHora.value) || 0;
        
        let totalGeralHs = 0;
        let totalGeralAlim = 0;
        let totalGeralTransp = 0;
        let totalGeralConsumo = 0;
        let totalGeralDesconto = 0;
        let totalGeralAdicional = 0;
        let totalGeralReceber = 0;
        
        const totaisPorDia = state.diasSemana.map(() => ({
            horas: 0,
            alimentacao: 0,
            transporte: 0,
            consumo: 0
        }));
        
        // Calcular para cada funcionário
        state.funcionarios.forEach(func => {
            let totalHs = 0;
            let totalAlim = 0;
            let totalTransp = 0;
            let totalConsumo = 0;
            
            // Somar valores de cada dia
            state.diasSemana.forEach((dia, diaIndex) => {
                const hs = parseFloat(document.getElementById(`${func.uid}_${diaIndex}_hs`)?.value) || 0;
                const alim = parseFloat(document.getElementById(`${func.uid}_${diaIndex}_alim`)?.value) || 0;
                
                // Transporte baseado no tipo selecionado
                const tipoTransp = document.getElementById(`${func.uid}_${diaIndex}_transp_tipo`)?.value || 'nenhum';
                const valorTransp = state.valoresTransporte[tipoTransp] || 0;
                
                // Consumo do dia
                const dateStr = formatDate(dia);
                const consumoDia = state.turnosData[dateStr]?.[func.uid]?.consumo || 0;
                
                totalHs += hs;
                totalAlim += alim;
                totalTransp += valorTransp;
                totalConsumo += consumoDia;
                
                // Somar aos totais do dia
                totaisPorDia[diaIndex].horas += hs * valorHora;
                totaisPorDia[diaIndex].alimentacao += alim;
                totaisPorDia[diaIndex].transporte += valorTransp;
                totaisPorDia[diaIndex].consumo += consumoDia;
            });
            
            // Descontos e adicionais
            const desconto = parseFloat(document.getElementById(`${func.uid}_desconto`)?.value) || 0;
            const adicional = parseFloat(document.getElementById(`${func.uid}_adicional`)?.value) || 0;
            
            // Cálculo final a receber
            const totalReceber = (totalHs * valorHora) + totalAlim + totalTransp + adicional - desconto - totalConsumo;
            
            // Atualizar células de total
            document.getElementById(`${func.uid}_total_hs`).textContent = totalHs.toFixed(1);
            document.getElementById(`${func.uid}_total_alim`).textContent = formatCurrency(totalAlim);
            document.getElementById(`${func.uid}_total_transp`).textContent = formatCurrency(totalTransp);
            document.getElementById(`${func.uid}_consumo`).textContent = formatCurrency(totalConsumo);
            document.getElementById(`${func.uid}_total_receber`).textContent = formatCurrency(Math.max(0, totalReceber));
            
            // Somar aos totais gerais
            totalGeralHs += totalHs;
            totalGeralAlim += totalAlim;
            totalGeralTransp += totalTransp;
            totalGeralConsumo += totalConsumo;
            totalGeralDesconto += desconto;
            totalGeralAdicional += adicional;
            totalGeralReceber += Math.max(0, totalReceber);
        });
        
        // Atualizar totais por dia
        totaisPorDia.forEach((total, index) => {
            const totalDia = total.horas + total.alimentacao + total.transporte - total.consumo;
            document.getElementById(`total_dia_${index}`).textContent = formatCurrency(totalDia);
        });
        
        // Atualizar totais gerais
        document.getElementById('total_geral_hs').textContent = totalGeralHs.toFixed(1);
        document.getElementById('total_geral_alim').textContent = formatCurrency(totalGeralAlim);
        document.getElementById('total_geral_transp').textContent = formatCurrency(totalGeralTransp);
        document.getElementById('total_geral_consumo').textContent = formatCurrency(totalGeralConsumo);
        document.getElementById('total_geral_desconto').textContent = formatCurrency(totalGeralDesconto);
        document.getElementById('total_geral_adicional').textContent = formatCurrency(totalGeralAdicional);
        document.getElementById('total_geral_receber').textContent = formatCurrency(totalGeralReceber);
    }
    
    async function salvarDados() {
        if (!state.dadosAlterados) {
            showStatus('Nenhuma alteração para salvar.', 'info');
            setTimeout(hideStatus, 2000);
            return;
        }
        
        const confirmSave = confirm('Deseja salvar as alterações no fechamento semanal?');
        if (!confirmSave) return;
        
        showStatus('Salvando dados...');
        
        try {
            const batch = db.batch();
            let updateCount = 0;
            
            // Salvar dados de cada dia/funcionário
            for (const func of state.funcionarios) {
                for (let diaIndex = 0; diaIndex < state.diasSemana.length; diaIndex++) {
                    const dia = state.diasSemana[diaIndex];
                    const dateStr = formatDate(dia);
                    
                    // Verificar se existe turno para este dia/funcionário
                    const turnoData = state.turnosData[dateStr]?.[func.uid];
                    if (turnoData?.turnoId) {
                        // Coletar dados atuais
                        const horas = parseFloat(document.getElementById(`${func.uid}_${diaIndex}_hs`)?.value) || 0;
                        const alimentacao = parseFloat(document.getElementById(`${func.uid}_${diaIndex}_alim`)?.value) || 0;
                        const transporteTipo = document.getElementById(`${func.uid}_${diaIndex}_transp_tipo`)?.value || 'nenhum';
                        const transporteValor = state.valoresTransporte[transporteTipo] || 0;
                        
                        // Atualizar documento do turno
                        const turnoRef = db.collection('turnos').doc(turnoData.turnoId);
                        batch.update(turnoRef, {
                            'fechamento.horasTrabalhadas': horas,
                            'fechamento.alimentacao': alimentacao,
                            'fechamento.transporte': {
                                tipo: transporteTipo,
                                valor: transporteValor
                            },
                            'fechamentoSemanal': {
                                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp(),
                                atualizadoPor: auth.currentUser.uid,
                                semana: `${formatDate(state.diasSemana[0])}_${formatDate(state.diasSemana[6])}`
                            }
                        });
                        
                        updateCount++;
                    }
                }
            }
            
            // Salvar configurações
            localStorage.setItem('valorHora', elements.valorHora.value);
            localStorage.setItem('valoresTransporte', JSON.stringify(state.valoresTransporte));
            
            // Executar batch
            await batch.commit();
            
            state.dadosAlterados = false;
            
            showStatus(`✅ ${updateCount} registros salvos com sucesso!`, 'success');
            setTimeout(hideStatus, 3000);
            
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            showError('Erro ao salvar dados: ' + error.message);
        }
    }
    
    // Funções do modal de transporte
    function abrirModalTransporte() {
        updateModalTransporte();
        elements.modalTransporte.classList.remove('hidden');
    }
    
    function fecharModalTransporte() {
        elements.modalTransporte.classList.add('hidden');
    }
    
    function updateModalTransporte() {
        document.getElementById('valorOnibus').value = state.valoresTransporte.onibus || 0;
        document.getElementById('valorMoto').value = state.valoresTransporte.moto || 0;
        document.getElementById('valorCarro').value = state.valoresTransporte.carro || 0;
        document.getElementById('valorOutros').value = state.valoresTransporte.outros || 0;
    }
    
    function salvarConfigTransporte() {
        state.valoresTransporte = {
            onibus: parseFloat(document.getElementById('valorOnibus').value) || 0,
            moto: parseFloat(document.getElementById('valorMoto').value) || 0,
            carro: parseFloat(document.getElementById('valorCarro').value) || 0,
            outros: parseFloat(document.getElementById('valorOutros').value) || 0,
            nenhum: 0
        };
        
        localStorage.setItem('valoresTransporte', JSON.stringify(state.valoresTransporte));
        
        // Recalcular valores de transporte na tabela
        recalcularTotais();
        
        fecharModalTransporte();
        showStatus('Valores de transporte atualizados!', 'success');
        setTimeout(hideStatus, 2000);
    }
    
    // Funções de exportação
    function exportToExcel() {
        try {
            const wb = XLSX.utils.book_new();
            const data = [];
            
            // Cabeçalho principal
            const header1 = ['Funcionário'];
            const header2 = [''];
            
            state.diasSemana.forEach((dia, index) => {
                const diaSemana = CONFIG.diasSemana[index];
                const dataStr = `${dia.getDate()}/${dia.getMonth() + 1}`;
                header1.push(diaSemana + ' ' + dataStr, '', '', '', '');
                header2.push('Horas', 'Alim', 'Transp', 'Tipo', 'Consumo');
            });
            
            header1.push('Total Horas', 'Total Alim', 'Total Transp', 'Consumo', 'Desconto', 'Adicional', 'Total a Receber');
            header2.push('', '', '', '', '', '', '');
            
            data.push(header1);
            data.push(header2);
            
            // Dados dos funcionários
            state.funcionarios.forEach(func => {
                const row = [func.nome];
                
                state.diasSemana.forEach((_, diaIndex) => {
                    const hs = document.getElementById(`${func.uid}_${diaIndex}_hs`)?.value || '';
                    const alim = document.getElementById(`${func.uid}_${diaIndex}_alim`)?.value || '';
                    const tipoTransp = document.getElementById(`${func.uid}_${diaIndex}_transp_tipo`)?.value || '';
                    const valorTransp = state.valoresTransporte[tipoTransp] || 0;
                    const consumo = document.getElementById(`${func.uid}_${diaIndex}_consumo`)?.textContent || '';
                    
                    row.push(hs, alim, valorTransp, tipoTransp, consumo);
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
            
            // Linha de totais
            const totalRow = ['TOTAIS GERAIS'];
            state.diasSemana.forEach((_, index) => {
                const total = document.getElementById(`total_dia_${index}`).textContent;
                totalRow.push(total, '', '', '', '');
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
            
            // Adicionar informações extras
            data.push([]);
            data.push(['Período:', `${formatDate(state.diasSemana[0])} a ${formatDate(state.diasSemana[6])}`]);
            data.push(['Valor Hora:', `R$ ${elements.valorHora.value}`]);
            data.push(['Exportado em:', new Date().toLocaleString('pt-BR')]);
            
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Fechamento Semanal');
            
            const fileName = `Fechamento_Semanal_${formatDate(state.diasSemana[0])}_${formatDate(state.diasSemana[6])}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            showStatus('Excel exportado com sucesso!', 'success');
            setTimeout(hideStatus, 3000);
            
        } catch (error) {
            console.error('Erro ao exportar Excel:', error);
            showError('Erro ao exportar para Excel: ' + error.message);
        }
    }
    
    function exportToPDF() {
        try {
            const element = elements.table.cloneNode(true);
            
            // Remover coluna de ações
            element.querySelectorAll('th:last-child, td:last-child').forEach(el => el.remove());
            
            const opt = {
                margin: 10,
                filename: `Fechamento_Semanal_${formatDate(state.diasSemana[0])}_${formatDate(state.diasSemana[6])}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' }
            };
            
            html2pdf().set(opt).from(element).save();
            
            showStatus('PDF exportado com sucesso!', 'success');
            setTimeout(hideStatus, 3000);
            
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            showError('Erro ao exportar para PDF: ' + error.message);
        }
    }
    
    // Funções utilitárias
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2
        }).format(value || 0);
    }
    
    function showStatus(message, type = 'info') {
        elements.statusContainer.classList.remove('hidden', 'bg-blue-50', 'bg-green-50', 'bg-red-50');
        elements.statusContainer.classList.remove('border-blue-200', 'border-green-200', 'border-red-200');
        elements.statusContainer.classList.remove('text-blue-700', 'text-green-700', 'text-red-700');
        
        if (type === 'success') {
            elements.statusContainer.classList.add('bg-green-50', 'border-green-200', 'text-green-700');
            elements.statusMessage.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
        } else if (type === 'error') {
            elements.statusContainer.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
            elements.statusMessage.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
        } else {
            elements.statusContainer.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-700');
            elements.statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${message}`;
        }
    }
    
    function hideStatus() {
        elements.statusContainer.classList.add('hidden');
    }
    
    function showError(message) {
        showStatus(message, 'error');
        setTimeout(hideStatus, 5000);
    }
    
    // Iniciar aplicação
    init();
});