/**
 * Sistema de Fechamento Semanal V2
 * Pastelaria 24h
 * 
 * Este módulo gerencia o cálculo de pagamentos semanais dos funcionários
 * incluindo horas trabalhadas, benefícios e descontos.
 */

class FechamentoSemanal {
    constructor() {
        // Configurações
        this.CONFIG = {
            transportePadrao: {
                nenhum: 0,
                onibus: 9.60,
                moto: 15.00,
                carro: 20.00,
                outros: 10.00
            },
            valorHoraPadrao: 10.00,
            diasSemana: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
            diasSemanaAbrev: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        };

        // Estado da aplicação
        this.state = {
            funcionarios: [],
            turnosData: {},
            diasSemana: [],
            valoresTransporte: { ...this.CONFIG.transportePadrao },
            dadosAlterados: false,
            tabAtiva: 'resumo',
            fechamentoData: {}
        };

        // Cache de elementos DOM
        this.elements = {
            // Inputs principais
            dataInicio: document.getElementById('dataInicio'),
            dataFim: document.getElementById('dataFim'),
            valorHora: document.getElementById('valorHora'),
            
            // Botões
            btnCarregar: document.getElementById('btnCarregar'),
            btnSalvar: document.getElementById('btnSalvar'),
            btnSemanaAtual: document.getElementById('btnSemanaAtual'),
            btnExportExcel: document.getElementById('btnExportExcel'),
            btnExportPDF: document.getElementById('btnExportPDF'),
            btnConfigTransporte: document.getElementById('btnConfigTransporte'),
            
            // Tabs
            tabResumo: document.getElementById('tabResumo'),
            tabDiario: document.getElementById('tabDiario'),
            tabFuncionarios: document.getElementById('tabFuncionarios'),
            
            // Conteúdo das tabs
            contentResumo: document.getElementById('contentResumo'),
            contentDiario: document.getElementById('contentDiario'),
            contentFuncionarios: document.getElementById('contentFuncionarios'),
            
            // Containers
            statusContainer: document.getElementById('statusContainer'),
            statusMessage: document.getElementById('statusMessage'),
            emptyMessage: document.getElementById('emptyMessage'),
            modalTransporte: document.getElementById('modalTransporte'),
            
            // Cards containers
            funcionariosSummaryCards: document.getElementById('funcionariosSummaryCards'),
            diasSemanaCards: document.getElementById('diasSemanaCards'),
            funcionariosDetailCards: document.getElementById('funcionariosDetailCards'),
            
            // Totais
            totalGeralPagar: document.getElementById('totalGeralPagar'),
            totalGeralHoras: document.getElementById('totalGeralHoras'),
            totalHorasLabel: document.getElementById('totalHorasLabel'),
            totalGeralTransporte: document.getElementById('totalGeralTransporte'),
            totalGeralAlimentacao: document.getElementById('totalGeralAlimentacao'),
            totalGeralDescontos: document.getElementById('totalGeralDescontos')
        };
    }

    async init() {
        console.log('🚀 Iniciando Sistema de Fechamento Semanal V2...');
        
        try {
            // Verificar autenticação
            await this.checkAuth();
            
            // Configurar semana atual
            this.setSemanaAtual();
            
            // Carregar configurações salvas
            await this.loadConfiguracoes();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Carregar dados automaticamente
            await this.carregarDados();
            
            console.log('✅ Sistema inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.showError('Erro ao inicializar o sistema: ' + error.message);
        }
    }

    async checkAuth() {
        return new Promise((resolve, reject) => {
            const unsubscribe = auth.onAuthStateChanged(user => {
                unsubscribe();
                if (user) {
                    console.log('✅ Usuário autenticado:', user.email);
                    resolve(user);
                } else {
                    reject(new Error('Usuário não autenticado'));
                }
            });
        });
    }

    setupEventListeners() {
        // Botões principais
        this.elements.btnCarregar.addEventListener('click', () => this.carregarDados());
        this.elements.btnSalvar.addEventListener('click', () => this.salvarDados());
        this.elements.btnSemanaAtual.addEventListener('click', () => {
            this.setSemanaAtual();
            this.carregarDados();
        });
        
        // Exportações
        this.elements.btnExportExcel.addEventListener('click', () => this.exportToExcel());
        this.elements.btnExportPDF.addEventListener('click', () => this.exportToPDF());
        
        // Modal de transporte
        this.elements.btnConfigTransporte.addEventListener('click', () => this.abrirModalTransporte());
        document.getElementById('btnCancelarTransporte').addEventListener('click', () => this.fecharModalTransporte());
        document.getElementById('btnSalvarTransporte').addEventListener('click', () => this.salvarConfigTransporte());
        
        // Tabs
        this.elements.tabResumo.addEventListener('click', () => this.switchTab('resumo'));
        this.elements.tabDiario.addEventListener('click', () => this.switchTab('diario'));
        this.elements.tabFuncionarios.addEventListener('click', () => this.switchTab('funcionarios'));
        
        // Data início (ajustar para segunda-feira)
        this.elements.dataInicio.addEventListener('change', () => this.ajustarDataSemana());
        
        // Valor hora
        this.elements.valorHora.addEventListener('change', () => {
            this.state.dadosAlterados = true;
            this.recalcularTotais();
        });
        
        // Detectar mudanças gerais
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="number"], select')) {
                this.state.dadosAlterados = true;
                this.recalcularTotais();
            }
        });
        
        // Avisar antes de sair se houver mudanças
        window.addEventListener('beforeunload', (e) => {
            if (this.state.dadosAlterados) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    setSemanaAtual() {
        const hoje = new Date();
        const diaSemana = hoje.getDay();
        
        // Calcular segunda-feira
        const segunda = new Date(hoje);
        const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
        segunda.setDate(hoje.getDate() + diffSegunda);
        
        // Calcular domingo
        const domingo = new Date(segunda);
        domingo.setDate(segunda.getDate() + 6);
        
        this.elements.dataInicio.value = this.formatDate(segunda);
        this.elements.dataFim.value = this.formatDate(domingo);
    }

    ajustarDataSemana() {
        const inicio = new Date(this.elements.dataInicio.value);
        if (!inicio || isNaN(inicio)) return;
        
        // Ajustar para segunda-feira se não for
        const diaSemana = inicio.getDay();
        if (diaSemana !== 1) { // 1 = segunda
            const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
            inicio.setDate(inicio.getDate() + diff);
            this.elements.dataInicio.value = this.formatDate(inicio);
        }
        
        // Definir domingo como fim
        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + 6);
        this.elements.dataFim.value = this.formatDate(fim);
    }

    async loadConfiguracoes() {
        try {
            // Carregar do localStorage
            const savedTransporte = localStorage.getItem('valoresTransporte');
            if (savedTransporte) {
                this.state.valoresTransporte = JSON.parse(savedTransporte);
            }
            
            const savedValorHora = localStorage.getItem('valorHora');
            if (savedValorHora) {
                this.elements.valorHora.value = savedValorHora;
            }
            
            // Também pode carregar do Firebase se necessário
            console.log('✅ Configurações carregadas');
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }

    async carregarDados() {
        this.showStatus('Iniciando carregamento de dados...', 'loading');
        
        try {
            const dataInicio = new Date(this.elements.dataInicio.value);
            const dataFim = new Date(this.elements.dataFim.value);
            
            if (!dataInicio || !dataFim || isNaN(dataInicio) || isNaN(dataFim)) {
                throw new Error('Por favor, selecione as datas corretamente');
            }
            
            if (dataInicio > dataFim) {
                throw new Error('A data inicial não pode ser maior que a data final');
            }
            
            // Gerar array de dias da semana
            this.state.diasSemana = [];
            const currentDate = new Date(dataInicio);
            while (currentDate <= dataFim) {
                this.state.diasSemana.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            // Carregar funcionários
            this.showStatus('Carregando funcionários...', 'loading');
            await this.loadFuncionarios();
            
            // Carregar turnos
            this.showStatus('Carregando turnos da semana...', 'loading');
            await this.loadTurnos(dataInicio, dataFim);
            
            // Carregar dados salvos anteriormente do fechamento
            await this.loadFechamentoData(dataInicio, dataFim);
            
            // Renderizar interface
            this.renderAll();
            
            // Calcular totais
            this.recalcularTotais();
            
            // Ocultar mensagem vazia
            this.elements.emptyMessage.style.display = 'none';
            
            this.state.dadosAlterados = false;
            this.showStatus('Dados carregados com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showError(error.message);
        }
    }

    async loadFuncionarios() {
        try {
            const snapshot = await db.collection('usuarios')
                .where('role', 'in', ['funcionario', 'admin'])
                .get();
            
            this.state.funcionarios = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                this.state.funcionarios.push({
                    uid: doc.id,
                    nome: data.nome || data.displayName || data.email || 'Sem nome',
                    email: data.email,
                    role: data.role,
                    active: data.active !== false
                });
            });
            
            // Filtrar apenas ativos e ordenar por nome
            this.state.funcionarios = this.state.funcionarios
                .filter(f => f.active)
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            
            console.log(`✅ ${this.state.funcionarios.length} funcionários carregados`);
            
        } catch (error) {
            console.error('Erro ao carregar funcionários:', error);
            throw new Error('Falha ao carregar funcionários');
        }
    }

    async loadTurnos(dataInicio, dataFim) {
        try {
            this.state.turnosData = {};
            
            const currentDate = new Date(dataInicio);
            while (currentDate <= dataFim) {
                const dateStr = this.formatDate(currentDate);
                
                // Buscar turnos do dia
                const turnosSnapshot = await db.collection('turnos')
                    .where(firebase.firestore.FieldPath.documentId(), '>=', dateStr)
                    .where(firebase.firestore.FieldPath.documentId(), '<', dateStr + 'z')
                    .where('status', '==', 'fechado')
                    .get();
                
                console.log(`📅 ${dateStr}: ${turnosSnapshot.size} turnos encontrados`);
                
                turnosSnapshot.forEach(doc => {
                    const data = doc.data();
                    const turnoId = doc.id;
                    
                    // Identificar responsável (pode estar em abertura ou fechamento)
                    const responsavelId = data.fechamento?.responsavelId || data.abertura?.responsavelId;
                    const responsavelNome = data.fechamento?.responsavelNome || data.abertura?.responsavelNome;
                    
                    if (!responsavelId) {
                        console.warn(`⚠️ Turno ${turnoId} sem responsável`);
                        return;
                    }
                    
                    // Inicializar estrutura de dados
                    if (!this.state.turnosData[dateStr]) {
                        this.state.turnosData[dateStr] = {};
                    }
                    
                    if (!this.state.turnosData[dateStr][responsavelId]) {
                        this.state.turnosData[dateStr][responsavelId] = {
                            nome: responsavelNome,
                            turnos: []
                        };
                    }
                    
                    // Calcular dados do turno
                    const turnoInfo = {
                        turnoId: turnoId,
                        periodo: turnoId.split('_').pop(),
                        horaAbertura: data.abertura?.hora || '',
                        horaFechamento: data.fechamento?.hora || '',
                        horas: this.calcularHorasTrabalhadas(data.abertura?.hora, data.fechamento?.hora),
                        consumo: this.calcularConsumoTotal(data),
                        data: data
                    };
                    
                    this.state.turnosData[dateStr][responsavelId].turnos.push(turnoInfo);
                });
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            console.log('✅ Turnos carregados:', this.state.turnosData);
            
        } catch (error) {
            console.error('Erro ao carregar turnos:', error);
            throw new Error('Falha ao carregar turnos');
        }
    }

    async loadFechamentoData(dataInicio, dataFim) {
        try {
            // Buscar documento de fechamento da semana se existir
            const semanaId = `${this.formatDate(dataInicio)}_${this.formatDate(dataFim)}`;
            const fechamentoDoc = await db.collection('fechamentos_semanais').doc(semanaId).get();
            
            if (fechamentoDoc.exists) {
                const data = fechamentoDoc.data();
                this.state.fechamentoData = data.funcionarios || {};
                console.log('✅ Dados de fechamento anteriores carregados');
            } else {
                this.state.fechamentoData = {};
                console.log('ℹ️ Nenhum fechamento anterior encontrado');
            }
        } catch (error) {
            console.error('Erro ao carregar fechamento:', error);
            this.state.fechamentoData = {};
        }
    }

    calcularHorasTrabalhadas(horaInicio, horaFim) {
        if (!horaInicio || !horaFim) return 0;
        
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

    calcularConsumoTotal(turnoData) {
        let consumoTotal = 0;
        
        // Função auxiliar para processar itens de uma categoria
        const processarCategoria = (categoria, nomeCategoria) => {
            if (!categoria) return;
            
            Object.entries(categoria).forEach(([key, item]) => {
                if (item && typeof item === 'object' && item.consumo && item.consumo > 0) {
                    const precoUnitario = item.precoUnitario || 0;
                    const valorConsumo = item.consumo * precoUnitario;
                    if (valorConsumo > 0) {
                        console.log(`  ${nomeCategoria} ${key}: ${item.consumo} x R$ ${precoUnitario} = R$ ${valorConsumo.toFixed(2)}`);
                        consumoTotal += valorConsumo;
                    }
                }
            });
        };
        
        // Processar todas as categorias
        if (turnoData.itens) {
            processarCategoria(turnoData.itens.pasteis, '🥟');
            processarCategoria(turnoData.itens.caldo_cana, '🥤');
            processarCategoria(turnoData.itens.casquinhas, '🍦');
            processarCategoria(turnoData.itens.refrigerantes, '🥤');
        }
        
        // Consumo de gelo
        if (turnoData.gelo?.gelo_pacote?.consumoInterno && turnoData.gelo.gelo_pacote.consumoInterno > 0) {
            const valorGelo = turnoData.gelo.gelo_pacote.consumoInterno * (turnoData.gelo.gelo_pacote.precoUnitario || 0);
            if (valorGelo > 0) {
                console.log(`  🧊 Gelo: ${turnoData.gelo.gelo_pacote.consumoInterno} x R$ ${turnoData.gelo.gelo_pacote.precoUnitario} = R$ ${valorGelo.toFixed(2)}`);
                consumoTotal += valorGelo;
            }
        }
        
        return consumoTotal;
    }

    renderAll() {
        // Renderizar conteúdo baseado na tab ativa
        switch (this.state.tabAtiva) {
            case 'resumo':
                this.renderResumo();
                break;
            case 'diario':
                this.renderVisualizacaoDiaria();
                break;
            case 'funcionarios':
                this.renderPorFuncionario();
                break;
        }
    }

    renderResumo() {
        // Renderizar cards de resumo dos funcionários
        this.elements.funcionariosSummaryCards.innerHTML = '';
        
        this.state.funcionarios.forEach(func => {
            const dadosFuncionario = this.calcularDadosFuncionario(func.uid);
            
            const card = document.createElement('div');
            card.className = 'employee-summary-card p-6 animate-slide-in';
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${func.nome}</h3>
                        <p class="text-sm text-gray-500">
                            ${func.role === 'admin' ? '👑 Administrador' : '👤 Funcionário'}
                            • ${dadosFuncionario.diasTrabalhados} dias
                        </p>
                    </div>
                    <span class="text-2xl font-bold ${dadosFuncionario.totalReceber >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${this.formatCurrency(dadosFuncionario.totalReceber)}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-xs text-gray-500">Horas</p>
                        <p class="text-sm font-semibold">${dadosFuncionario.totalHoras.toFixed(1)}h • ${this.formatCurrency(dadosFuncionario.totalHorasValor)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Transporte</p>
                        <p class="text-sm font-semibold">${this.formatCurrency(dadosFuncionario.totalTransporte)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Alimentação</p>
                        <p class="text-sm font-semibold">${this.formatCurrency(dadosFuncionario.totalAlimentacao)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Consumo</p>
                        <p class="text-sm font-semibold text-red-600">-${this.formatCurrency(dadosFuncionario.totalConsumo)}</p>
                    </div>
                </div>
                
                <div class="mt-4 pt-4 border-t border-gray-100">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs text-gray-500">Adicional</label>
                            <input type="number" 
                                   id="${func.uid}_adicional"
                                   value="${dadosFuncionario.adicional}"
                                   min="0" step="0.01" 
                                   class="w-full mt-1 px-2 py-1 text-sm text-green-600 font-semibold border rounded focus:ring-1 focus:ring-green-500"
                                   placeholder="0.00">
                        </div>
                        <div>
                            <label class="text-xs text-gray-500">Desconto</label>
                            <input type="number" 
                                   id="${func.uid}_desconto"
                                   value="${dadosFuncionario.desconto}"
                                   min="0" step="0.01" 
                                   class="w-full mt-1 px-2 py-1 text-sm text-red-600 font-semibold border rounded focus:ring-1 focus:ring-red-500"
                                   placeholder="0.00">
                        </div>
                    </div>
                </div>
            `;
            
            this.elements.funcionariosSummaryCards.appendChild(card);
        });
    }

    renderVisualizacaoDiaria() {
        this.elements.diasSemanaCards.innerHTML = '';
        
        this.state.diasSemana.forEach((dia, index) => {
            const dateStr = this.formatDate(dia);
            const diaSemana = this.CONFIG.diasSemana[index];
            
            const card = document.createElement('div');
            card.className = 'day-card p-6 rounded-xl animate-slide-in';
            
            let conteudoDia = `
                <h3 class="text-lg font-semibold text-gray-800 mb-4">
                    ${diaSemana} ${dia.getDate()}/${dia.getMonth() + 1}
                </h3>
                <div class="space-y-3">
            `;
            
            // Listar funcionários que trabalharam neste dia
            let funcionariosDia = 0;
            
            this.state.funcionarios.forEach(func => {
                const dadosDia = this.obterDadosDiaFuncionario(func.uid, dateStr);
                
                if (dadosDia.trabalhou) {
                    funcionariosDia++;
                    
                    conteudoDia += `
                        <div class="bg-gray-50 p-3 rounded-lg">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-sm font-medium text-gray-700">${func.nome}</span>
                                <span class="text-xs text-gray-500">${dadosDia.horas.toFixed(1)}h</span>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <label class="text-gray-500">Horas</label>
                                    <input type="number" 
                                           id="${func.uid}_${index}_horas"
                                           value="${dadosDia.horas}"
                                           min="0" max="24" step="0.5"
                                           class="w-full px-2 py-1 border rounded text-sm">
                                </div>
                                <div>
                                    <label class="text-gray-500">Alim.</label>
                                    <input type="number" 
                                           id="${func.uid}_${index}_alimentacao"
                                           value="${dadosDia.alimentacao}"
                                           min="0" step="0.01"
                                           class="w-full px-2 py-1 border rounded text-sm">
                                </div>
                                <div>
                                    <label class="text-gray-500">Transp.</label>
                                    <select id="${func.uid}_${index}_transporte"
                                            class="w-full px-2 py-1 border rounded text-sm">
                                        <option value="nenhum" ${dadosDia.transporteTipo === 'nenhum' ? 'selected' : ''}>-</option>
                                        <option value="onibus" ${dadosDia.transporteTipo === 'onibus' ? 'selected' : ''}>🚌 Ônibus</option>
                                        <option value="moto" ${dadosDia.transporteTipo === 'moto' ? 'selected' : ''}>🏍️ Moto</option>
                                        <option value="carro" ${dadosDia.transporteTipo === 'carro' ? 'selected' : ''}>🚗 Carro</option>
                                        <option value="outros" ${dadosDia.transporteTipo === 'outros' ? 'selected' : ''}>📍 Outros</option>
                                    </select>
                                </div>
                                <div class="text-center pt-4">
                                    <span class="text-red-600 font-medium">
                                        Consumo: ${this.formatCurrency(dadosDia.consumo)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });
            
            if (funcionariosDia === 0) {
                conteudoDia += `
                    <div class="text-center py-4 text-gray-400">
                        <i class="fas fa-calendar-times text-2xl mb-2"></i>
                        <p class="text-sm">Nenhum funcionário trabalhou neste dia</p>
                    </div>
                `;
            }
            
            conteudoDia += '</div>';
            
            card.innerHTML = conteudoDia;
            this.elements.diasSemanaCards.appendChild(card);
        });
    }

    renderPorFuncionario() {
        this.elements.funcionariosDetailCards.innerHTML = '';
        
        this.state.funcionarios.forEach(func => {
            const dadosFuncionario = this.calcularDadosFuncionario(func.uid);
            
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm p-6 animate-slide-in';
            
            let detalheDias = '<div class="grid grid-cols-7 gap-2 mt-4">';
            
            this.state.diasSemana.forEach((dia, index) => {
                const dateStr = this.formatDate(dia);
                const dadosDia = this.obterDadosDiaFuncionario(func.uid, dateStr);
                
                detalheDias += `
                    <div class="${dadosDia.trabalhou ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-2 text-center">
                        <p class="text-xs font-medium text-gray-600">${this.CONFIG.diasSemanaAbrev[index]}</p>
                        <p class="text-sm font-bold ${dadosDia.trabalhou ? 'text-green-600' : 'text-gray-400'}">
                            ${dadosDia.trabalhou ? dadosDia.horas.toFixed(1) + 'h' : '-'}
                        </p>
                        ${dadosDia.trabalhou ? `
                            <p class="text-xs text-gray-500 mt-1">
                                ${this.getTransporteIcon(dadosDia.transporteTipo)}
                            </p>
                        ` : ''}
                    </div>
                `;
            });
            
            detalheDias += '</div>';
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-xl font-semibold text-gray-800">${func.nome}</h3>
                        <p class="text-sm text-gray-500">
                            ${func.role === 'admin' ? '👑 Administrador' : '👤 Funcionário'}
                            • ${func.email}
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-500">Total a Receber</p>
                        <p class="text-2xl font-bold ${dadosFuncionario.totalReceber >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${this.formatCurrency(dadosFuncionario.totalReceber)}
                        </p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-blue-50 p-3 rounded-lg text-center">
                        <i class="fas fa-clock text-blue-600 text-xl mb-1"></i>
                        <p class="text-xs text-gray-600">Horas</p>
                        <p class="font-semibold">${dadosFuncionario.totalHoras.toFixed(1)}h</p>
                        <p class="text-sm text-blue-600">${this.formatCurrency(dadosFuncionario.totalHorasValor)}</p>
                    </div>
                    
                    <div class="bg-purple-50 p-3 rounded-lg text-center">
                        <i class="fas fa-bus text-purple-600 text-xl mb-1"></i>
                        <p class="text-xs text-gray-600">Transporte</p>
                        <p class="font-semibold text-purple-600">${this.formatCurrency(dadosFuncionario.totalTransporte)}</p>
                    </div>
                    
                    <div class="bg-orange-50 p-3 rounded-lg text-center">
                        <i class="fas fa-utensils text-orange-600 text-xl mb-1"></i>
                        <p class="text-xs text-gray-600">Alimentação</p>
                        <p class="font-semibold text-orange-600">${this.formatCurrency(dadosFuncionario.totalAlimentacao)}</p>
                    </div>
                    
                    <div class="bg-red-50 p-3 rounded-lg text-center">
                        <i class="fas fa-shopping-cart text-red-600 text-xl mb-1"></i>
                        <p class="text-xs text-gray-600">Consumo</p>
                        <p class="font-semibold text-red-600">-${this.formatCurrency(dadosFuncionario.totalConsumo)}</p>
                    </div>
                </div>
                
                <h4 class="text-sm font-semibold text-gray-700 mb-2">Dias Trabalhados</h4>
                ${detalheDias}
                
                <div class="mt-6 pt-6 border-t border-gray-200">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                <i class="fas fa-plus-circle text-green-500 mr-1"></i>Adicional
                            </label>
                            <input type="number" 
                                   id="${func.uid}_detail_adicional"
                                   value="${dadosFuncionario.adicional}"
                                   min="0" step="0.01" 
                                   class="w-full px-3 py-2 text-green-600 font-semibold border rounded-lg focus:ring-2 focus:ring-green-500"
                                   placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                <i class="fas fa-minus-circle text-red-500 mr-1"></i>Desconto Extra
                            </label>
                            <input type="number" 
                                   id="${func.uid}_detail_desconto"
                                   value="${dadosFuncionario.desconto}"
                                   min="0" step="0.01" 
                                   class="w-full px-3 py-2 text-red-600 font-semibold border rounded-lg focus:ring-2 focus:ring-red-500"
                                   placeholder="0.00">
                        </div>
                    </div>
                </div>
            `;
            
            this.elements.funcionariosDetailCards.appendChild(card);
        });
    }

    calcularDadosFuncionario(uid) {
        let totalHoras = 0;
        let totalAlimentacao = 0;
        let totalTransporte = 0;
        let totalConsumo = 0;
        let diasTrabalhados = 0;
        
        // Percorrer todos os dias da semana
        this.state.diasSemana.forEach((dia, index) => {
            const dateStr = this.formatDate(dia);
            const dadosDia = this.obterDadosDiaFuncionario(uid, dateStr);
            
            if (dadosDia.trabalhou) {
                totalHoras += dadosDia.horas;
                totalAlimentacao += dadosDia.alimentacao;
                totalTransporte += this.state.valoresTransporte[dadosDia.transporteTipo] || 0;
                totalConsumo += dadosDia.consumo;
                diasTrabalhados++;
            }
        });
        
        // Obter adicionais e descontos
        const adicional = this.obterValorInput(`${uid}_adicional`) || 
                         this.obterValorInput(`${uid}_detail_adicional`) || 0;
        const desconto = this.obterValorInput(`${uid}_desconto`) || 
                        this.obterValorInput(`${uid}_detail_desconto`) || 0;
        
        const valorHora = parseFloat(this.elements.valorHora.value) || 0;
        const totalHorasValor = totalHoras * valorHora;
        
        const totalReceber = totalHorasValor + totalAlimentacao + totalTransporte + adicional - desconto - totalConsumo;
        
        return {
            totalHoras,
            totalHorasValor,
            totalAlimentacao,
            totalTransporte,
            totalConsumo,
            adicional,
            desconto,
            totalReceber,
            diasTrabalhados
        };
    }

    obterDadosDiaFuncionario(uid, dateStr) {
        // Primeiro verifica se há turnos registrados
        const turnosDia = this.state.turnosData[dateStr]?.[uid];
        
        // Dados salvos do fechamento (se existir)
        const dadosSalvos = this.state.fechamentoData[uid]?.[dateStr] || {};
        
        if (turnosDia && turnosDia.turnos.length > 0) {
            // Somar dados de todos os turnos do dia
            let horasTotal = 0;
            let consumoTotal = 0;
            
            turnosDia.turnos.forEach(turno => {
                horasTotal += turno.horas;
                consumoTotal += turno.consumo;
            });
            
            // Usar dados salvos se existirem, senão usar calculados
            return {
                trabalhou: true,
                horas: dadosSalvos.horas !== undefined ? dadosSalvos.horas : horasTotal,
                alimentacao: dadosSalvos.alimentacao || 0,
                transporteTipo: dadosSalvos.transporteTipo || 'nenhum',
                consumo: consumoTotal, // Sempre usar o consumo calculado do turno
                turnos: turnosDia.turnos
            };
        }
        
        return {
            trabalhou: false,
            horas: 0,
            alimentacao: 0,
            transporteTipo: 'nenhum',
            consumo: 0,
            turnos: []
        };
    }

    obterValorInput(id) {
        const element = document.getElementById(id);
        return element ? parseFloat(element.value) || 0 : 0;
    }

    recalcularTotais() {
        let totalGeralHoras = 0;
        let totalGeralHorasValor = 0;
        let totalGeralAlimentacao = 0;
        let totalGeralTransporte = 0;
        let totalGeralConsumo = 0;
        let totalGeralReceber = 0;
        
        // Calcular totais para cada funcionário
        this.state.funcionarios.forEach(func => {
            const dados = this.calcularDadosFuncionario(func.uid);
            
            totalGeralHoras += dados.totalHoras;
            totalGeralHorasValor += dados.totalHorasValor;
            totalGeralAlimentacao += dados.totalAlimentacao;
            totalGeralTransporte += dados.totalTransporte;
            totalGeralConsumo += dados.totalConsumo;
            totalGeralReceber += Math.max(0, dados.totalReceber);
        });
        
        // Atualizar elementos do DOM
        this.elements.totalGeralPagar.textContent = this.formatCurrency(totalGeralReceber);
        this.elements.totalGeralHoras.textContent = this.formatCurrency(totalGeralHorasValor);
        this.elements.totalHorasLabel.textContent = `${totalGeralHoras.toFixed(1)}h`;
        this.elements.totalGeralTransporte.textContent = this.formatCurrency(totalGeralTransporte);
        this.elements.totalGeralAlimentacao.textContent = this.formatCurrency(totalGeralAlimentacao);
        this.elements.totalGeralDescontos.textContent = this.formatCurrency(totalGeralConsumo);
    }

    async salvarDados() {
        if (!this.state.dadosAlterados) {
            this.showStatus('Nenhuma alteração para salvar', 'info');
            return;
        }
        
        const confirmSave = confirm('Deseja salvar todas as alterações do fechamento semanal?');
        if (!confirmSave) return;
        
        this.showStatus('Salvando dados...', 'loading');
        
        try {
            const batch = db.batch();
            const semanaId = `${this.formatDate(this.state.diasSemana[0])}_${this.formatDate(this.state.diasSemana[6])}`;
            
            // Preparar dados para salvar
            const dadosFechamento = {
                semanaInicio: this.formatDate(this.state.diasSemana[0]),
                semanaFim: this.formatDate(this.state.diasSemana[6]),
                valorHora: parseFloat(this.elements.valorHora.value),
                valoresTransporte: this.state.valoresTransporte,
                funcionarios: {},
                totais: {
                    geral: 0,
                    horas: 0,
                    transporte: 0,
                    alimentacao: 0,
                    consumo: 0
                },
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                atualizadoPor: auth.currentUser.uid
            };
            
            // Processar dados de cada funcionário
            this.state.funcionarios.forEach(func => {
                dadosFechamento.funcionarios[func.uid] = {
                    nome: func.nome,
                    diasTrabalhados: {}
                };
                
                // Processar cada dia
                this.state.diasSemana.forEach((dia, index) => {
                    const dateStr = this.formatDate(dia);
                    const dadosDia = this.obterDadosDiaFuncionario(func.uid, dateStr);
                    
                    if (dadosDia.trabalhou) {
                        // Obter valores dos inputs
                        const horasInput = document.getElementById(`${func.uid}_${index}_horas`);
                        const alimentacaoInput = document.getElementById(`${func.uid}_${index}_alimentacao`);
                        const transporteSelect = document.getElementById(`${func.uid}_${index}_transporte`);
                        
                        const horas = horasInput ? parseFloat(horasInput.value) || 0 : dadosDia.horas;
                        const alimentacao = alimentacaoInput ? parseFloat(alimentacaoInput.value) || 0 : dadosDia.alimentacao;
                        const transporteTipo = transporteSelect ? transporteSelect.value : dadosDia.transporteTipo;
                        
                        dadosFechamento.funcionarios[func.uid].diasTrabalhados[dateStr] = {
                            horas: horas,
                            alimentacao: alimentacao,
                            transporteTipo: transporteTipo,
                            transporteValor: this.state.valoresTransporte[transporteTipo] || 0,
                            consumo: dadosDia.consumo,
                            turnos: dadosDia.turnos.map(t => t.turnoId)
                        };
                        
                        // Atualizar cada turno com os dados do fechamento
                        dadosDia.turnos.forEach(turno => {
                            const turnoRef = db.collection('turnos').doc(turno.turnoId);
                            batch.update(turnoRef, {
                                'fechamentoSemanal': {
                                    semanaId: semanaId,
                                    horasFechamento: horas,
                                    alimentacao: alimentacao,
                                    transporte: {
                                        tipo: transporteTipo,
                                        valor: this.state.valoresTransporte[transporteTipo] || 0
                                    },
                                    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                                    atualizadoPor: auth.currentUser.uid
                                }
                            });
                        });
                    }
                });
                
                // Adicionar adicionais e descontos
                const adicional = this.obterValorInput(`${func.uid}_adicional`) || 
                                 this.obterValorInput(`${func.uid}_detail_adicional`) || 0;
                const desconto = this.obterValorInput(`${func.uid}_desconto`) || 
                                this.obterValorInput(`${func.uid}_detail_desconto`) || 0;
                
                dadosFechamento.funcionarios[func.uid].adicional = adicional;
                dadosFechamento.funcionarios[func.uid].desconto = desconto;
                
                // Calcular totais do funcionário
                const dadosFunc = this.calcularDadosFuncionario(func.uid);
                dadosFechamento.funcionarios[func.uid].totais = {
                    horas: dadosFunc.totalHoras,
                    horasValor: dadosFunc.totalHorasValor,
                    alimentacao: dadosFunc.totalAlimentacao,
                    transporte: dadosFunc.totalTransporte,
                    consumo: dadosFunc.totalConsumo,
                    totalReceber: Math.max(0, dadosFunc.totalReceber)
                };
                
                // Somar aos totais gerais
                dadosFechamento.totais.geral += Math.max(0, dadosFunc.totalReceber);
                dadosFechamento.totais.horas += dadosFunc.totalHorasValor;
                dadosFechamento.totais.transporte += dadosFunc.totalTransporte;
                dadosFechamento.totais.alimentacao += dadosFunc.totalAlimentacao;
                dadosFechamento.totais.consumo += dadosFunc.totalConsumo;
            });
            
            // Salvar documento principal do fechamento
            const fechamentoRef = db.collection('fechamentos_semanais').doc(semanaId);
            batch.set(fechamentoRef, dadosFechamento, { merge: true });
            
            // Executar batch
            await batch.commit();
            
            // Salvar configurações locais
            localStorage.setItem('valorHora', this.elements.valorHora.value);
            localStorage.setItem('valoresTransporte', JSON.stringify(this.state.valoresTransporte));
            
            this.state.dadosAlterados = false;
            this.showStatus('✅ Dados salvos com sucesso!', 'success');
            
            console.log('✅ Fechamento salvo:', dadosFechamento);
            
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            this.showError('Erro ao salvar: ' + error.message);
        }
    }

    // Funções auxiliares
    switchTab(tab) {
        // Remover active de todas as tabs
        [this.elements.tabResumo, this.elements.tabDiario, this.elements.tabFuncionarios].forEach(t => {
            t.classList.remove('active', 'bg-primary-100', 'text-primary-700');
        });
        
        // Ocultar todo conteúdo
        [this.elements.contentResumo, this.elements.contentDiario, this.elements.contentFuncionarios].forEach(c => {
            c.classList.add('hidden');
        });
        
        // Ativar tab selecionada
        switch (tab) {
            case 'resumo':
                this.elements.tabResumo.classList.add('active', 'bg-primary-100', 'text-primary-700');
                this.elements.contentResumo.classList.remove('hidden');
                break;
            case 'diario':
                this.elements.tabDiario.classList.add('active', 'bg-primary-100', 'text-primary-700');
                this.elements.contentDiario.classList.remove('hidden');
                break;
            case 'funcionarios':
                this.elements.tabFuncionarios.classList.add('active', 'bg-primary-100', 'text-primary-700');
                this.elements.contentFuncionarios.classList.remove('hidden');
                break;
        }
        
        this.state.tabAtiva = tab;
        this.renderAll();
    }

    getTransporteIcon(tipo) {
        const icons = {
            nenhum: '-',
            onibus: '🚌',
            moto: '🏍️',
            carro: '🚗',
            outros: '📍'
        };
        return icons[tipo] || '-';
    }

    // Modal de transporte
    abrirModalTransporte() {
        document.getElementById('valorOnibus').value = this.state.valoresTransporte.onibus;
        document.getElementById('valorMoto').value = this.state.valoresTransporte.moto;
        document.getElementById('valorCarro').value = this.state.valoresTransporte.carro;
        document.getElementById('valorOutros').value = this.state.valoresTransporte.outros;
        
        this.elements.modalTransporte.classList.remove('hidden');
    }

    fecharModalTransporte() {
        this.elements.modalTransporte.classList.add('hidden');
    }

    salvarConfigTransporte() {
        this.state.valoresTransporte = {
            nenhum: 0,
            onibus: parseFloat(document.getElementById('valorOnibus').value) || 0,
            moto: parseFloat(document.getElementById('valorMoto').value) || 0,
            carro: parseFloat(document.getElementById('valorCarro').value) || 0,
            outros: parseFloat(document.getElementById('valorOutros').value) || 0
        };
        
        localStorage.setItem('valoresTransporte', JSON.stringify(this.state.valoresTransporte));
        
        this.state.dadosAlterados = true;
        this.recalcularTotais();
        this.fecharModalTransporte();
        
        this.showStatus('Valores de transporte atualizados!', 'success');
    }

    // Exportações
    async exportToExcel() {
        try {
            const wb = XLSX.utils.book_new();
            
            // Planilha 1: Resumo Geral
            const resumoData = [
                ['FECHAMENTO SEMANAL - PASTELARIA 24H'],
                [''],
                ['Período:', `${this.formatDate(this.state.diasSemana[0])} a ${this.formatDate(this.state.diasSemana[6])}`],
                ['Valor Hora:', `R$ ${this.elements.valorHora.value}`],
                [''],
                ['RESUMO GERAL'],
                ['Total a Pagar:', this.elements.totalGeralPagar.textContent],
                ['Total Horas:', `${this.elements.totalHorasLabel.textContent} - ${this.elements.totalGeralHoras.textContent}`],
                ['Total Transporte:', this.elements.totalGeralTransporte.textContent],
                ['Total Alimentação:', this.elements.totalGeralAlimentacao.textContent],
                ['Total Descontos:', this.elements.totalGeralDescontos.textContent],
                [''],
                ['RESUMO POR FUNCIONÁRIO']
            ];
            
            // Adicionar dados de cada funcionário
            this.state.funcionarios.forEach(func => {
                const dados = this.calcularDadosFuncionario(func.uid);
                resumoData.push([
                    func.nome,
                    `${dados.totalHoras.toFixed(1)}h`,
                    this.formatCurrency(dados.totalHorasValor),
                    this.formatCurrency(dados.totalTransporte),
                    this.formatCurrency(dados.totalAlimentacao),
                    this.formatCurrency(dados.totalConsumo),
                    this.formatCurrency(dados.adicional),
                    this.formatCurrency(dados.desconto),
                    this.formatCurrency(dados.totalReceber)
                ]);
            });
            
            const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
            XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
            
            // Planilha 2: Detalhamento Diário
            const detalheData = [['Funcionário']];
            
            // Header com dias
            this.state.diasSemana.forEach((dia, index) => {
                detalheData[0].push(`${this.CONFIG.diasSemanaAbrev[index]} ${dia.getDate()}/${dia.getMonth() + 1}`);
            });
            detalheData[0].push('Total');
            
            // Dados por funcionário
            this.state.funcionarios.forEach(func => {
                const row = [func.nome];
                let totalFunc = 0;
                
                this.state.diasSemana.forEach(dia => {
                    const dateStr = this.formatDate(dia);
                    const dadosDia = this.obterDadosDiaFuncionario(func.uid, dateStr);
                    
                    if (dadosDia.trabalhou) {
                        const valor = (dadosDia.horas * parseFloat(this.elements.valorHora.value)) + 
                                    this.state.valoresTransporte[dadosDia.transporteTipo] + 
                                    dadosDia.alimentacao - 
                                    dadosDia.consumo;
                        row.push(this.formatCurrency(valor));
                        totalFunc += valor;
                    } else {
                        row.push('-');
                    }
                });
                
                row.push(this.formatCurrency(totalFunc));
                detalheData.push(row);
            });
            
            const wsDetalhe = XLSX.utils.aoa_to_sheet(detalheData);
            XLSX.utils.book_append_sheet(wb, wsDetalhe, 'Detalhamento');
            
            // Salvar arquivo
            const fileName = `Fechamento_Semanal_${this.formatDate(this.state.diasSemana[0])}_${this.formatDate(this.state.diasSemana[6])}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            this.showStatus('Excel exportado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar Excel:', error);
            this.showError('Erro ao exportar: ' + error.message);
        }
    }

    async exportToPDF() {
        try {
            const element = document.createElement('div');
            element.style.padding = '20px';
            element.style.fontFamily = 'Arial, sans-serif';
            
            element.innerHTML = `
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #EA580C;">Fechamento Semanal</h1>
                    <h2 style="color: #666;">Pastelaria 24h</h2>
                    <p style="font-size: 14px; color: #888;">
                        Período: ${this.formatDate(this.state.diasSemana[0])} a ${this.formatDate(this.state.diasSemana[6])}
                    </p>
                </div>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
                    <h3 style="color: #333; margin-bottom: 15px;">Resumo Geral</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                                <strong>Total a Pagar:</strong>
                            </td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-size: 20px; color: #16A34A;">
                                <strong>${this.elements.totalGeralPagar.textContent}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">Total Horas:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">
                                ${this.elements.totalHorasLabel.textContent} - ${this.elements.totalGeralHoras.textContent}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">Total Transporte:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">
                                ${this.elements.totalGeralTransporte.textContent}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">Total Alimentação:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">
                                ${this.elements.totalGeralAlimentacao.textContent}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;">Total Descontos:</td>
                            <td style="padding: 10px; text-align: right; color: #DC2626;">
                                ${this.elements.totalGeralDescontos.textContent}
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div>
                    <h3 style="color: #333; margin-bottom: 15px;">Detalhamento por Funcionário</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f0f0f0;">
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Funcionário</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Horas</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.state.funcionarios.map(func => {
                                const dados = this.calcularDadosFuncionario(func.uid);
                                return `
                                    <tr>
                                        <td style="padding: 10px; border: 1px solid #ddd;">${func.nome}</td>
                                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                                            ${dados.totalHoras.toFixed(1)}h
                                        </td>
                                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
                                            ${this.formatCurrency(dados.totalReceber)}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 50px; text-align: center; color: #888; font-size: 12px;">
                    <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
                    <p>Por: ${auth.currentUser.email}</p>
                </div>
            `;
            
            const opt = {
                margin: 10,
                filename: `Fechamento_${this.formatDate(this.state.diasSemana[0])}_${this.formatDate(this.state.diasSemana[6])}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            await html2pdf().set(opt).from(element).save();
            
            this.showStatus('PDF exportado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            this.showError('Erro ao exportar: ' + error.message);
        }
    }

    // Utilitários
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    showStatus(message, type = 'info') {
        this.elements.statusContainer.classList.remove('hidden', 'bg-blue-50', 'bg-green-50', 'bg-red-50');
        this.elements.statusContainer.classList.remove('border-blue-200', 'border-green-200', 'border-red-200');
        this.elements.statusContainer.classList.remove('text-blue-700', 'text-green-700', 'text-red-700');
        
        switch (type) {
            case 'loading':
                this.elements.statusContainer.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-700');
                this.elements.statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${message}`;
                break;
            case 'success':
                this.elements.statusContainer.classList.add('bg-green-50', 'border-green-200', 'text-green-700');
                this.elements.statusMessage.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
                setTimeout(() => this.hideStatus(), 3000);
                break;
            case 'error':
                this.elements.statusContainer.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
                this.elements.statusMessage.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
                setTimeout(() => this.hideStatus(), 10000);
                break;
            default:
                this.elements.statusContainer.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-700');
                this.elements.statusMessage.innerHTML = `<i class="fas fa-info-circle mr-2"></i>${message}`;
                setTimeout(() => this.hideStatus(), 5000);
        }
    }

    hideStatus() {
        this.elements.statusContainer.classList.add('hidden');
    }

    showError(message) {
        this.showStatus(message, 'error');
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação
    if (typeof protectRoute === 'function') {
        protectRoute(['admin']);
    }
    
    // Criar e inicializar o sistema
    const fechamento = new FechamentoSemanal();
    await fechamento.init();
    
    // Exportar para uso global se necessário
    window.fechamentoSemanal = fechamento;
});