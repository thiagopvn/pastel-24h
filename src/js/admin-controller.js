document.addEventListener('DOMContentLoaded', async () => {
    protectRoute(['admin']);

    // Configurações globais
    const CONFIG = {
        AUTO_REFRESH_INTERVAL: 300000, // 5 minutos
        TOAST_DURATION: 5000,
        CHART_ANIMATION_DURATION: 800,
        REALTIME_ENABLED: true,
        DEBUG_MODE: false
    };

    // Formatadores
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const formatPercent = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format((value || 0) / 100);
    };

    const formatNumber = (value) => {
        return new Intl.NumberFormat('pt-BR').format(value || 0);
    };

    const formatDateTime = (date) => {
        return new Intl.DateTimeFormat('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    // Estado global da aplicação
    let appState = {
        currentData: {
            vendas: 0,
            ticket: 0,
            pedidos: 0,
            divergencias: 0,
            caixa: 0,
            lucro: 0,
            turnos: [],
            alertas: [],
            timeline: []
        },
        filters: {
            period: 'today',
            startDate: null,
            endDate: null,
            turno: '',
            pagamento: '',
            funcionario: ''
        },
        charts: {
            payment: null,
            products: null,
            salesHours: null
        },
        realTimeListeners: [],
        currentPrices: {},
        users: []
    };

    // Listas de produtos
    const PRODUTOS = {
        pasteis: [
            "Carne", "Frango", "Queijo", "Pizza", "Bauru", "Calabresa", "Palmito",
            "Especial de Carne", "Especial de Frango", "Especial de Calabresa"
        ],
        casquinhas: [
            "Casquinha Simples", "Casquinha com Cobertura", "Casquinha com Granulado"
        ],
        caldo_cana: [
            "Caldo de Cana 300ml", "Caldo de Cana 500ml", "Caldo de Cana 700ml", "Caldo de Cana 1litro"
        ],
        refrigerantes: [
            "Coca-Cola 350ml", "Coca-Cola 600ml", "Coca-Cola 2L",
            "Guaraná 350ml", "Guaraná 600ml", "Guaraná 2L",
            "Fanta Laranja 350ml", "Fanta Laranja 600ml", "Fanta Laranja 2L",
            "Fanta Uva 350ml", "Sprite 350ml", "Água Mineral 500ml"
        ],
        gelo: ["Gelo (Pacote)"]
    };

    // Sistema de Toast/Notificações
    class ToastManager {
        constructor() {
            this.container = document.getElementById('toast-container');
            this.toasts = new Map();
        }

        show(message, type = 'info', duration = CONFIG.TOAST_DURATION, persistent = false) {
            const toastId = Date.now() + Math.random();
            const toast = this.createToast(message, type, toastId);
            
            this.container.appendChild(toast);
            this.toasts.set(toastId, toast);

            // Animação de entrada
            setTimeout(() => toast.classList.add('show'), 100);

            if (!persistent) {
                setTimeout(() => this.hide(toastId), duration);
            }

            return toastId;
        }

        createToast(message, type, id) {
            const toast = document.createElement('div');
            toast.className = `toast bg-white border-l-4 rounded-lg shadow-lg p-4 mb-2 transform transition-all duration-300 opacity-0 translate-x-full`;
            
            const colors = {
                success: 'border-success-500 text-success-800',
                error: 'border-danger-500 text-danger-800',
                warning: 'border-warning-500 text-warning-800',
                info: 'border-blue-500 text-blue-800'
            };
            
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            
            toast.classList.add(...colors[type].split(' '));
            toast.dataset.toastId = id;
            
            toast.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${icons[type]} mr-3 text-lg"></i>
                    <span class="flex-1 font-medium">${message}</span>
                    <button onclick="toastManager.hide('${id}')" class="ml-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            return toast;
        }

        hide(toastId) {
            const toast = this.toasts.get(toastId);
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.parentElement.removeChild(toast);
                    }
                    this.toasts.delete(toastId);
                }, 300);
            }
        }

        clear() {
            this.toasts.forEach((toast, id) => this.hide(id));
        }
    }

    const toastManager = new ToastManager();

    // Gerenciador de Dados
    class DataManager {
        constructor() {
            this.cache = new Map();
            this.cacheTimeout = 60000; // 1 minuto
        }

        async getTurnos(filters = {}) {
            const cacheKey = JSON.stringify(filters);
            const cached = this.cache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }

            try {
                let query = db.collection('turnos').where('status', '==', 'fechado');
                
                if (filters.startDate && filters.endDate) {
                    const startId = `${filters.startDate}_Manhã`;
                    const endId = `${filters.endDate}_Noite`;
                    query = query.orderBy(firebase.firestore.FieldPath.documentId())
                                 .startAt(startId)
                                 .endAt(endId);
                } else {
                    const date30DaysAgo = new Date();
                    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
                    const startDateString = date30DaysAgo.toISOString().split('T')[0];
                    query = query.orderBy(firebase.firestore.FieldPath.documentId(), 'desc')
                                 .where(firebase.firestore.FieldPath.documentId(), '>=', `${startDateString}_Manhã`);
                }

                const snapshot = await query.get();
                const turnos = [];
                snapshot.forEach(doc => {
                    const data = { id: doc.id, ...doc.data() };
                    
                    // Aplicar filtros adicionais
                    if (filters.turno && !data.id.includes(filters.turno)) return;
                    if (filters.funcionario && data.abertura?.responsavelNome !== filters.funcionario) return;
                    
                    turnos.push(data);
                });

                this.cache.set(cacheKey, { data: turnos, timestamp: Date.now() });
                return turnos;
                
            } catch (error) {
                console.error('Erro ao buscar turnos:', error);
                throw error;
            }
        }

        async getTurnosAbertos() {
            try {
                const snapshot = await db.collection('turnos').where('status', '==', 'aberto').get();
                const turnos = [];
                snapshot.forEach(doc => turnos.push({ id: doc.id, ...doc.data() }));
                return turnos;
            } catch (error) {
                console.error('Erro ao buscar turnos abertos:', error);
                return [];
            }
        }

        async getPrecos() {
            try {
                const snapshot = await db.collection('produtos').get();
                const precos = {};
                snapshot.forEach(doc => {
                    precos[doc.id] = doc.data();
                });
                return precos;
            } catch (error) {
                console.error('Erro ao buscar preços:', error);
                return {};
            }
        }

        async getUsuarios() {
            try {
                const snapshot = await db.collection('usuarios').get();
                const usuarios = [];
                snapshot.forEach(doc => usuarios.push({ id: doc.id, ...doc.data() }));
                return usuarios;
            } catch (error) {
                console.error('Erro ao buscar usuários:', error);
                return [];
            }
        }

        clearCache() {
            this.cache.clear();
        }
    }

    const dataManager = new DataManager();

    // Gerenciador de KPIs
    class KPIManager {
        constructor() {
            this.elements = {
                vendas: document.getElementById('kpiVendas'),
                ticket: document.getElementById('kpiTicket'),
                pedidos: document.getElementById('kpiPedidos'),
                divergencias: document.getElementById('kpiDivergencias'),
                caixa: document.getElementById('kpiCaixa'),
                lucro: document.getElementById('kpiLucro')
            };
            this.trends = {
                vendas: document.getElementById('kpiVendasTrend'),
                ticket: document.getElementById('kpiTicketTrend'),
                pedidos: document.getElementById('kpiPedidosTrend'),
                divergencias: document.getElementById('kpiDivergenciasTrend'),
                caixa: document.getElementById('kpiCaixaTrend'),
                lucro: document.getElementById('kpiLucroTrend')
            };
        }

        async update(turnos) {
            const kpis = this.calculateKPIs(turnos);
            const previousKPIs = this.getPreviousKPIs(turnos);
            
            this.updateDisplays(kpis);
            this.updateTrends(kpis, previousKPIs);
            
            appState.currentData = { ...appState.currentData, ...kpis };
            
            return kpis;
        }

        calculateKPIs(turnos) {
            let totalVendas = 0;
            let totalPedidos = turnos.length;
            let totalDivergencias = 0;
            let totalCaixa = 0;
            
            turnos.forEach(turno => {
                totalVendas += turno.totalVendidoCalculadoFinal || 0;
                totalCaixa += turno.caixaFinalContado || 0;
                
                const vendidoCalc = turno.totalVendidoCalculadoFinal || 0;
                const pagamentosReg = turno.totalRegistradoPagamentosFinal || 0;
                const diffCaixa = turno.diferencaCaixaFinal || 0;
                
                if (Math.abs(vendidoCalc - pagamentosReg) > 0.01 || Math.abs(diffCaixa) > 0.01) {
                    totalDivergencias++;
                }
            });
            
            const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
            const percentualDivergencias = totalPedidos > 0 ? (totalDivergencias / totalPedidos) * 100 : 0;
            const lucroEstimado = totalVendas * 0.35; // 35% de margem estimada
            
            return {
                vendas: totalVendas,
                ticket: ticketMedio,
                pedidos: totalPedidos,
                divergencias: percentualDivergencias,
                caixa: totalCaixa,
                lucro: lucroEstimado
            };
        }

        getPreviousKPIs(turnos) {
            // Simular dados do período anterior para cálculo de tendência
            const previousVendas = Math.random() * 1000 + 500;
            const previousTicket = Math.random() * 50 + 15;
            const previousPedidos = Math.floor(Math.random() * 50) + 10;
            
            return {
                vendas: previousVendas,
                ticket: previousTicket,
                pedidos: previousPedidos,
                divergencias: Math.random() * 10,
                caixa: Math.random() * 2000 + 500,
                lucro: previousVendas * 0.35
            };
        }

        updateDisplays(kpis) {
            this.elements.vendas.textContent = formatCurrency(kpis.vendas);
            this.elements.ticket.textContent = formatCurrency(kpis.ticket);
            this.elements.pedidos.textContent = formatNumber(kpis.pedidos);
            this.elements.divergencias.textContent = formatPercent(kpis.divergencias);
            this.elements.caixa.textContent = formatCurrency(kpis.caixa);
            this.elements.lucro.textContent = formatCurrency(kpis.lucro);
        }

        updateTrends(current, previous) {
            Object.keys(current).forEach(key => {
                const trendElement = this.trends[key];
                if (!trendElement) return;
                
                const currentValue = current[key];
                const previousValue = previous[key];
                const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
                
                const isPositive = change >= 0;
                const icon = trendElement.querySelector('i');
                const span = trendElement.querySelector('span');
                
                if (icon && span) {
                    icon.className = `fas ${isPositive ? 'fa-arrow-up' : 'fa-arrow-down'} ${isPositive ? 'text-success-500' : 'text-danger-500'} mr-1`;
                    span.textContent = `${Math.abs(change).toFixed(1)}%`;
                }
            });
        }
    }

    const kpiManager = new KPIManager();

    // Gerenciador de Gráficos
    class ChartManager {
        constructor() {
            this.charts = {};
            this.colors = {
                primary: '#F97316',
                success: '#22C55E',
                danger: '#EF4444',
                warning: '#F59E0B',
                info: '#3B82F6',
                purple: '#8B5CF6'
            };
        }

        async updateAll(turnos) {
            await Promise.all([
                this.updatePaymentChart(turnos),
                this.updateProductsChart(turnos),
                this.updateSalesHoursChart(turnos)
            ]);
        }

        updatePaymentChart(turnos) {
            const pagamentos = {
                'Dinheiro': 0,
                'PIX Manual': 0,
                'Stone D/C/V': 0,
                'Stone Voucher': 0,
                'PagBank D/C/V': 0
            };
            
            turnos.forEach(turno => {
                if (turno.formasPagamento) {
                    pagamentos['Dinheiro'] += turno.formasPagamento.dinheiro || 0;
                    pagamentos['PIX Manual'] += turno.formasPagamento.pixManual || 0;
                    pagamentos['Stone D/C/V'] += turno.formasPagamento.stoneDCV || 0;
                    pagamentos['Stone Voucher'] += turno.formasPagamento.stoneVoucher || 0;
                    pagamentos['PagBank D/C/V'] += turno.formasPagamento.pagbankDCV || 0;
                }
            });
            
            const ctx = document.getElementById('paymentChart');
            if (!ctx) return;
            
            if (this.charts.payment) {
                this.charts.payment.destroy();
            }
            
            this.charts.payment = new Chart(ctx.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: Object.keys(pagamentos),
                    datasets: [{
                        data: Object.values(pagamentos),
                        backgroundColor: [
                            this.colors.primary,
                            this.colors.success,
                            this.colors.info,
                            this.colors.purple,
                            this.colors.danger
                        ],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverBorderWidth: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    animation: {
                        duration: CONFIG.CHART_ANIMATION_DURATION
                    }
                }
            });
        }

        updateProductsChart(turnos) {
            const produtos = {};
            
            turnos.forEach(turno => {
                if (turno.itens) {
                    Object.values(turno.itens).forEach(categoria => {
                        Object.entries(categoria).forEach(([itemKey, itemData]) => {
                            if (itemData && typeof itemData.vendido === 'number' && itemData.vendido > 0) {
                                const nomeAmigavel = this.formatItemName(itemKey);
                                if (!produtos[nomeAmigavel]) produtos[nomeAmigavel] = 0;
                                produtos[nomeAmigavel] += itemData.vendido;
                            }
                        });
                    });
                }
                
                if (turno.gelo && turno.gelo.gelo_pacote && turno.gelo.gelo_pacote.vendas > 0) {
                    if (!produtos['Gelo']) produtos['Gelo'] = 0;
                    produtos['Gelo'] += turno.gelo.gelo_pacote.vendas;
                }
            });
            
            const sortedProducts = Object.entries(produtos)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);
            
            const ctx = document.getElementById('productsChart');
            if (!ctx) return;
            
            if (this.charts.products) {
                this.charts.products.destroy();
            }
            
            this.charts.products = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: sortedProducts.map(([nome]) => nome),
                    datasets: [{
                        label: 'Quantidade Vendida',
                        data: sortedProducts.map(([, qtd]) => qtd),
                        backgroundColor: this.colors.primary,
                        borderColor: this.colors.primary,
                        borderWidth: 1,
                        borderRadius: 8,
                        borderSkipped: false
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.label}: ${formatNumber(context.raw)} unidades`
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        y: {
                            grid: {
                                display: false
                            }
                        }
                    },
                    animation: {
                        duration: CONFIG.CHART_ANIMATION_DURATION
                    }
                }
            });
        }

        updateSalesHoursChart(turnos, period = 'today') {
            const hoursData = {};
            
            // Inicializar com zeros
            for (let i = 0; i < 24; i++) {
                hoursData[i] = 0;
            }
            
            turnos.forEach(turno => {
                if (turno.abertura && turno.abertura.hora) {
                    const hora = parseInt(turno.abertura.hora.split(':')[0]);
                    if (hora >= 0 && hora <= 23) {
                        hoursData[hora] += turno.totalVendidoCalculadoFinal || 0;
                    }
                }
            });
            
            const ctx = document.getElementById('salesHoursChart');
            if (!ctx) return;
            
            if (this.charts.salesHours) {
                this.charts.salesHours.destroy();
            }
            
            this.charts.salesHours = new Chart(ctx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: Object.keys(hoursData).map(h => `${h.padStart(2, '0')}:00`),
                    datasets: [{
                        label: 'Vendas por Hora',
                        data: Object.values(hoursData),
                        borderColor: this.colors.primary,
                        backgroundColor: `${this.colors.primary}20`,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: this.colors.primary,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `Vendas: ${formatCurrency(context.raw)}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => formatCurrency(value)
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        }
                    },
                    animation: {
                        duration: CONFIG.CHART_ANIMATION_DURATION
                    }
                }
            });
        }

        formatItemName(itemKey) {
            return itemKey.replace(/_/g, ' ')
                         .replace(/\b\w/g, l => l.toUpperCase())
                         .replace(/Especial De/g, 'Especial de');
        }

        destroy() {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            this.charts = {};
        }
    }

    const chartManager = new ChartManager();

    // Gerenciador de Alertas
    class AlertManager {
        constructor() {
            this.container = document.getElementById('alertsContainer');
            this.countElement = document.getElementById('alertsCount');
            this.currentAlerts = [];
        }

        async update() {
            try {
                const turnos = await dataManager.getTurnos();
                const alertas = this.generateAlerts(turnos);
                this.currentAlerts = alertas;
                this.render(alertas);
                this.updateCount(alertas.length);
            } catch (error) {
                console.error('Erro ao atualizar alertas:', error);
                toastManager.show('Erro ao carregar alertas', 'error');
            }
        }

        generateAlerts(turnos) {
            const alertas = [];
            
            turnos.forEach(turno => {
                const vendidoCalc = turno.totalVendidoCalculadoFinal || 0;
                const pagamentosReg = turno.totalRegistradoPagamentosFinal || 0;
                const diffVendasPagamentos = vendidoCalc - pagamentosReg;
                const diffCaixa = turno.diferencaCaixaFinal || 0;
                
                if (Math.abs(diffVendasPagamentos) > 0.01 || Math.abs(diffCaixa) > 0.01) {
                    const severity = this.calculateSeverity(diffVendasPagamentos, diffCaixa);
                    
                    alertas.push({
                        id: `alert_${turno.id}_${Date.now()}`,
                        turnoId: turno.id,
                        severity: severity,
                        title: 'Divergência Detectada',
                        message: `Turno ${turno.id.split('_')[1]} - ${this.formatDate(turno.id.split('_')[0])}`,
                        details: {
                            vendidoCalc,
                            pagamentosReg,
                            diffVendasPagamentos,
                            diffCaixa,
                            responsavel: turno.fechamento?.responsavelNome || 'N/A',
                            periodo: turno.id.split('_')[1] || 'N/A'
                        },
                        timestamp: turno.closedAt?.toDate() || new Date(),
                        resolved: false
                    });
                }
            });
            
            return alertas.sort((a, b) => b.timestamp - a.timestamp);
        }

        calculateSeverity(diffVendas, diffCaixa) {
            const maxDiff = Math.max(Math.abs(diffVendas), Math.abs(diffCaixa));
            if (maxDiff > 100) return 'critical';
            if (maxDiff > 20) return 'warning';
            return 'info';
        }

        formatDate(dateString) {
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
        }

        render(alertas) {
            if (alertas.length === 0) {
                this.container.innerHTML = `
                    <div class="flex items-center justify-center py-12 text-gray-500">
                        <div class="text-center">
                            <i class="fas fa-check-circle text-4xl mb-4 text-success-500"></i>
                            <p class="text-lg font-medium">Nenhum alerta no momento</p>
                            <p class="text-sm text-gray-400 mt-1">Todos os turnos estão em conformidade</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            this.container.innerHTML = alertas.map(alerta => `
                <div class="alert-item severity-${alerta.severity} p-4 rounded-lg table-row-hover cursor-pointer transition-all duration-200 hover:shadow-md" 
                     data-alert-id="${alerta.id}">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center mb-2">
                                <i class="fas ${this.getSeverityIcon(alerta.severity)} text-lg mr-3"></i>
                                <h4 class="font-semibold text-gray-800">${alerta.title}</h4>
                                <span class="ml-3 px-3 py-1 text-xs font-medium rounded-full ${this.getSeverityBadgeClass(alerta.severity)}">
                                    ${this.getSeverityText(alerta.severity)}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600 mb-1">${alerta.message}</p>
                            <div class="flex items-center space-x-4 text-xs text-gray-500">
                                <span><i class="fas fa-user mr-1"></i>${alerta.details.responsavel}</span>
                                <span><i class="fas fa-clock mr-1"></i>${formatDateTime(alerta.timestamp)}</span>
                                <span><i class="fas fa-coins mr-1"></i>Diferença: ${formatCurrency(Math.abs(alerta.details.diffVendasPagamentos))}</span>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2 ml-4">
                            <button class="resolve-alert-btn bg-success-500 hover:bg-success-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                    data-alert-id="${alerta.id}">
                                <i class="fas fa-check mr-1"></i>Resolver
                            </button>
                            <i class="fas fa-chevron-right text-gray-400"></i>
                        </div>
                    </div>
                </div>
            `).join('');
            
            this.attachEventListeners();
        }

        getSeverityIcon(severity) {
            const icons = {
                critical: 'fa-exclamation-triangle text-danger-500',
                warning: 'fa-exclamation-circle text-warning-500',
                info: 'fa-info-circle text-blue-500'
            };
            return icons[severity] || icons.info;
        }

        getSeverityBadgeClass(severity) {
            const classes = {
                critical: 'bg-danger-100 text-danger-800',
                warning: 'bg-warning-100 text-warning-800',
                info: 'bg-blue-100 text-blue-800'
            };
            return classes[severity] || classes.info;
        }

        getSeverityText(severity) {
            const texts = {
                critical: 'Crítico',
                warning: 'Atenção',
                info: 'Informação'
            };
            return texts[severity] || texts.info;
        }

        attachEventListeners() {
            this.container.querySelectorAll('[data-alert-id]').forEach(element => {
                element.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('resolve-alert-btn')) {
                        const alertId = element.dataset.alertId;
                        const alerta = this.currentAlerts.find(a => a.id === alertId);
                        if (alerta) this.showAlertModal(alerta);
                    }
                });
            });
            
            this.container.querySelectorAll('.resolve-alert-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const alertId = btn.dataset.alertId;
                    this.resolveAlert(alertId);
                });
            });
        }

        showAlertModal(alerta) {
            const modal = document.getElementById('alertModal');
            const modalContent = document.getElementById('alertModalContent');
            
            modalContent.innerHTML = `
                <div class="space-y-6">
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 rounded-full flex items-center justify-center ${this.getSeverityBadgeClass(alerta.severity).replace('text-', 'bg-').replace('-800', '-100')}">
                                <i class="fas ${this.getSeverityIcon(alerta.severity).split(' ')[1]} text-xl"></i>
                            </div>
                        </div>
                        <div class="flex-1">
                            <h4 class="text-lg font-semibold text-gray-800">${alerta.title}</h4>
                            <p class="text-gray-600">${alerta.message}</p>
                            <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                <span><i class="fas fa-user mr-1"></i>${alerta.details.responsavel}</span>
                                <span><i class="fas fa-clock mr-1"></i>${formatDateTime(alerta.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 p-6 rounded-xl">
                        <h5 class="font-semibold text-gray-800 mb-4 flex items-center">
                            <i class="fas fa-chart-line mr-2 text-primary-500"></i>
                            Detalhes da Divergência
                        </h5>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-3">
                                <div class="flex justify-between items-center">
                                    <span class="text-gray-600">Total Vendido:</span>
                                    <span class="font-semibold">${formatCurrency(alerta.details.vendidoCalc)}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-gray-600">Total Pagamentos:</span>
                                    <span class="font-semibold">${formatCurrency(alerta.details.pagamentosReg)}</span>
                                </div>
                                <div class="flex justify-between items-center pt-2 border-t border-gray-200">
                                    <span class="text-gray-600 font-medium">Diferença:</span>
                                    <span class="font-bold ${alerta.details.diffVendasPagamentos < 0 ? 'text-danger-600' : 'text-warning-600'}">
                                        ${formatCurrency(alerta.details.diffVendasPagamentos)}
                                    </span>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div class="flex justify-between items-center">
                                    <span class="text-gray-600">Período:</span>
                                    <span class="font-semibold">${alerta.details.periodo}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-gray-600">Diferença Caixa:</span>
                                    <span class="font-semibold ${Math.abs(alerta.details.diffCaixa) > 0.01 ? 'text-warning-600' : 'text-success-600'}">
                                        ${formatCurrency(alerta.details.diffCaixa)}
                                    </span>
                                </div>
                                <div class="flex justify-between items-center pt-2 border-t border-gray-200">
                                    <span class="text-gray-600 font-medium">Severidade:</span>
                                    <span class="px-2 py-1 text-xs font-medium rounded-full ${this.getSeverityBadgeClass(alerta.severity)}">
                                        ${this.getSeverityText(alerta.severity)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-comment mr-1"></i>
                            Justificativa (opcional):
                        </label>
                        <textarea id="alertJustification" 
                                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors" 
                                  rows="4" 
                                  placeholder="Descreva a justificativa para esta divergência ou as ações tomadas para resolvê-la..."></textarea>
                    </div>
                </div>
            `;
            
            modal.classList.remove('hidden');
            
            // Event listeners para botões do modal
            document.getElementById('dismissAlert').onclick = () => {
                modal.classList.add('hidden');
            };
            
            document.getElementById('resolveAlert').onclick = () => {
                const justification = document.getElementById('alertJustification').value;
                this.resolveAlert(alerta.id, justification);
                modal.classList.add('hidden');
            };
            
            document.getElementById('closeAlertModal').onclick = () => {
                modal.classList.add('hidden');
            };
        }

        resolveAlert(alertId, justification = '') {
            // Simular resolução do alerta
            this.currentAlerts = this.currentAlerts.filter(alert => alert.id !== alertId);
            this.render(this.currentAlerts);
            this.updateCount(this.currentAlerts.length);
            
            const message = justification ? 
                `Alerta resolvido com justificativa: "${justification.substring(0, 50)}..."` :
                'Alerta marcado como resolvido';
                
            toastManager.show(message, 'success');
        }

        updateCount(count) {
            if (this.countElement) {
                this.countElement.textContent = count;
                this.countElement.className = count > 0 ? 
                    'bg-danger-100 text-danger-800 text-xs font-medium px-2 py-1 rounded-full' :
                    'bg-success-100 text-success-800 text-xs font-medium px-2 py-1 rounded-full';
            }
        }

        clearAll() {
            this.currentAlerts = [];
            this.render([]);
            this.updateCount(0);
            toastManager.show('Todos os alertas foram marcados como resolvidos', 'success');
        }
    }

    const alertManager = new AlertManager();

    // Gerenciador de Turnos
    class TurnoManager {
        constructor() {
            this.container = document.getElementById('turnosContainer');
            this.currentTurnos = [];
        }

        async update() {
            try {
                const turnos = await dataManager.getTurnosAbertos();
                this.currentTurnos = turnos;
                this.render(turnos);
            } catch (error) {
                console.error('Erro ao atualizar turnos:', error);
                toastManager.show('Erro ao carregar turnos', 'error');
            }
        }

        render(turnos) {
            if (turnos.length === 0) {
                this.container.innerHTML = `
                    <div class="flex items-center justify-center py-12 text-gray-500">
                        <div class="text-center">
                            <i class="fas fa-clock text-4xl mb-4 text-blue-500"></i>
                            <p class="text-lg font-medium">Nenhum turno aberto</p>
                            <p class="text-sm text-gray-400 mt-1">Todos os turnos foram fechados</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            this.container.innerHTML = turnos.map(turno => {
                const dataHora = turno.id.split('_')[0];
                const periodo = turno.id.split('_')[1];
                const responsavel = turno.abertura?.responsavelNome || 'N/A';
                const horaAbertura = turno.abertura?.hora || 'N/A';
                const tempoAberto = this.calculateOpenTime(turno.createdAt);
                
                return `
                    <div class="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="flex items-center mb-3">
                                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                                        <i class="fas fa-clock text-white"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-semibold text-gray-800 text-lg">Turno ${periodo}</h4>
                                        <span class="inline-flex items-center px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-full">
                                            <i class="fas fa-circle text-xs mr-1 animate-pulse"></i>
                                            Em Andamento
                                        </span>
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div class="space-y-2">
                                        <div class="flex items-center text-gray-600">
                                            <i class="fas fa-calendar mr-2 text-blue-500"></i>
                                            <span>${this.formatDate(dataHora)}</span>
                                        </div>
                                        <div class="flex items-center text-gray-600">
                                            <i class="fas fa-play-circle mr-2 text-blue-500"></i>
                                            <span>Iniciado às ${horaAbertura}</span>
                                        </div>
                                    </div>
                                    <div class="space-y-2">
                                        <div class="flex items-center text-gray-600">
                                            <i class="fas fa-user mr-2 text-blue-500"></i>
                                            <span>${responsavel}</span>
                                        </div>
                                        <div class="flex items-center text-gray-600">
                                            <i class="fas fa-hourglass-half mr-2 text-blue-500"></i>
                                            <span>Há ${tempoAberto}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col space-y-2 ml-6">
                                <button class="detail-turno-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                        data-turno-id="${turno.id}">
                                    <i class="fas fa-eye mr-1"></i>Detalhar
                                </button>
                                <button class="transfer-turno-btn bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                        data-turno-id="${turno.id}">
                                    <i class="fas fa-exchange-alt mr-1"></i>Transferir
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            this.attachEventListeners();
        }

        attachEventListeners() {
            this.container.querySelectorAll('.detail-turno-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const turnoId = btn.dataset.turnoId;
                    this.showTurnoDetails(turnoId);
                });
            });
            
            this.container.querySelectorAll('.transfer-turno-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const turnoId = btn.dataset.turnoId;
                    this.showTransferModal(turnoId);
                });
            });
        }

        formatDate(dateString) {
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
        }

        calculateOpenTime(createdAt) {
            if (!createdAt) return 'Tempo não disponível';
            
            const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
            const now = new Date();
            const diffInMinutes = Math.floor((now - created) / (1000 * 60));
            
            if (diffInMinutes < 60) {
                return `${diffInMinutes} minutos`;
            } else {
                const hours = Math.floor(diffInMinutes / 60);
                const minutes = diffInMinutes % 60;
                return `${hours}h ${minutes}m`;
            }
        }

        showTurnoDetails(turnoId) {
            const turno = this.currentTurnos.find(t => t.id === turnoId);
            if (!turno) return;
            
            toastManager.show(`Exibindo detalhes do turno ${turnoId}`, 'info');
            // Aqui seria implementada a lógica para mostrar os detalhes completos
        }

        showTransferModal(turnoId) {
            const turno = this.currentTurnos.find(t => t.id === turnoId);
            if (!turno) return;
            
            toastManager.show(`Iniciando transferência do turno ${turnoId}`, 'info');
            // Aqui seria implementada a lógica para transferência de caixa
        }
    }

    const turnoManager = new TurnoManager();

    // Gerenciador de Timeline
    class TimelineManager {
        constructor() {
            this.container = document.getElementById('timelineContainer');
            this.searchInput = document.getElementById('timelineSearch');
            this.currentData = [];
            this.filteredData = [];
        }

        async update() {
            try {
                // Simular dados da timeline por enquanto
                this.currentData = await this.generateTimelineData();
                this.filteredData = [...this.currentData];
                this.render();
            } catch (error) {
                console.error('Erro ao atualizar timeline:', error);
                toastManager.show('Erro ao carregar timeline', 'error');
            }
        }

        async generateTimelineData() {
            const timeline = [
                {
                    id: 1,
                    type: 'abertura',
                    title: 'Turno Manhã Aberto',
                    description: 'Turno aberto por João Silva com caixa inicial de R$ 100,00',
                    timestamp: new Date(),
                    icon: 'fa-play-circle',
                    color: 'success',
                    user: 'João Silva'
                },
                {
                    id: 2,
                    type: 'fechamento',
                    title: 'Turno Noite Fechado',
                    description: 'Turno fechado por Maria Santos - Total: R$ 1.250,00',
                    timestamp: new Date(Date.now() - 3600000),
                    icon: 'fa-stop-circle',
                    color: 'danger',
                    user: 'Maria Santos'
                },
                {
                    id: 3,
                    type: 'ajuste',
                    title: 'Ajuste de Caixa',
                    description: 'Diferença de R$ 5,00 registrada e justificada',
                    timestamp: new Date(Date.now() - 7200000),
                    icon: 'fa-edit',
                    color: 'warning',
                    user: 'Carlos Admin'
                },
                {
                    id: 4,
                    type: 'alerta',
                    title: 'Divergência Resolvida',
                    description: 'Alerta de divergência no turno tarde foi resolvido',
                    timestamp: new Date(Date.now() - 10800000),
                    icon: 'fa-check-circle',
                    color: 'info',
                    user: 'Sistema'
                },
                {
                    id: 5,
                    type: 'backup',
                    title: 'Backup Realizado',
                    description: 'Backup automático dos dados realizado com sucesso',
                    timestamp: new Date(Date.now() - 14400000),
                    icon: 'fa-database',
                    color: 'info',
                    user: 'Sistema'
                }
            ];
            
            return timeline.sort((a, b) => b.timestamp - a.timestamp);
        }

        render() {
            if (this.filteredData.length === 0) {
                this.container.innerHTML = `
                    <div class="flex items-center justify-center py-12 text-gray-500">
                        <div class="text-center">
                            <i class="fas fa-history text-4xl mb-4"></i>
                            <p class="text-lg font-medium">Nenhuma atividade encontrada</p>
                            <p class="text-sm text-gray-400 mt-1">Tente ajustar os filtros de busca</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            this.container.innerHTML = this.filteredData.map((item, index) => `
                <div class="timeline-item relative flex items-start space-x-4 ${index !== this.filteredData.length - 1 ? 'pb-8' : ''}">
                    <div class="timeline-dot w-10 h-10 bg-${item.color}-100 rounded-full flex items-center justify-center shadow-sm border-2 border-white relative z-10">
                        <i class="fas ${item.icon} text-${item.color}-600"></i>
                    </div>
                    <div class="flex-1 min-w-0 bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-1">
                                    <h4 class="text-sm font-semibold text-gray-800">${item.title}</h4>
                                    <span class="px-2 py-1 text-xs font-medium bg-${item.color}-100 text-${item.color}-800 rounded-full">
                                        ${this.getTypeLabel(item.type)}
                                    </span>
                                </div>
                                <p class="text-sm text-gray-600 mb-2">${item.description}</p>
                                <div class="flex items-center space-x-4 text-xs text-gray-500">
                                    <span><i class="fas fa-user mr-1"></i>${item.user}</span>
                                    <span><i class="fas fa-clock mr-1"></i>${formatDateTime(item.timestamp)}</span>
                                </div>
                            </div>
                            <button class="text-gray-400 hover:text-gray-600 transition-colors" title="Mais opções">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        getTypeLabel(type) {
            const labels = {
                abertura: 'Abertura',
                fechamento: 'Fechamento',
                ajuste: 'Ajuste',
                alerta: 'Alerta',
                backup: 'Sistema'
            };
            return labels[type] || type;
        }

        search(term) {
            if (!term.trim()) {
                this.filteredData = [...this.currentData];
            } else {
                const lowerTerm = term.toLowerCase();
                this.filteredData = this.currentData.filter(item => 
                    item.title.toLowerCase().includes(lowerTerm) ||
                    item.description.toLowerCase().includes(lowerTerm) ||
                    item.user.toLowerCase().includes(lowerTerm)
                );
            }
            this.render();
        }

        export() {
            try {
                const csvData = [
                    ['Data/Hora', 'Tipo', 'Título', 'Descrição', 'Usuário'],
                    ...this.currentData.map(item => [
                        formatDateTime(item.timestamp),
                        this.getTypeLabel(item.type),
                        item.title,
                        item.description,
                        item.user
                    ])
                ];
                
                const csvContent = csvData.map(row => 
                    row.map(cell => `"${cell}"`).join(',')
                ).join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                
                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', `timeline_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                
                toastManager.show('Timeline exportada com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao exportar timeline:', error);
                toastManager.show('Erro ao exportar timeline', 'error');
            }
        }
    }

    const timelineManager = new TimelineManager();

// Gerenciador de Preços Corrigido
class PriceManager {
    constructor() {
        this.containers = {
            precosPasteisContainer: 'pasteis',
            precosCasquinhasContainer: 'casquinhas', 
            precosCaldoCanaContainer: 'caldo_cana',
            precosRefrigerantesContainer: 'refrigerantes',
            precosGeloContainer: 'gelo'
        };
        
        // Definir produtos usando as listas do shared.js
        this.produtosPorCategoria = {
            pasteis: window.listaSaboresPasteis || [
                "Carne", "Frango", "Queijo", "Pizza", "Bauru", "Calabresa", "Palmito",
                "Especial de Carne", "Especial de Frango", "Especial de Calabresa"
            ],
            casquinhas: window.listaCasquinhas || [
                "Casquinha Simples", "Casquinha com Cobertura", "Casquinha com Granulado"
            ],
            caldo_cana: window.listaCaldoCana || [
                "Caldo de Cana 300ml", "Caldo de Cana 500ml", "Caldo de Cana 700ml", "Caldo de Cana 1litro"
            ],
            refrigerantes: window.listaRefrigerantes || [
                "Coca-Cola 350ml", "Coca-Cola 600ml", "Coca-Cola 2L", "Guaraná 350ml", 
                "Guaraná 600ml", "Guaraná 2L", "Fanta Laranja 350ml", "Fanta Laranja 600ml",
                "Fanta Laranja 2L", "Fanta Uva 350ml", "Sprite 350ml", "Água Mineral 500ml"
            ],
            gelo: ["Gelo (Pacote)"]
        };
    }

    async load() {
        try {
            toastManager.show('Carregando preços...', 'info', 2000);
            
            // Carregar preços do Firebase
            appState.currentPrices = await dataManager.getPrecos();
            console.log('Preços carregados:', appState.currentPrices);
            
            // Popular formulários
            this.populateForms();
            this.setupFormHandler();
            
            toastManager.show('Preços carregados com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao carregar preços:', error);
            toastManager.show('Erro ao carregar preços: ' + error.message, 'error');
        }
    }

    populateForms() {
        Object.entries(this.containers).forEach(([containerId, categoryKey]) => {
            const container = document.getElementById(containerId);
            if (!container) {
                console.warn(`Container ${containerId} não encontrado`);
                return;
            }
            
            // Limpar container
            container.innerHTML = '';
            
            // Obter produtos da categoria
            const products = this.produtosPorCategoria[categoryKey] || [];
            console.log(`Populando ${categoryKey} com ${products.length} produtos`);
            
            // Criar inputs para cada produto
            products.forEach(product => {
                const itemKey = this.generateItemKey(product);
                const currentPrice = appState.currentPrices[categoryKey]?.[itemKey]?.preco || 0;
                const priceCard = this.createPriceCard(product, categoryKey, itemKey, currentPrice);
                container.appendChild(priceCard);
            });
        });
    }

    generateItemKey(itemName) {
        return itemName.toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[ç]/g, 'c')
            .replace(/[ãâáàä]/g, 'a')
            .replace(/[éêèë]/g, 'e')
            .replace(/[íìîï]/g, 'i')
            .replace(/[óôõòö]/g, 'o')
            .replace(/[úùûü]/g, 'u')
            .replace(/\./g, '')
            .replace(/\d+ml/g, d => d.toLowerCase())
            .replace(/\d+litro/g, d => d.toLowerCase());
    }

    createPriceCard(itemDisplayName, categoryKey, itemKey, currentPriceValue) {
        // Container principal do card
        const cardDiv = document.createElement('div');
        cardDiv.className = 'price-card bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-primary-200 transition-all duration-300 transform hover:-translate-y-1';
        
        // Header do produto
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex items-center justify-between mb-4';
        
        const productIcon = document.createElement('div');
        productIcon.className = 'w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center';
        
        // Ícone baseado na categoria
        const iconClass = this.getProductIcon(categoryKey);
        productIcon.innerHTML = `<i class="${iconClass} text-primary-600"></i>`;
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'flex-1 ml-3';
        
        const label = document.createElement('h3');
        label.className = 'text-sm font-semibold text-gray-800 mb-1';
        label.textContent = itemDisplayName;
        
        const keyLabel = document.createElement('p');
        keyLabel.className = 'text-xs text-gray-500';
        keyLabel.textContent = `ID: ${itemKey}`;
        
        titleDiv.appendChild(label);
        titleDiv.appendChild(keyLabel);
        headerDiv.appendChild(productIcon);
        headerDiv.appendChild(titleDiv);
        
        // Input container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'relative mb-4';
        
        const inputLabel = document.createElement('label');
        inputLabel.htmlFor = `preco_${categoryKey}_${itemKey}`;
        inputLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
        inputLabel.innerHTML = '<i class="fas fa-dollar-sign mr-1 text-primary-500"></i>Preço Unitário';
        
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'relative';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `preco_${categoryKey}_${itemKey}`;
        input.name = `preco_${categoryKey}_${itemKey}`;
        input.step = '0.01';
        input.min = '0';
        input.required = true;
        input.className = 'w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-lg font-semibold';
        input.value = parseFloat(currentPriceValue).toFixed(2);
        input.placeholder = '0.00';
        input.dataset.categoryKey = categoryKey;
        input.dataset.itemKey = itemKey;
        
        // Símbolo de moeda
        const currencySymbol = document.createElement('div');
        currencySymbol.className = 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold text-lg';
        currencySymbol.textContent = 'R$';
        
        // Indicador de mudança
        const changeIndicator = document.createElement('div');
        changeIndicator.className = 'absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 transition-opacity duration-200';
        changeIndicator.innerHTML = '<i class="fas fa-check text-success-500 text-lg"></i>';
        
        inputWrapper.appendChild(currencySymbol);
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(changeIndicator);
        
        // Info atual
        const infoDiv = document.createElement('div');
        infoDiv.className = 'bg-gray-50 p-3 rounded-lg';
        
        const currentValueDiv = document.createElement('div');
        currentValueDiv.className = 'flex items-center justify-between text-sm';
        
        const currentLabel = document.createElement('span');
        currentLabel.className = 'text-gray-600';
        currentLabel.textContent = 'Valor atual:';
        
        const currentValueSpan = document.createElement('span');
        currentValueSpan.className = 'font-bold text-primary-600 text-lg';
        currentValueSpan.textContent = formatCurrency(currentPriceValue);
        
        currentValueDiv.appendChild(currentLabel);
        currentValueDiv.appendChild(currentValueSpan);
        infoDiv.appendChild(currentValueDiv);
        
        // Event listeners
        input.addEventListener('input', () => {
            const newValue = parseFloat(input.value) || 0;
            currentValueSpan.textContent = formatCurrency(newValue);
            
            // Mostrar indicador de mudança
            changeIndicator.classList.remove('opacity-0');
            setTimeout(() => changeIndicator.classList.add('opacity-0'), 2000);
            
            // Highlight do card quando modificado
            if (newValue !== currentPriceValue) {
                cardDiv.classList.add('ring-2', 'ring-primary-200', 'bg-primary-50');
            } else {
                cardDiv.classList.remove('ring-2', 'ring-primary-200', 'bg-primary-50');
            }
        });
        
        input.addEventListener('focus', () => {
            cardDiv.classList.add('ring-2', 'ring-primary-300');
        });
        
        input.addEventListener('blur', () => {
            cardDiv.classList.remove('ring-2', 'ring-primary-300');
        });
        
        // Montar o card
        inputContainer.appendChild(inputLabel);
        inputContainer.appendChild(inputWrapper);
        
        cardDiv.appendChild(headerDiv);
        cardDiv.appendChild(inputContainer);
        cardDiv.appendChild(infoDiv);
        
        return cardDiv;
    }

    getProductIcon(categoryKey) {
        const icons = {
            pasteis: 'fas fa-utensils',
            casquinhas: 'fas fa-ice-cream',
            caldo_cana: 'fas fa-glass-whiskey',
            refrigerantes: 'fas fa-bottle-water',
            gelo: 'fas fa-cube'
        };
        return icons[categoryKey] || 'fas fa-tag';
    }

    setupFormHandler() {
        const form = document.getElementById('formPrecos');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveAll();
        });
    }

    async saveAll() {
        const saveButton = document.querySelector('#formPrecos button[type="submit"]');
        const originalText = saveButton.innerHTML;
        
        try {
            // Loading state
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando preços...';
            
            const newPricesData = {};
            const inputs = document.querySelectorAll('#formPrecos input[type="number"]');
            let hasError = false;
            let changedCount = 0;
            
            // Validar e coletar dados
            inputs.forEach(input => {
                const category = input.dataset.categoryKey;
                const item = input.dataset.itemKey;
                const price = parseFloat(input.value);
                
                if (isNaN(price) || price < 0) {
                    input.classList.add('border-danger-500', 'bg-danger-50');
                    hasError = true;
                    return;
                }
                
                input.classList.remove('border-danger-500', 'bg-danger-50');
                
                // Verificar se houve mudança
                const currentPrice = appState.currentPrices[category]?.[item]?.preco || 0;
                if (Math.abs(price - currentPrice) > 0.01) {
                    changedCount++;
                }
                
                if (!newPricesData[category]) {
                    newPricesData[category] = {};
                }
                newPricesData[category][item] = { preco: price };
            });
            
            if (hasError) {
                throw new Error('Alguns preços são inválidos. Verifique os campos destacados em vermelho.');
            }
            
            if (changedCount === 0) {
                toastManager.show('Nenhuma alteração foi detectada nos preços.', 'info');
                return;
            }
            
            // Salvar no Firebase usando batch
            const batch = db.batch();
            Object.keys(newPricesData).forEach(categoryKey => {
                const categoryDocRef = db.collection('produtos').doc(categoryKey);
                batch.set(categoryDocRef, newPricesData[categoryKey], { merge: true });
            });
            
            await batch.commit();
            
            // Atualizar estado local
            appState.currentPrices = { ...appState.currentPrices, ...newPricesData };
            dataManager.clearCache();
            
            // Feedback visual de sucesso
            inputs.forEach(input => {
                const card = input.closest('.price-card');
                card.classList.remove('ring-2', 'ring-primary-200', 'bg-primary-50');
                card.classList.add('ring-2', 'ring-success-200', 'bg-success-50');
                
                setTimeout(() => {
                    card.classList.remove('ring-2', 'ring-success-200', 'bg-success-50');
                }, 2000);
            });
            
            toastManager.show(`${changedCount} preço(s) alterado(s) com sucesso!`, 'success', 5000);
            
        } catch (error) {
            console.error('Erro ao salvar preços:', error);
            toastManager.show('Erro ao salvar preços: ' + error.message, 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    }
}

    const priceManager = new PriceManager();

    // Gerenciador de Usuários
    class UserManager {
        constructor() {
            this.container = document.getElementById('listaUsuariosContainer');
            this.form = document.getElementById('formNovoUsuario');
        }

        async load() {
            try {
                toastManager.show('Carregando usuários...', 'info', 2000);
                appState.users = await dataManager.getUsuarios();
                this.render();
                this.setupFormHandler();
                toastManager.show('Usuários carregados com sucesso', 'success');
            } catch (error) {
                console.error('Erro ao carregar usuários:', error);
                toastManager.show('Erro ao carregar usuários', 'error');
            }
        }

        render() {
            if (appState.users.length === 0) {
                this.container.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-users text-2xl text-gray-400"></i>
                        </div>
                        <p class="text-lg font-medium">Nenhum usuário encontrado</p>
                        <p class="text-sm text-gray-400 mt-1">Adicione o primeiro usuário usando o formulário acima</p>
                    </div>
                `;
                return;
            }
            
            this.container.innerHTML = appState.users.map(usuario => `
                <div class="glass-effect p-6 rounded-xl hover:shadow-lg transition-all duration-200 border border-gray-100">
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
                        <div class="flex-1 flex items-center space-x-4">
                            <div class="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                                <i class="fas fa-user text-white text-lg"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-lg font-semibold text-gray-800">${usuario.nome || 'Nome não informado'}</h4>
                                <p class="text-gray-600">${usuario.email || 'Email não informado'}</p>
                                <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                    <span class="flex items-center">
                                        <i class="fas fa-fingerprint mr-1"></i>
                                        <code class="bg-gray-100 px-2 py-1 rounded text-xs">${usuario.id.substring(0, 8)}...</code>
                                    </span>
                                    <span class="px-3 py-1 rounded-full text-xs font-medium ${this.getRoleBadgeClass(usuario.role)}">
                                        <i class="fas ${this.getRoleIcon(usuario.role)} mr-1"></i>
                                        ${this.getRoleText(usuario.role)}
                                    </span>
                                    ${usuario.createdAt ? `<span class="text-xs text-gray-400">
                                        <i class="fas fa-calendar mr-1"></i>
                                        Criado em ${formatDateTime(usuario.createdAt.toDate())}
                                    </span>` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center space-x-3">
                            <div class="flex items-center space-x-2">
                                <label class="text-sm font-medium text-gray-700">Função:</label>
                                <select class="user-role-select px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" 
                                        data-user-id="${usuario.id}">
                                    <option value="funcionario" ${usuario.role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
                                    <option value="admin" ${usuario.role === 'admin' ? 'selected' : ''}>Administrador</option>
                                </select>
                            </div>
                            
                            <button class="save-role-btn bg-success-500 hover:bg-success-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                    data-user-id="${usuario.id}">
                                <i class="fas fa-save mr-1"></i>Salvar
                            </button>
                            
                            <button class="delete-user-btn bg-danger-500 hover:bg-danger-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                    data-user-id="${usuario.id}" 
                                    data-user-name="${usuario.nome}">
                                <i class="fas fa-trash mr-1"></i>Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            this.attachEventListeners();
        }

        getRoleBadgeClass(role) {
            return role === 'admin' ? 
                'bg-danger-100 text-danger-800' : 
                'bg-blue-100 text-blue-800';
        }

        getRoleIcon(role) {
            return role === 'admin' ? 'fa-user-shield' : 'fa-user';
        }

        getRoleText(role) {
            return role === 'admin' ? 'Administrador' : 'Funcionário';
        }

        attachEventListeners() {
            document.querySelectorAll('.save-role-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userId;
                    const roleSelect = document.querySelector(`select[data-user-id="${userId}"]`);
                    const newRole = roleSelect.value;
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Salvando...';
                    
                    try {
                        await db.collection('usuarios').doc(userId).update({ role: newRole });
                        
                        // Atualizar estado local
                        const userIndex = appState.users.findIndex(u => u.id === userId);
                        if (userIndex !== -1) {
                            appState.users[userIndex].role = newRole;
                        }
                        
                        toastManager.show('Função do usuário atualizada com sucesso', 'success');
                        this.render(); // Re-renderizar para mostrar mudanças
                        
                    } catch (error) {
                        console.error('Erro ao atualizar função:', error);
                        toastManager.show('Erro ao atualizar função do usuário', 'error');
                        roleSelect.value = appState.users.find(u => u.id === userId)?.role || 'funcionario';
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
            });
            
            document.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userId;
                    const userName = btn.dataset.userName;
                    
                    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?\n\nEsta ação não pode ser desfeita.`)) {
                        return;
                    }
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Excluindo...';
                    
                    try {
                        await db.collection('usuarios').doc(userId).delete();
                        
                        // Remover do estado local
                        appState.users = appState.users.filter(u => u.id !== userId);
                        
                        toastManager.show(`Usuário "${userName}" excluído com sucesso`, 'success');
                        this.render();
                        
                    } catch (error) {
                        console.error('Erro ao excluir usuário:', error);
                        toastManager.show('Erro ao excluir usuário', 'error');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
            });
        }

        setupFormHandler() {
            if (!this.form) return;
            
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addUser();
            });
        }

        async addUser() {
            const uid = document.getElementById('novoUsuarioUid').value.trim();
            const nome = document.getElementById('novoUsuarioNome').value.trim();
            const email = document.getElementById('novoUsuarioEmail').value.trim();
            const role = document.getElementById('novoUsuarioRole').value;
            
            if (!uid || !nome || !email) {
                toastManager.show('Todos os campos são obrigatórios', 'warning');
                return;
            }
            
            // Validar UID (deve ser do Firebase)
            if (uid.length < 20) {
                toastManager.show('UID inválido. Certifique-se de copiar o UID completo do Firebase Console', 'warning');
                return;
            }
            
            // Validar email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                toastManager.show('Email inválido', 'warning');
                return;
            }
            
            const submitBtn = this.form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adicionando usuário...';
                
                // Verificar se UID já existe
                const existingUser = appState.users.find(u => u.id === uid);
                if (existingUser) {
                    throw new Error('Já existe um usuário com este UID');
                }
                
                const userData = {
                    nome: nome,
                    email: email,
                    role: role,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('usuarios').doc(uid).set(userData);
                
                // Adicionar ao estado local
                appState.users.push({
                    id: uid,
                    ...userData,
                    createdAt: { toDate: () => new Date() } // Mock para exibição
                });
                
                toastManager.show(`Usuário "${nome}" adicionado com sucesso`, 'success');
                this.form.reset();
                this.render();
                
            } catch (error) {
                console.error('Erro ao adicionar usuário:', error);
                toastManager.show('Erro ao adicionar usuário: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    const userManager = new UserManager();

    // Gerenciador de Filtros e Períodos
    class FilterManager {
        constructor() {
            this.setupPeriodFilters();
            this.setupDynamicFilters();
        }

        setupPeriodFilters() {
            const filterChips = document.querySelectorAll('.filter-chip');
            const customDateRange = document.getElementById('customDateRange');
            
            filterChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    filterChips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    
                    const period = chip.dataset.period;
                    appState.filters.period = period;
                    
                    if (period === 'custom') {
                        customDateRange.classList.remove('hidden');
                    } else {
                        customDateRange.classList.add('hidden');
                        this.applyPeriodFilter(period);
                    }
                });
            });
            
            document.getElementById('applyCustomRange').addEventListener('click', () => {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;
                
                if (!startDate || !endDate) {
                    toastManager.show('Selecione as datas de início e fim', 'warning');
                    return;
                }
                
                if (new Date(startDate) > new Date(endDate)) {
                    toastManager.show('Data inicial deve ser anterior à data final', 'warning');
                    return;
                }
                
                appState.filters.startDate = startDate;
                appState.filters.endDate = endDate;
                
                this.applyCustomRangeFilter(startDate, endDate);
                toastManager.show('Período personalizado aplicado', 'success', 3000);
            });
        }

        setupDynamicFilters() {
            document.getElementById('filterTurno').addEventListener('change', (e) => {
                appState.filters.turno = e.target.value;
                this.applyFilters();
            });
            
            document.getElementById('filterPagamento').addEventListener('change', (e) => {
                appState.filters.pagamento = e.target.value;
                this.applyFilters();
            });
        }

        applyPeriodFilter(period) {
            const now = new Date();
            let startDate, endDate;
            
            switch (period) {
                case 'today':
                    startDate = endDate = this.formatDate(now);
                    break;
                case 'yesterday':
                    const yesterday = new Date(now);
                    yesterday.setDate(now.getDate() - 1);
                    startDate = endDate = this.formatDate(yesterday);
                    break;
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    startDate = this.formatDate(weekStart);
                    endDate = this.formatDate(now);
                    break;
                case 'month':
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    startDate = this.formatDate(monthStart);
                    endDate = this.formatDate(now);
                    break;
            }
            
            appState.filters.startDate = startDate;
            appState.filters.endDate = endDate;
            
            this.loadDashboardData();
        }

        applyCustomRangeFilter(start, end) {
            appState.filters.startDate = start;
            appState.filters.endDate = end;
            this.loadDashboardData();
        }

        applyFilters() {
            this.loadDashboardData();
            toastManager.show('Filtros aplicados', 'info', 2000);
        }

        formatDate(date) {
            return date.toISOString().split('T')[0];
        }

        async loadDashboardData() {
            const refreshIcon = document.getElementById('refreshIcon');
            if (refreshIcon) refreshIcon.classList.add('animate-spin');
            
            try {
                const turnos = await dataManager.getTurnos(appState.filters);
                
                await Promise.all([
                    kpiManager.update(turnos),
                    chartManager.updateAll(turnos),
                    alertManager.update(),
                    turnoManager.update(),
                    timelineManager.update()
                ]);
                
                toastManager.show('Dashboard atualizado com sucesso', 'success', 3000);
                
            } catch (error) {
                console.error('Erro ao carregar dados do dashboard:', error);
                toastManager.show('Erro ao carregar dados do dashboard', 'error');
            } finally {
                if (refreshIcon) refreshIcon.classList.remove('animate-spin');
            }
        }
    }

    const filterManager = new FilterManager();

    // Gerenciador de Abas
    class TabManager {
        constructor() {
            this.tabs = {
                dashboard: {
                    button: document.getElementById('btnTabDashboard'),
                    content: document.getElementById('tabContentDashboard'),
                    loader: () => filterManager.loadDashboardData()
                },
                precos: {
                    button: document.getElementById('btnTabPrecos'),
                    content: document.getElementById('tabContentPrecos'),
                    loader: () => priceManager.load()
                },
                usuarios: {
                    button: document.getElementById('btnTabUsuarios'),
                    content: document.getElementById('tabContentUsuarios'),
                    loader: () => userManager.load()
                }
            };
            
            this.setupTabs();
            this.setupKPIModals();
        }

        setupTabs() {
            Object.entries(this.tabs).forEach(([tabName, tab]) => {
                if (tab.button) {
                    tab.button.addEventListener('click', () => {
                        this.switchTab(tabName);
                    });
                }
            });
        }

        async switchTab(activeTabName) {
            // Atualizar botões
            Object.values(this.tabs).forEach(tab => {
                if (tab.button) {
                    tab.button.classList.remove('active', 'bg-primary-500', 'text-white', 'font-semibold');
                    tab.button.classList.add('bg-gray-200', 'text-gray-700', 'font-medium');
                }
                if (tab.content) {
                    tab.content.classList.add('hidden');
                }
            });
            
            const activeTab = this.tabs[activeTabName];
            if (activeTab) {
                if (activeTab.button) {
                    activeTab.button.classList.remove('bg-gray-200', 'text-gray-700', 'font-medium');
                    activeTab.button.classList.add('active', 'bg-primary-500', 'text-white', 'font-semibold');
                }
                if (activeTab.content) {
                    activeTab.content.classList.remove('hidden');
                }
                
                // Carregar dados da aba se necessário
                if (activeTab.loader) {
                    try {
                        await activeTab.loader();
                    } catch (error) {
                        console.error(`Erro ao carregar aba ${activeTabName}:`, error);
                    }
                }
            }
        }

        setupKPIModals() {
            const kpiCards = document.querySelectorAll('.kpi-card');
            const modal = document.getElementById('kpiModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalContent = document.getElementById('modalContent');
            const closeModal = document.getElementById('closeModal');
            
            kpiCards.forEach(card => {
                card.addEventListener('click', () => {
                    const kpiType = card.dataset.kpi;
                    this.showKPIModal(kpiType);
                });
            });
            
            if (closeModal) {
                closeModal.addEventListener('click', () => {
                    modal.classList.add('hidden');
                });
            }
            
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                    }
                });
            }
        }

        showKPIModal(kpiType) {
            const modal = document.getElementById('kpiModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalContent = document.getElementById('modalContent');
            
            if (!modal || !modalTitle || !modalContent) return;
            
            const titles = {
                vendas: 'Detalhes das Vendas Brutas',
                ticket: 'Análise do Ticket Médio',
                pedidos: 'Resumo dos Pedidos',
                divergencias: 'Análise de Divergências',
                caixa: 'Status do Caixa',
                lucro: 'Projeção de Lucro'
            };
            
            modalTitle.textContent = titles[kpiType] || 'Detalhes';
            modalContent.innerHTML = this.generateKPIModalContent(kpiType);
            modal.classList.remove('hidden');
        }

        generateKPIModalContent(kpiType) {
            const data = appState.currentData;
            
            switch (kpiType) {
                case 'vendas':
                    return `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="bg-gradient-to-br from-primary-50 to-primary-100 p-6 rounded-xl">
                                <div class="flex items-center justify-between mb-4">
                                    <h4 class="font-semibold text-primary-700">Total de Vendas</h4>
                                    <i class="fas fa-chart-line text-primary-500 text-xl"></i>
                                </div>
                                <p class="text-3xl font-bold text-primary-600">${formatCurrency(data.vendas)}</p>
                                <p class="text-sm text-primary-600 mt-2">No período selecionado</p>
                            </div>
                            <div class="bg-gradient-to-br from-success-50 to-success-100 p-6 rounded-xl">
                                <div class="flex items-center justify-between mb-4">
                                    <h4 class="font-semibold text-success-700">Crescimento</h4>
                                    <i class="fas fa-trending-up text-success-500 text-xl"></i>
                                </div>
                                <p class="text-3xl font-bold text-success-600">+12.5%</p>
                                <p class="text-sm text-success-600 mt-2">Comparado ao período anterior</p>
                            </div>
                        </div>
                        <div class="mt-6">
                            <h4 class="font-semibold mb-4 text-gray-800">Distribuição por Período</h4>
                            <div class="space-y-3">
                                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span class="flex items-center">
                                        <i class="fas fa-sun text-warning-500 mr-2"></i>
                                        Manhã (06h - 14h):
                                    </span>
                                    <span class="font-semibold">${formatCurrency(data.vendas * 0.3)}</span>
                                </div>
                                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span class="flex items-center">
                                        <i class="fas fa-sun text-primary-500 mr-2"></i>
                                        Tarde (14h - 22h):
                                    </span>
                                    <span class="font-semibold">${formatCurrency(data.vendas * 0.4)}</span>
                                </div>
                                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span class="flex items-center">
                                        <i class="fas fa-moon text-blue-500 mr-2"></i>
                                        Noite (22h - 06h):
                                    </span>
                                    <span class="font-semibold">${formatCurrency(data.vendas * 0.3)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                case 'ticket':
                    const meta = 25.00;
                    const progress = Math.min((data.ticket / meta) * 100, 100);
                    return `
                        <div class="text-center mb-6">
                            <div class="w-32 h-32 mx-auto mb-4 relative">
                                <svg class="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="40" stroke="#e5e7eb" stroke-width="8" fill="none"></circle>
                                    <circle cx="50" cy="50" r="40" stroke="#22c55e" stroke-width="8" fill="none" 
                                            stroke-dasharray="251.2" stroke-dashoffset="${251.2 - (251.2 * progress / 100)}"
                                            class="transition-all duration-500"></circle>
                                </svg>
                                <div class="absolute inset-0 flex items-center justify-center">
                                    <div class="text-center">
                                        <p class="text-2xl font-bold text-success-600">${formatCurrency(data.ticket)}</p>
                                        <p class="text-xs text-gray-500">Ticket médio</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Meta mensal:</span>
                                <span class="font-semibold">${formatCurrency(meta)}</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-3">
                                <div class="bg-success-500 h-3 rounded-full transition-all duration-500" 
                                     style="width: ${progress}%"></div>
                            </div>
                            <p class="text-sm text-center ${data.ticket >= meta ? 'text-success-600' : 'text-gray-600'}">
                                ${data.ticket >= meta ? 
                                    '🎉 Meta atingida! Parabéns!' : 
                                    `Faltam ${formatCurrency(meta - data.ticket)} para atingir a meta`}
                            </p>
                        </div>
                    `;
                default:
                    return `
                        <div class="text-center py-12">
                            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-chart-bar text-2xl text-gray-400"></i>
                            </div>
                            <p class="text-gray-600 mb-2">Detalhes em desenvolvimento</p>
                            <p class="text-sm text-gray-400">Esta funcionalidade será implementada em breve</p>
                        </div>
                    `;
            }
        }
    }

    const tabManager = new TabManager();

    // Configuração de listeners de tempo real
    function setupRealtimeListeners() {
        if (!CONFIG.REALTIME_ENABLED) return;
        
        try {
            // Listener para turnos fechados (novos alertas)
            const turnosFechadosListener = db.collection('turnos')
                .where('status', '==', 'fechado')
                .orderBy('closedAt', 'desc')
                .limit(1)
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const turno = change.doc.data();
                            checkForNewAlerts(turno, change.doc.id);
                        }
                    });
                });
            
            // Listener para turnos abertos
            const turnosAbertosListener = db.collection('turnos')
                .where('status', '==', 'aberto')
                .onSnapshot(() => {
                    turnoManager.update();
                });
            
            appState.realTimeListeners.push(turnosFechadosListener, turnosAbertosListener);
            
        } catch (error) {
            console.error('Erro ao configurar listeners de tempo real:', error);
        }
    }

    function checkForNewAlerts(turno, turnoId) {
        const vendidoCalc = turno.totalVendidoCalculadoFinal || 0;
        const pagamentosReg = turno.totalRegistradoPagamentosFinal || 0;
        const diffVendasPagamentos = vendidoCalc - pagamentosReg;
        const diffCaixa = turno.diferencaCaixaFinal || 0;
        
        if (Math.abs(diffVendasPagamentos) > 0.01 || Math.abs(diffCaixa) > 0.01) {
            const severity = Math.abs(diffVendasPagamentos) > 50 || Math.abs(diffCaixa) > 50 ? 'critical' : 'warning';
            
            toastManager.show(
                `🚨 Nova divergência detectada no turno ${turnoId}!`,
                severity === 'critical' ? 'error' : 'warning',
                8000,
                false
            );
            
            // Atualizar alertas após um breve delay
            setTimeout(() => {
                alertManager.update();
            }, 1000);
        }
    }

    // Configuração de eventos globais
    function setupGlobalEventListeners() {
        // Refresh manual
        document.getElementById('refreshData').addEventListener('click', () => {
            filterManager.loadDashboardData();
        });
        
        // Limpar todos os alertas
        document.getElementById('clearAllAlerts').addEventListener('click', () => {
            if (confirm('Tem certeza que deseja marcar todos os alertas como resolvidos?')) {
                alertManager.clearAll();
            }
        });
        
        // Refresh turnos
        document.getElementById('refreshTurnos').addEventListener('click', () => {
            turnoManager.update();
        });
        
        // Exportar timeline
        document.getElementById('exportTimeline').addEventListener('click', () => {
            timelineManager.export();
        });
        
        // Busca na timeline
        document.getElementById('timelineSearch').addEventListener('input', (e) => {
            timelineManager.search(e.target.value);
        });
        
        // Mudança de período no gráfico de vendas por hora
        const salesHoursPeriod = document.getElementById('salesHoursPeriod');
        if (salesHoursPeriod) {
            salesHoursPeriod.addEventListener('change', (e) => {
                // Aqui seria implementada a lógica para atualizar o gráfico
                toastManager.show(`Gráfico atualizado para: ${e.target.options[e.target.selectedIndex].text}`, 'info', 2000);
            });
        }
        
        // Logout
        document.getElementById('logoutButton').addEventListener('click', async () => {
            try {
                // Limpar listeners de tempo real
                appState.realTimeListeners.forEach(unsubscribe => unsubscribe());
                
                await auth.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
                toastManager.show('Erro ao fazer logout', 'error');
            }
        });
        
        // Hotkeys
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R para refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                filterManager.loadDashboardData();
                toastManager.show('Dashboard atualizado via hotkey', 'info', 2000);
            }
            
            // Ctrl/Cmd + E para exportar
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                timelineManager.export();
            }
            
            // Escape para fechar modais
            if (e.key === 'Escape') {
                document.getElementById('kpiModal').classList.add('hidden');
                document.getElementById('alertModal').classList.add('hidden');
            }
        });
    }

    // Função de inicialização principal
    async function initialize() {
        try {
            // Mostrar toast de carregamento
            toastManager.show('Inicializando dashboard...', 'info', 3000);
            
            // Configurar listeners globais
            setupGlobalEventListeners();
            
            // Configurar listeners de tempo real
            setupRealtimeListeners();
            
            // Inicializar aba padrão (Dashboard)
            await tabManager.switchTab('dashboard');
            
            // Auto-refresh a cada 5 minutos
            setInterval(() => {
                if (document.getElementById('tabContentDashboard').classList.contains('hidden')) return;
                filterManager.loadDashboardData();
                toastManager.show('Dashboard atualizado automaticamente', 'info', 3000);
            }, CONFIG.AUTO_REFRESH_INTERVAL);
            
            // Mostrar toast de sucesso
            setTimeout(() => {
                toastManager.show('Dashboard carregado com sucesso! Use Ctrl+R para atualizar rapidamente.', 'success', 5000);
            }, 1000);
            
        } catch (error) {
            console.error('Erro na inicialização:', error);
            toastManager.show('Erro ao inicializar dashboard', 'error');
        }
    }

    // Inicializar quando o DOM estiver pronto
    initialize();

    // Cleanup ao descarregar a página
    window.addEventListener('beforeunload', () => {
        appState.realTimeListeners.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                console.error('Erro ao limpar listener:', error);
            }
        });
        
        chartManager.destroy();
        dataManager.clearCache();
    });

    // Expor algumas funções globalmente para debug (apenas em desenvolvimento)
    if (CONFIG.DEBUG_MODE) {
        window.adminController = {
            appState,
            kpiManager,
            chartManager,
            alertManager,
            turnoManager,
            timelineManager,
            priceManager,
            userManager,
            filterManager,
            tabManager,
            toastManager,
            dataManager
        };
    }
});