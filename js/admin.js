// admin.js - Controlador del panel de administración
let adminTools = null;
let currentUser = null;

const Admin = {
    init: async function() {
        // Verificar sesión de admin
        await this.checkAdminSession();
        
        // Inicializar herramientas
        adminTools = new AdminTools();
        
        // Cargar configuración inicial
        await this.loadInitialData();
        
        // Configurar event listeners
        this.bindEvents();
        
        // Cargar tab activo
        this.loadActiveTab();
    },
    
    checkAdminSession: async function() {
        // Verificar si hay usuario admin logueado
        const adminUser = localStorage.getItem('admin_logged');
        if (!adminUser) {
            // Redirigir al login si no está autenticado
            window.location.href = 'index.html';
            return;
        }
        
        const user = JSON.parse(adminUser);
        if (user.telefono !== 'altairdbb' || user.password !== 'altairdbb') {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        document.getElementById('admin-user').textContent = user.nombre;
    },
    
    loadInitialData: async function() {
        // Cargar estadísticas
        await this.loadStats();
        
        // Cargar productos recientes
        await this.loadRecentProducts();
        
        // Cargar precios
        await this.loadPrices();
        
        // Cargar configuración guardada
        const savedApiKey = localStorage.getItem('tmdb_api_key');
        if (savedApiKey) {
            document.getElementById('tmdb-api-key').value = savedApiKey;
            window.CONFIG.TMDB_API_KEY = savedApiKey;
        }
        
        const savedRepo = localStorage.getItem('github_repo');
        if (savedRepo) {
            document.getElementById('github-repo').value = savedRepo;
            window.CONFIG.GITHUB_REPO = savedRepo;
        }
    },
    
    loadStats: async function() {
        const stats = await adminTools.getStats();
        
        document.getElementById('total-peliculas').textContent = stats.por_seccion.peliculas || 0;
        document.getElementById('total-series').textContent = stats.por_seccion.series || 0;
        document.getElementById('total-novelas').textContent = stats.por_seccion.novelas || 0;
        document.getElementById('total-shows').textContent = stats.por_seccion.shows || 0;
        document.getElementById('total-animados').textContent = stats.por_seccion.animados || 0;
        document.getElementById('total-animes').textContent = stats.por_seccion.animes || 0;
        document.getElementById('total-pedidos').textContent = stats.total_pedidos;
        document.getElementById('total-usuarios').textContent = stats.total_usuarios;
    },
    
    loadRecentProducts: async function() {
        const products = await adminTools.getRecentProducts(10);
        const container = document.getElementById('recent-products');
        
        if (!container) return;
        
        if (products.length === 0) {
            container.innerHTML = '<p>No hay productos aún. Escanea archivos para comenzar.</p>';
            return;
        }
        
        container.innerHTML = products.map(product => `
            <div class="recent-product">
                <img src="${product.poster}" alt="${product.titulo}" width="50" height="75">
                <div>
                    <strong>${product.titulo}</strong>
                    <p>${product.seccion} • ${product.anio}</p>
                </div>
            </div>
        `).join('');
    },
    
    loadPrices: async function() {
        try {
            const response = await fetch('data/precios.txt');
            const text = await response.text();
            const lines = text.split('\n');
            
            for (const line of lines) {
                if (line.includes('=')) {
                    const [key, value] = line.split('=');
                    const input = document.getElementById(`price-${key}`);
                    if (input) input.value = parseFloat(value);
                }
            }
        } catch (error) {
            console.error('Error cargando precios:', error);
        }
    },
    
    bindEvents: function() {
        // Navegación entre tabs
        document.querySelectorAll('.admin-menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Botón de logout
        document.getElementById('admin-logout')?.addEventListener('click', () => {
            localStorage.removeItem('admin_logged');
            window.location.href = 'index.html';
        });
        
        // Botones de escaneo
        document.getElementById('btn-start-scan')?.addEventListener('click', () => this.startScan());
        document.getElementById('btn-stop-scan')?.addEventListener('click', () => this.stopScan());
        document.getElementById('btn-clear-cache')?.addEventListener('click', () => this.clearScanCache());
        
        // Botones de productos
        document.getElementById('btn-refresh-products')?.addEventListener('click', () => this.loadProducts());
        document.getElementById('product-search')?.addEventListener('input', () => this.filterProducts());
        document.getElementById('product-category-filter')?.addEventListener('change', () => this.filterProducts());
        
        // Botones de pedidos
        document.getElementById('btn-search-order')?.addEventListener('click', () => this.searchOrders());
        document.getElementById('btn-export-orders')?.addEventListener('click', () => this.exportOrders());
        
        // Botones de precios
        document.getElementById('btn-save-prices')?.addEventListener('click', () => this.savePrices());
        document.getElementById('btn-load-prices')?.addEventListener('click', () => this.loadPrices());
        
        // Botones de sincronización
        document.getElementById('btn-sync-all-tmdb')?.addEventListener('click', () => this.syncAllTMDB());
        
        // Botones de configuración
        document.getElementById('btn-save-api-key')?.addEventListener('click', () => this.saveApiKey());
        document.getElementById('btn-save-github')?.addEventListener('click', () => this.saveGitHubRepo());
        document.getElementById('btn-export-db')?.addEventListener('click', () => this.exportDatabase());
        document.getElementById('btn-import-db')?.addEventListener('click', () => this.importDatabase());
        document.getElementById('btn-reset-db')?.addEventListener('click', () => this.resetDatabase());
    },
    
    switchTab: function(tabId) {
        // Actualizar botones activos
        document.querySelectorAll('.admin-menu-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Mostrar tab correspondiente
        document.querySelectorAll('.admin-tab').forEach(tab => {
            if (tab.id === `${tabId}-tab`) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Cargar datos específicos del tab
        if (tabId === 'manage-products') {
            this.loadProducts();
        } else if (tabId === 'manage-orders') {
            this.loadOrders();
        }
    },
    
    loadActiveTab: function() {
        const activeTab = document.querySelector('.admin-menu-btn.active');
        if (activeTab) {
            this.switchTab(activeTab.dataset.tab);
        } else {
            this.switchTab('dashboard');
        }
    },
    
    startScan: async function() {
        const recursive = document.getElementById('scan-recursive')?.checked || true;
        const updateExisting = document.getElementById('scan-update-existing')?.checked || true;
        const fetchTMDB = document.getElementById('scan-fetch-tmdb')?.checked || true;
        
        // Mostrar progreso
        document.querySelector('.scan-progress').style.display = 'block';
        document.getElementById('btn-start-scan').disabled = true;
        document.getElementById('btn-stop-scan').disabled = false;
        document.getElementById('scan-results').innerHTML = '';
        
        try {
            const stats = await adminTools.startFileScan({
                recursive,
                updateExisting,
                fetchTMDB
            });
            
            alert(`Escaneo completado:\nNuevos: ${stats.new}\nExistentes: ${stats.existing}\nErrores: ${stats.errors}`);
        } catch (error) {
            console.error('Error en escaneo:', error);
            alert('Error durante el escaneo: ' + error.message);
        } finally {
            document.getElementById('btn-start-scan').disabled = false;
            document.getElementById('btn-stop-scan').disabled = true;
        }
    },
    
    stopScan: function() {
        adminTools.stopFileScan();
    },
    
    clearScanCache: function() {
        adminTools.clearScanResults();
        document.querySelector('.scan-progress').style.display = 'none';
    },
    
    loadProducts: async function() {
        const products = await DB.obtenerProductos();
        const container = document.getElementById('products-list');
        
        if (!container) return;
        
        if (products.length === 0) {
            container.innerHTML = '<p>No hay productos. Escanea archivos para comenzar.</p>';
            return;
        }
        
        // Guardar todos los productos para filtrar
        this.allProducts = products;
        this.filterProducts();
    },
    
    filterProducts: function() {
        const searchTerm = document.getElementById('product-search')?.value.toLowerCase() || '';
        const category = document.getElementById('product-category-filter')?.value || '';
        
        let filtered = this.allProducts;
        
        if (searchTerm) {
            filtered = filtered.filter(p => 
                p.titulo.toLowerCase().includes(searchTerm) ||
                p.nombre_original?.toLowerCase().includes(searchTerm)
            );
        }
        
        if (category) {
            filtered = filtered.filter(p => p.seccion === category);
        }
        
        this.renderProducts(filtered);
    },
    
    renderProducts: function(products) {
        const container = document.getElementById('products-list');
        if (!container) return;
        
        container.innerHTML = products.map(product => `
            <div class="product-item" data-id="${product.id}">
                <img src="${product.poster}" alt="${product.titulo}" onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'">
                <div class="product-info">
                    <h4>${product.titulo}</h4>
                    <p>${product.seccion} • ${product.anio}</p>
                    <p class="price">$${product.precio.toFixed(2)}</p>
                    ${product.temporada ? `<p>Temp ${product.temporada} - Cap ${product.episodio}</p>` : ''}
                </div>
                <div class="product-actions">
                    <button class="edit-product" data-id="${product.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-product" data-id="${product.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bindear eventos de edición/eliminación
        document.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', () => this.editProduct(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', () => this.deleteProduct(btn.dataset.id));
        });
    },
    
    editProduct: async function(id) {
        const product = (await DB.obtenerProductos()).find(p => p.id === id);
        if (!product) return;
        
        // Crear modal de edición
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <span class="close-modal">&times;</span>
                <h2>Editar Producto</h2>
                <form id="edit-product-form">
                    <label>Título:</label>
                    <input type="text" id="edit-titulo" value="${product.titulo}">
                    
                    <label>Sinopsis:</label>
                    <textarea id="edit-sinopsis">${product.sinopsis}</textarea>
                    
                    <label>Año:</label>
                    <input type="text" id="edit-anio" value="${product.anio}">
                    
                    <label>Precio:</label>
                    <input type="number" id="edit-precio" value="${product.precio}" step="0.01">
                    
                    <label>URL del Poster:</label>
                    <input type="text" id="edit-poster" value="${product.poster}">
                    
                    <label>URL del Trailer (YouTube embed):</label>
                    <input type="text" id="edit-trailer" value="${product.trailer || ''}">
                    
                    <button type="submit" class="btn-primary">Guardar</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        
        modal.querySelector('#edit-product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            product.titulo = document.getElementById('edit-titulo').value;
            product.sinopsis = document.getElementById('edit-sinopsis').value;
            product.anio = document.getElementById('edit-anio').value;
            product.precio = parseFloat(document.getElementById('edit-precio').value);
            product.poster = document.getElementById('edit-poster').value;
            product.trailer = document.getElementById('edit-trailer').value;
            product.fecha_actualizacion = new Date().toISOString();
            
            await DB.guardarProducto(product);
            modal.remove();
            this.loadProducts();
            alert('Producto actualizado correctamente');
        });
    },
    
    deleteProduct: async function(id) {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            await DB.eliminarProducto(id);
            this.loadProducts();
            alert('Producto eliminado');
        }
    },
    
    loadOrders: async function() {
        const orders = await DB.obtenerPedidos();
        const container = document.getElementById('orders-list');
        
        if (!container) return;
        
        if (orders.length === 0) {
            container.innerHTML = '<p>No hay pedidos aún.</p>';
            return;
        }
        
        this.allOrders = orders.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        this.renderOrders(this.allOrders);
    },
    
    renderOrders: function(orders) {
        const container = document.getElementById('orders-list');
        if (!container) return;
        
        container.innerHTML = orders.map(order => `
            <div class="order-card" data-code="${order.codigo}">
                <div class="order-header">
                    <span class="order-code">Código: ${order.codigo}</span>
                    <span>${new Date(order.fecha).toLocaleString()}</span>
                </div>
                <div>Usuario: ${order.usuario}</div>
                <div>Total: $${order.total.toFixed(2)}</div>
                <div class="order-items">
                    <strong>Items:</strong>
                    ${order.items.map(item => `
                        <div class="order-item">
                            <span>${item.titulo}</span>
                            <span>x${item.cantidad}</span>
                            <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="delete-order" data-code="${order.codigo}">Eliminar Pedido</button>
            </div>
        `).join('');
        
        // Bindear eventos de eliminación
        document.querySelectorAll('.delete-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Eliminar este pedido?')) {
                    const code = btn.dataset.code;
                    // Implementar eliminación en db.js
                    const db = await DB.openDB();
                    const tx = db.transaction('pedidos', 'readwrite');
                    tx.objectStore('pedidos').delete(code);
                    tx.oncomplete = () => {
                        this.loadOrders();
                        this.loadStats();
                    };
                }
            });
        });
    },
    
    searchOrders: function() {
        const searchTerm = document.getElementById('order-search')?.value.toLowerCase() || '';
        
        if (!searchTerm) {
            this.renderOrders(this.allOrders);
            return;
        }
        
        const filtered = this.allOrders.filter(order => 
            order.codigo.toLowerCase().includes(searchTerm) ||
            order.usuario.toLowerCase().includes(searchTerm)
        );
        
        this.renderOrders(filtered);
    },
    
    exportOrders: async function() {
        const orders = await DB.obtenerPedidos();
        const exportData = orders.map(order => ({
            codigo: order.codigo,
            usuario: order.usuario,
            fecha: order.fecha,
            total: order.total,
            items: order.items.map(item => ({
                titulo: item.titulo,
                cantidad: item.cantidad,
                precio: item.precio
            }))
        }));
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedidos_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    savePrices: async function() {
        const prices = {
            peliculas: document.getElementById('price-peliculas')?.value,
            series: document.getElementById('price-series')?.value,
            novelas: document.getElementById('price-novelas')?.value,
            shows: document.getElementById('price-shows')?.value,
            animados: document.getElementById('price-animados')?.value,
            animes: document.getElementById('price-animes')?.value
        };
        
        // Guardar en localStorage temporalmente
        localStorage.setItem('custom_prices', JSON.stringify(prices));
        
        // También podríamos actualizar los productos existentes
        const products = await DB.obtenerProductos();
        for (const product of products) {
            const newPrice = parseFloat(prices[product.seccion]);
            if (newPrice && product.precio !== newPrice) {
                product.precio = newPrice;
                await DB.guardarProducto(product);
            }
        }
        
        alert('Precios guardados y actualizados en productos');
    },
    
    saveApiKey: function() {
        const apiKey = document.getElementById('tmdb-api-key')?.value;
        if (apiKey) {
            localStorage.setItem('tmdb_api_key', apiKey);
            window.CONFIG.TMDB_API_KEY = apiKey;
            alert('API Key guardada correctamente');
        }
    },
    
    saveGitHubRepo: function() {
        const repo = document.getElementById('github-repo')?.value;
        if (repo) {
            localStorage.setItem('github_repo', repo);
            window.CONFIG.GITHUB_REPO = repo;
            alert('Repositorio guardado correctamente');
        }
    },
    
    syncAllTMDB: async function() {
        if (!window.CONFIG.TMDB_API_KEY) {
            alert('Por favor configura tu API Key de TMDB primero');
            return;
        }
        
        if (confirm('¿Sincronizar todos los productos con TMDB? Este proceso puede tomar varios minutos.')) {
            const syncProgress = document.getElementById('sync-progress');
            if (syncProgress) syncProgress.style.display = 'block';
            
            try {
                const result = await adminTools.syncAllWithTMDB();
                alert(`Sincronización completada. Actualizados: ${result.updated} de ${result.total}`);
            } catch (error) {
                alert('Error durante la sincronización: ' + error.message);
            } finally {
                if (syncProgress) syncProgress.style.display = 'none';
            }
        }
    },
    
    exportDatabase: async function() {
        const data = await adminTools.exportDatabase();
        alert('Base de datos exportada correctamente');
    },
    
    importDatabase: function() {
        const fileInput = document.getElementById('import-file');
        fileInput.click();
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (confirm('¿Importar base de datos? Esto reemplazará los datos actuales.')) {
                    try {
                        await adminTools.importDatabase(file);
                        alert('Base de datos importada correctamente');
                        location.reload();
                    } catch (error) {
                        alert('Error al importar: ' + error.message);
                    }
                }
            }
        };
    },
    
    resetDatabase: async function() {
        await adminTools.resetDatabase();
    }
};

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});