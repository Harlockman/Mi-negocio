// admin.js - Funciones del panel de administración
const Admin = {
    init: function() {
        document.getElementById('admin-refresh-data')?.addEventListener('click', () => this.refreshData());
        document.getElementById('admin-view-orders')?.addEventListener('click', () => this.loadOrders());
        document.getElementById('admin-search-order')?.addEventListener('click', () => this.searchOrder());
    },
    refreshData: async function() {
        if (confirm('Esto sincronizará los archivos desde GitHub y actualizará la base de datos. ¿Continuar?')) {
            document.getElementById('loading-overlay').style.display = 'flex';
            await TMDB.sincronizarProductosDesdeGitHub();
            document.getElementById('loading-overlay').style.display = 'none';
            alert('Datos actualizados correctamente');
            if (window.App) window.App.loadSection('home');
        }
    },
    loadOrders: async function() {
        const pedidos = await DB.obtenerPedidos();
        const container = document.getElementById('admin-orders-list');
        if (pedidos.length === 0) {
            container.innerHTML = '<p>No hay pedidos aún.</p>';
        } else {
            container.innerHTML = pedidos.map(p => `
                <div class="order-item">
                    <strong>Código: ${p.codigo}</strong>
                    <span>Usuario: ${p.usuario}</span>
                    <span>Total: $${p.total.toFixed(2)}</span>
                    <span>Fecha: ${new Date(p.fecha).toLocaleString()}</span>
                    <button class="view-order-details" data-code="${p.codigo}">Ver Detalles</button>
                </div>
            `).join('');
            document.querySelectorAll('.view-order-details').forEach(btn => {
                btn.addEventListener('click', () => this.viewOrderDetails(btn.dataset.code));
            });
        }
    },
    searchOrder: async function() {
        const codigo = document.getElementById('admin-order-search').value.trim();
        if (!codigo) return;
        const pedidos = await DB.obtenerPedidos();
        const pedido = pedidos.find(p => p.codigo === codigo);
        if (pedido) {
            alert(`Pedido encontrado:\nCódigo: ${pedido.codigo}\nUsuario: ${pedido.usuario}\nTotal: $${pedido.total.toFixed(2)}\nItems: ${pedido.items.map(i => `${i.titulo} x${i.cantidad}`).join(', ')}`);
        } else {
            alert('No se encontró ningún pedido con ese código');
        }
    },
    viewOrderDetails: function(codigo) {
        // Implementar vista detallada si se desea
        alert('Ver detalles de pedido ' + codigo + ' (puedes ampliar esta función)');
    }
};

window.Admin = Admin;