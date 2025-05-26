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
        dadosAlterados: false,
        detalhesVisiveis: false
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
        modalTransporte: document.getElementById('modalTransporte'),
        toggleDetalhes: document.getElementById('toggleDetalhes'),
        detalhesSection: document.getElementById('detalhesSection'),
        funcionariosCards: document.getElementById('funcionariosCards'),
        resumoTotalSection: document.getElementById('resumoTotalSection'),
        resumoFuncionariosSection: document.getElementById('resumoFuncionariosSection')
    };
    
    // Inicialização
    async function init() {
        console.log('🚀 Iniciando sistema de fechamento semanal v3...');
        
        // Ocultar seções inicialmente
        elements.resumoTotalSection.style.display = 'none';
        elements.resumoFuncionariosSection.style.display = 'none';
        
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
        
        // Toggle detalhes
        elements.toggleDetalhes.addEventListener('click', () => {
            state.detalhesVisiveis = !state.detalhesVisiveis;
            
            if (state.detalhesVisiveis) {
                elements.detalhesSection.classList.add('open');
                elements.toggleDetalhes.innerHTML = '<i class="fas fa-eye-slash mr-1"></i>Ocultar Detalhes Diários';
            } else {
                elements.detalhesSection.classList.remove('open');
                elements.toggleDetalhes.innerHTML = '<i class="fas fa-eye mr-1"></i>Mostrar Detalhes Diários';
            }
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
        
        // Detectar mudanças nos inputs
        document.addEventListener('input', (e) => {
            if (e.target.matches('input[type="number"], select')) {
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
            
            // Mostrar seções
            elements.emptyMessage.style.display = 'none';
            elements.resumoTotalSection.style.display = 'block';
            elements.resumoFuncionariosSection.style.display = 'block';
            
            // Construir interface
            buildFuncionariosCards();
            buildDetalhesTable();
            
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
    
    function buildFuncionariosCards() {
        elements.funcionariosCards.innerHTML = '';
        
        state.funcionarios.forEach(func => {
            const card = document.createElement('div');
            card.className = 'employee-card p-6';
            card.dataset.uid = func.uid;
            
            // Calcular totais do funcionário
            let totalHoras = 0;
            let totalAlimentacao = 0;
            let totalTransporte = 0;
            let totalConsumo = 0;
            let diasTrabalhados = 0;
            
            state.diasSemana.forEach(dia => {
                const dateStr = formatDate(dia);
                const turnoData = state.turnosData[dateStr]?.[func.uid];
                if (turnoData) {
                    totalHoras += turnoData.horas || 0;
                    totalAlimentacao += turnoData.alimentacao || 0;
                    totalTransporte += turnoData.transporteValor || 0;
                    totalConsumo += turnoData.consumo || 0;
                    if (turnoData.horas > 0) diasTrabalhados++;
                }
            });
            
            const valorHora = parseFloat(elements.valorHora.value) || 0;
            const totalHorasValor = totalHoras * valorHora;
            
            card.innerHTML = `
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${func.nome}</h3>
                        <p class="text-sm text-gray-500">
                            ${func.role === 'admin' ? '👑 Administrador' : '👤 Funcionário'}
                            <span class="ml-2">${diasTrabalhados} dias trabalhados</span>
                        </p>
                    </div>
                    <button class="text-primary-600 hover:text-primary-700" onclick="toggleFuncionarioDetalhes('${func.uid}')">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                
                <div class="space-y-3">
                    <!-- Horas -->
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">
                            <i class="fas fa-clock mr-2 text-blue-500"></i>
                            Horas (${totalHoras.toFixed(1)}h)
                        </span>
                        <span class="font-semibold text-gray-800">${formatCurrency(totalHorasValor)}</span>
                    </div>
                    
                    <!-- Alimentação -->
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">
                            <i class="fas fa-utensils mr-2 text-green-500"></i>
                            Alimentação
                        </span>
                        <span class="font-semibold text-gray-800">${formatCurrency(totalAlimentacao)}</span>
                    </div>
                    
                    <!-- Transporte -->
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">
                            <i class="fas fa-bus mr-2 text-purple-500"></i>
                            Transporte
                        </span>
                        <span class="font-semibold text-gray-800">${formatCurrency(totalTransporte)}</span>
                    </div>
                    
                    <!-- Consumo -->
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">
                            <i class="fas fa-shopping-cart mr-2 text-red-500"></i>
                            Consumo
                        </span>
                        <span class="font-semibold text-red-600">-${formatCurrency(totalConsumo)}</span>
                    </div>
                    
                    <!-- Adicional/Desconto -->
                    <div class="flex space-x-4">
                        <div class="flex-1">
                            <label class="text-xs text-gray-500">Adicional</label>
                            <input type="number" 
                                   id="${func.uid}_adicional"
                                   value="0"
                                   min="0" step="0.01" 
                                   class="w-full mt-1 px-2 py-1 text-sm text-green-600 font-semibold border rounded focus:ring-1 focus:ring-green-500"
                                   placeholder="0">
                        </div>
                        <div class="flex-1">
                            <label class="text-xs text-gray-500">Desconto</label>
                            <input type="number" 
                                   id="${func.uid}_desconto"
                                   value="0"
                                   min="0" step="0.01" 
                                   class="w-full mt-1 px-2 py-1 text-sm text-red-600 font-semibold border rounded focus:ring-1 focus:ring-red-500"
                                   placeholder="0">
                        </div>
                    </div>
                    
                    <!-- Total -->
                    <div class="pt-3 mt-3 border-t border-gray-200">
                        <div class="flex justify-between items-center">
                            <span class="text-base font-semibold text-gray-700">Total a Receber</span>
                            <span id="${func.uid}_total_receber" class="text-xl font-bold text-green-600">R$ 0,00</span>
                        </div>
                    </div>
                </div>
                
                <!-- Detalhes expandidos (oculto por padrão) -->
                <div id="detalhes_${func.uid}" class="hidden mt-4 pt-4 border-t border-gray-200">
                    <!-- Detalhes diários serão inseridos aqui se necessário -->
                </div>
            `;
            
            elements.funcionariosCards.appendChild(card);
        });
    }
    
    function buildDetalhesTable() {
        const table = document.getElementById('tabelaDetalhes');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        
        // Construir cabeçalho
        thead.innerHTML = `
            <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Funcionário</th>
                ${state.diasSemana.map((dia, index) => `
                    <th colspan="4" class="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase border-l">
                        ${CONFIG.diasSemana[index]} ${dia.getDate()}/${dia.getMonth() + 1}
                    </th>
                `).join('')}
            </tr>
            <tr>
                <th></th>
                ${state.diasSemana.map(() => `
                    <th class="px-1 py-1 text-center text-xs text-gray-600">Hs</th>
                    <th class="px-1 py-1 text-center text-xs text-gray-600">Alim</th>
                    <th class="px-1 py-1 text-center text-xs text-gray-600">Transp</th>
                    <th class="px-1 py-1 text-center text-xs text-gray-600 border-r">Cons</th>
                `).join('')}
            </tr>
        `;
        
        // Construir corpo
        tbody.innerHTML = state.funcionarios.map(func => {
            let rowHtml = `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-4 py-2 text-sm font-medium text-gray-900">${func.nome}</td>
            `;
            
            state.diasSemana.forEach((dia, diaIndex) => {
                const dateStr = formatDate(dia);
                const turnoData = state.turnosData[dateStr]?.[func.uid] || {};
                
                rowHtml += `
                    <td class="px-1 py-1">
                        <input type="number" 
                               id="${func.uid}_${diaIndex}_hs"
                               value="${turnoData.horas ? turnoData.horas.toFixed(1) : ''}"
                               min="0" max="24" step="0.5" 
                               class="compact-input w-full text-center border rounded"
                               placeholder="0">
                    </td>
                    <td class="px-1 py-1">
                        <input type="number" 
                               id="${func.uid}_${diaIndex}_alim"
                               value="${turnoData.alimentacao || ''}"
                               min="0" step="0.01" 
                               class="compact-input w-full text-center border rounded"
                               placeholder="0">
                    </td>
                    <td class="px-1 py-1">
                        <select id="${func.uid}_${diaIndex}_transp_tipo"
                                class="compact-input w-full text-center border rounded"
                                data-uid="${func.uid}"
                                data-dia="${diaIndex}">
                            <option value="nenhum" ${turnoData.transporteTipo === 'nenhum' ? 'selected' : ''}>-</option>
                            <option value="onibus" ${turnoData.transporteTipo === 'onibus' ? 'selected' : ''}>🚌</option>
                            <option value="moto" ${turnoData.transporteTipo === 'moto' ? 'selected' : ''}>🏍️</option>
                            <option value="carro" ${turnoData.transporteTipo === 'carro' ? 'selected' : ''}>🚗</option>
                            <option value="outros" ${turnoData.transporteTipo === 'outros' ? 'selected' : ''}>📍</option>
                        </select>
                    </td>
                    <td class="px-1 py-1 border-r text-center">
                        <span class="text-xs font-medium text-red-600">
                            ${turnoData.consumo ? formatCurrency(turnoData.consumo) : '-'}
                        </span>
                    </td>
                `;
            });
            
            rowHtml += '</tr>';
            return rowHtml;
        }).join('');
        
        // Adicionar listeners para mudanças de transporte
        document.querySelectorAll('select[id*="_transp_tipo"]').forEach(select => {
            select.addEventListener('change', (e) => {
                recalcularTotais();
            });
        });
    }
    
    function recalcularTotais() {
        const valorHora = parseFloat(elements.valorHora.value) || 0;
        
        let totalGeralHoras = 0;
        let totalGeralHorasValor = 0;
        let totalGeralAlimentacao = 0;
        let totalGeralTransporte = 0;
        let totalGeralConsumo = 0;
        let totalGeralDescontos = 0;
        let totalGeralAdicionais = 0;
        let totalGeralReceber = 0;
        
        // Calcular para cada funcionário
        state.funcionarios.forEach(func => {
            let totalHoras = 0;
            let totalAlim = 0;
            let totalTransp = 0;
            let totalConsumo = 0;
            
            // Somar valores de cada dia
            state.diasSemana.forEach((dia, diaIndex) => {
                // Horas
                const hsInput = document.getElementById(`${func.uid}_${diaIndex}_hs`);
                const hs = hsInput ? parseFloat(hsInput.value) || 0 : 0;
                
                // Alimentação
                const alimInput = document.getElementById(`${func.uid}_${diaIndex}_alim`);
                const alim = alimInput ? parseFloat(alimInput.value) || 0 : 0;
                
                // Transporte
                const tipoTranspSelect = document.getElementById(`${func.uid}_${diaIndex}_transp_tipo`);
                const tipoTransp = tipoTranspSelect ? tipoTranspSelect.value : 'nenhum';
                const valorTransp = state.valoresTransporte[tipoTransp] || 0;
                
                // Consumo do dia
                const dateStr = formatDate(dia);
                const consumoDia = state.turnosData[dateStr]?.[func.uid]?.consumo || 0;
                
                totalHoras += hs;
                totalAlim += alim;
                totalTransp += valorTransp;
                totalConsumo += consumoDia;
            });
            
            // Descontos e adicionais
            const descontoInput = document.getElementById(`${func.uid}_desconto`);
            const adicionalInput = document.getElementById(`${func.uid}_adicional`);
            
            const desconto = descontoInput ? parseFloat(descontoInput.value) || 0 : 0;
            const adicional = adicionalInput ? parseFloat(adicionalInput.value) || 0 : 0;
            
            // Cálculo final a receber
            const totalHorasValor = totalHoras * valorHora;
            const totalReceber = totalHorasValor + totalAlim + totalTransp + adicional - desconto - totalConsumo;
            
            // Atualizar card do funcionário
            const totalReceberElement = document.getElementById(`${func.uid}_total_receber`);
            if (totalReceberElement) {
                totalReceberElement.textContent = formatCurrency(Math.max(0, totalReceber));
            }
            
            // Somar aos totais gerais
            totalGeralHoras += totalHoras;
            totalGeralHorasValor += totalHorasValor;
            totalGeralAlimentacao += totalAlim;
            totalGeralTransporte += totalTransp;
            totalGeralConsumo += totalConsumo;
            totalGeralDescontos += desconto;
            totalGeralAdicionais += adicional;
            totalGeralReceber += Math.max(0, totalReceber);
        });
        
        // Atualizar resumo total
        document.getElementById('totalGeralPagar').textContent = formatCurrency(totalGeralReceber);
        document.getElementById('totalGeralHoras').textContent = formatCurrency(totalGeralHorasValor);
        document.getElementById('totalHorasLabel').textContent = `${totalGeralHoras.toFixed(1)}h`;
        document.getElementById('totalGeralBeneficios').textContent = formatCurrency(totalGeralAlimentacao + totalGeralTransporte);
        document.getElementById('totalGeralDescontos').textContent = formatCurrency(totalGeralConsumo + totalGeralDescontos);
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
                        const hsInput = document.getElementById(`${func.uid}_${diaIndex}_hs`);
                        const alimInput = document.getElementById(`${func.uid}_${diaIndex}_alim`);
                        const transpSelect = document.getElementById(`${func.uid}_${diaIndex}_transp_tipo`);
                        
                        const horas = hsInput ? parseFloat(hsInput.value) || 0 : 0;
                        const alimentacao = alimInput ? parseFloat(alimInput.value) || 0 : 0;
                        const transporteTipo = transpSelect ? transpSelect.value : 'nenhum';
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
        
        // Recalcular valores de transporte
        recalcularTotais();
        
        fecharModalTransporte();
        showStatus('Valores de transporte atualizados!', 'success');
        setTimeout(hideStatus, 2000);
    }
    
    // Funções de exportação
    function exportToExcel() {
        try {
            const wb = XLSX.utils.book_new();
            
            // Planilha 1: Resumo
            const resumoData = [
                ['FECHAMENTO SEMANAL - RESUMO'],
                ['Período:', `${formatDate(state.diasSemana[0])} a ${formatDate(state.diasSemana[6])}`],
                ['Valor Hora:', `R$ ${elements.valorHora.value}`],
                [''],
                ['RESUMO GERAL'],
                ['Total a Pagar:', document.getElementById('totalGeralPagar').textContent],
                ['Total Horas:', document.getElementById('totalHorasLabel').textContent],
                ['Total Benefícios:', document.getElementById('totalGeralBeneficios').textContent],
                ['Total Descontos:', document.getElementById('totalGeralDescontos').textContent],
                [''],
                ['DETALHAMENTO POR FUNCIONÁRIO']
            ];
            
            state.funcionarios.forEach(func => {
                const totalElement = document.getElementById(`${func.uid}_total_receber`);
                resumoData.push([func.nome, totalElement ? totalElement.textContent : 'R$ 0,00']);
            });
            
            const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
            XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
            
            // Planilha 2: Detalhes (se visível)
            if (state.detalhesVisiveis) {
                const detalhesData = [];
                
                // Cabeçalho
                const header1 = ['Funcionário'];
                const header2 = [''];
                
                state.diasSemana.forEach((dia, index) => {
                    const diaSemana = CONFIG.diasSemana[index];
                    const dataStr = `${dia.getDate()}/${dia.getMonth() + 1}`;
                    header1.push(diaSemana + ' ' + dataStr, '', '', '');
                    header2.push('Horas', 'Alim', 'Transp', 'Consumo');
                });
                
                detalhesData.push(header1);
                detalhesData.push(header2);
                
                // Dados
                state.funcionarios.forEach(func => {
                    const row = [func.nome];
                    
                    state.diasSemana.forEach((_, diaIndex) => {
                        const hsInput = document.getElementById(`${func.uid}_${diaIndex}_hs`);
                        const alimInput = document.getElementById(`${func.uid}_${diaIndex}_alim`);
                        const transpSelect = document.getElementById(`${func.uid}_${diaIndex}_transp_tipo`);
                        
                        const hs = hsInput ? hsInput.value : '';
                        const alim = alimInput ? alimInput.value : '';
                        const tipoTransp = transpSelect ? transpSelect.value : '';
                        const valorTransp = state.valoresTransporte[tipoTransp] || 0;
                        
                        row.push(hs, alim, valorTransp, '');
                    });
                    
                    detalhesData.push(row);
                });
                
                const wsDetalhes = XLSX.utils.aoa_to_sheet(detalhesData);
                XLSX.utils.book_append_sheet(wb, wsDetalhes, 'Detalhes');
            }
            
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
            // Criar elemento temporário com o conteúdo a exportar
            const tempDiv = document.createElement('div');
            tempDiv.style.padding = '20px';
            
            tempDiv.innerHTML = `
                <h1 style="text-align: center; margin-bottom: 20px;">Fechamento Semanal</h1>
                <p style="text-align: center; margin-bottom: 30px;">
                    Período: ${formatDate(state.diasSemana[0])} a ${formatDate(state.diasSemana[6])}
                </p>
                
                <div style="margin-bottom: 30px;">
                    <h2>Resumo Geral</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">Total a Pagar:</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
                                ${document.getElementById('totalGeralPagar').textContent}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">Total Horas:</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">
                                ${document.getElementById('totalHorasLabel').textContent}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">Total Benefícios:</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">
                                ${document.getElementById('totalGeralBeneficios').textContent}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">Total Descontos:</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">
                                ${document.getElementById('totalGeralDescontos').textContent}
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div>
                    <h2>Detalhamento por Funcionário</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Funcionário</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total a Receber</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${state.funcionarios.map(func => {
                                const totalElement = document.getElementById(`${func.uid}_total_receber`);
                                return `
                                    <tr>
                                        <td style="padding: 8px; border: 1px solid #ddd;">${func.nome}</td>
                                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
                                            ${totalElement ? totalElement.textContent : 'R$ 0,00'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            const opt = {
                margin: 10,
                filename: `Fechamento_Semanal_${formatDate(state.diasSemana[0])}_${formatDate(state.diasSemana[6])}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            html2pdf().set(opt).from(tempDiv).save();
            
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
    
    // Função global para toggle de detalhes do funcionário
    window.toggleFuncionarioDetalhes = function(uid) {
        const detalhesDiv = document.getElementById(`detalhes_${uid}`);
        const chevron = document.querySelector(`[data-uid="${uid}"] .fa-chevron-down`);
        
        if (detalhesDiv.classList.contains('hidden')) {
            detalhesDiv.classList.remove('hidden');
            chevron.classList.add('rotate-180');
        } else {
            detalhesDiv.classList.add('hidden');
            chevron.classList.remove('rotate-180');
        }
    };
    
    // Iniciar aplicação
    init();
});