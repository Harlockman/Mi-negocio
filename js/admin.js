// admin.js - Controlador del panel de administración (versión con parser de HTML)

let adminTools = null;
let currentUser = null;
let fileParser = null;

const Admin = {
    init: async function() {
        // Verificar sesión de admin
        await this.checkAdminSession();
        
        // Inicializar herramientas
        adminTools = new AdminTools();
        fileParser = new FileParser();
        
        // Configurar callbacks del parser
        fileParser.onLog = (log) => {
            this.addParserLog(log);
        };
        
        // Cargar configuración inicial
        await this.loadInitialData();
        
        // Configurar event listeners
        this.bindEvents();
        
        // Cargar tab activo
        this.loadActiveTab();
    },
    
    checkAdminSession: async function() {
        const adminUser = localStorage.getItem('admin_logged');
        if (!adminUser) {
            window.location.href = 'index.html';
            return;
        }
        
        const user = JSON.parse(adminUser);
        if (user.telefono !== 'altairdbb' || user.password !== 'altairdbb') {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        const adminUserSpan = document.getElementById('admin-user');
        if (adminUserSpan) adminUserSpan.textContent = user.nombre;
    },
    
    loadInitialData: async function() {
        await this.loadStats();
        await this.loadRecentProducts();
        await this.loadPrices();
        
        // Cargar configuración guardada
        const savedApiKey = localStorage.getItem('tmdb_api_key');
        if (savedApiKey && document.getElementById('tmdb-api-key')) {
            document.getElementById('tmdb-api-key').value = savedApiKey;
            window.CONFIG.TMDB_API_KEY = savedApiKey;
        }
        
        const savedRepo = localStorage.getItem('github_repo');
        if (savedRepo && document.getElementById('github-repo')) {
            document.getElementById('github-repo').value = savedRepo;
            window.CONFIG.GITHUB_REPO = savedRepo;
        }
    },
    
    loadStats: async function() {
        const stats = await adminTools.getStats();
        
        const elements = {
            'total-peliculas': stats.por_seccion?.peliculas || 0,
            'total-series': stats.por_seccion?.series || 0,
            'total-novelas': stats.por_seccion?.novelas || 0,
            'total-shows': stats.por_seccion?.shows || 0,
            'total-animados': stats.por_seccion?.animados || 0,
            'total-animes': stats.por_seccion?.animes || 0,
            'total-pedidos': stats.total_pedidos || 0,
            'total-usuarios': stats.total_usuarios || 0
        };
        
        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    },
    
    loadRecentProducts: async function() {
        const products = await adminTools.getRecentProducts(10);
        const container = document.getElementById('recent-products');
        
        if (!container) return;
        
        if (products.length === 0) {
            container.innerHTML = '<p>No hay productos aún. Procesa el archivo de estructura para comenzar.</p>';
            return;
        }
        
        container.innerHTML = products.map(product => `
            <div class="recent-product" style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border-bottom: 1px solid #333;">
                <img src="${product.poster}" alt="${product.titulo}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 4px;">
                <div>
                    <strong>${product.titulo}</strong>
                    <p style="font-size: 0.8rem; color: #aaa;">${product.seccion} • ${product.anio}</p>
                </div>
            </div>
        `).join('');
    },
    
    loadPrices: async function() {
        try {
            // Intentar cargar desde localStorage primero
            const customPrices = localStorage.getItem('custom_prices');
            if (customPrices) {
                const prices = JSON.parse(customPrices);
                for (const [key, value] of Object.entries(prices)) {
                    const input = document.getElementById(`price-${key}`);
                    if (input) input.value = value;
                }
                return;
            }
            
            // Si no hay precios personalizados, cargar desde prices.txt
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
        const logoutBtn = document.getElementById('admin-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('admin_logged');
                window.location.href = 'index.html';
            });
        }
        
        // Botones de procesamiento de estructura HTML
        const uploadBtn = document.getElementById('btn-upload-structure');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadStructureFile());
        }
        
        // Botones de productos
        const refreshBtn = document.getElementById('btn-refresh-products');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadProducts());
        
        const searchInput = document.getElementById('product-search');
        if (searchInput) searchInput.addEventListener('input', () => this.filterProducts());
        
        const categoryFilter = document.getElementById('product-category-filter');
        if (categoryFilter) categoryFilter.addEventListener('change', () => this.filterProducts());
        
        // Botones de pedidos
        const searchOrderBtn = document.getElementById('btn-search-order');
        if (searchOrderBtn) searchOrderBtn.addEventListener('click', () => this.searchOrders());
        
        const exportOrdersBtn = document.getElementById('btn-export-orders');
        if (exportOrdersBtn) exportOrdersBtn.addEventListener('click', () => this.exportOrders());
        
        // Botones de precios
        const savePricesBtn = document.getElementById('btn-save-prices');
        if (savePricesBtn) savePricesBtn.addEventListener('click', () => this.savePrices());
        
        const loadPricesBtn = document.getElementById('btn-load-prices');
        if (loadPricesBtn) loadPricesBtn.addEventListener('click', () => this.loadPrices());
        
        // Botones de sincronización
        const syncAllBtn = document.getElementById('btn-sync-all-tmdb');
        if (syncAllBtn) syncAllBtn.addEventListener('click', () => this.syncAllTMDB());
        
        // Botones de configuración
        const saveApiKeyBtn = document.getElementById('btn-save-api-key');
        if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        
        const saveGithubBtn = document.getElementById('btn-save-github');
        if (saveGithubBtn) saveGithubBtn.addEventListener('click', () => this.saveGitHubRepo());
        
        const exportDbBtn = document.getElementById('btn-export-db');
        if (exportDbBtn) exportDbBtn.addEventListener('click', () => this.exportDatabase());
        
        const importDbBtn = document.getElementById('btn-import-db');
        if (importDbBtn) importDbBtn.addEventListener('click', () => this.importDatabase());
        
        const resetDbBtn = document.getElementById('btn-reset-db');
        if (resetDbBtn) resetDbBtn.addEventListener('click', () => this.resetDatabase());
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
    
    uploadStructureFile: function() {
        const fileInput = document.getElementById('structure-file-input');
        if (!fileInput) return;
        
        fileInput.click();
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file && file.name.endsWith('.html')) {
                await this.processStructureFile(file);
            } else {
                alert('Por favor selecciona un archivo HTML válido (generado por Snap2HTML)');
            }
        };
    },
    
    processStructureFile: async function(file) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        
        // Mostrar área de progreso
        const progressDiv = document.getElementById('scan-progress');
        if (progressDiv) progressDiv.style.display = 'block';
        
        const resultsContainer = document.getElementById('scan-results');
        if (resultsContainer) resultsContainer.innerHTML = '';
        
        try {
            const htmlContent = await this.readFileAsText(file);
            
            const result = await fileParser.parseStructureHTML(htmlContent);
            
            alert(`Procesamiento completado!\n\nTotal archivos encontrados: ${result.stats.total}\nNuevos productos: ${result.stats.new}\nProductos existentes: ${result.stats.existing}\nErrores: ${result.stats.errors}`);
            
            // Recargar estadísticas y productos
            await this.loadStats();
            await this.loadProducts();
            
        } catch (error) {
            console.error('Error procesando archivo:', error);
            alert('Error al procesar el archivo: ' + error.message);
        } finally {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    },
    
    readFileAsText: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e.target.error);
            reader.readAsText(file);
        });
    },
    
    addParserLog: function(log) {
        const resultsContainer = document.getElementById('scan-results');
        if (!resultsContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `scan-result-item ${log.type}`;
        logEntry.innerHTML = `
            <strong>${log.name}</strong> - ${log.message}
            <span style="color: #666; font-size: 0.8rem; margin-left: 1rem;">
                ${new Date(log.timestamp).toLocaleTimeString()}
            </span>
        `;
        
        resultsContainer.insertBefore(logEntry, resultsContainer.firstChild);
        
        // Limitar a 100 entradas
        while (resultsContainer.children.length > 100) {
            resultsContainer.removeChild(resultsContainer.lastChild);
        }
    },
    
    loadProducts: async function() {
        const products = await DB.obtenerProductos();
        const container = document.getElementById('products-list');
        
        if (!container) return;
        
        if (products.length === 0) {
            container.innerHTML = '<p>No hay productos. Procesa un archivo de estructura para comenzar.</p>';
            return;
        }
        
        this.allProducts = products;
        this.filterProducts();
    },
    
    filterProducts: function() {
        const searchTerm = document.getElementById('product-search')?.value.toLowerCase() || '';
        const category = document.getElementById('product-category-filter')?.value || '';
        
        let filtered = this.allProducts || [];
        
        if (searchTerm) {
            filtered = filtered.filter(p => 
                p.titulo?.toLowerCase().includes(searchTerm) ||
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
        
        if (products.length === 0) {
            container.innerHTML = '<p>No se encontraron productos.</p>';
            return;
        }
        
        container.innerHTML = products.map(product => `
            <div class="product-item" data-id="${product.id}">
                <img src="${product.poster}" alt="${product.titulo}" 
                     onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'"
                     style="width: 60px; height: 90px; object-fit: cover; border-radius: 4px;">
                <div class="product-info" style="flex: 1;">
                    <h4>${product.titulo}</h4>
                    <p style="color: #aaa; font-size: 0.8rem;">${product.seccion} • ${product.anio}</p>
                    <p style="color: #e50914; font-weight: bold;">$${product.precio?.toFixed(2) || '0.00'}</p>
                    ${product.temporada ? `<p style="font-size: 0.8rem;">Temp ${product.temporada} - Cap ${product.episodio}</p>` : ''}
                </div>
                <div class="product-actions" style="display: flex; gap: 0.5rem;">
                    <button class="edit-product" data-id="${product.id}" style="padding: 0.5rem; background: #333; border: none; color: #fff; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-product" data-id="${product.id}" style="padding: 0.5rem; background: #333; border: none; color: #fff; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Bindear eventos
        document.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', () => this.editProduct(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', () => this.deleteProduct(btn.dataset.id));
        });
    },
    
    editProduct: async function(id) {
        const allProducts = await DB.obtenerProductos();
        const product = allProducts.find(p => p.id === id);
        if (!product) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <span class="close-modal" style="float: right; font-size: 1.5rem; cursor: pointer;">&times;</span>
                <h2>Editar Producto</h2>
                <form id="edit-product-form">
                    <div style="margin-bottom: 1rem;">
                        <label>Título:</label>
                        <input type="text" id="edit-titulo" value="${product.titulo.replace(/"/g, '&quot;')}" style="width: 100%; padding: 0.5rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>Sinopsis:</label>
                        <textarea id="edit-sinopsis" style="width: 100%; padding: 0.5rem; min-height: 100px;">${product.sinopsis.replace(/"/g, '&quot;')}</textarea>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>Año:</label>
                        <input type="text" id="edit-anio" value="${product.anio}" style="width: 100%; padding: 0.5rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>Precio:</label>
                        <input type="number" id="edit-precio" value="${product.precio}" step="0.01" style="width: 100%; padding: 0.5rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>URL del Poster:</label>
                        <input type="text" id="edit-poster" value="${product.poster}" style="width: 100%; padding: 0.5rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>URL del Trailer:</label>
                        <input type="text" id="edit-trailer" value="${product.trailer || ''}" style="width: 100%; padding: 0.5rem;">
                    </div>
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
            await this.loadStats();
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
            <div class="order-card" style="background: #1f1f1f; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #333;">
                    <span style="color: #e50914; font-weight: bold;">Código: ${order.codigo}</span>
                    <span>${new Date(order.fecha).toLocaleString()}</span>
                </div>
                <div>Usuario: ${order.usuario}</div>
                <div>Total: $${order.total?.toFixed(2) || '0.00'}</div>
                <div style="margin-top: 0.5rem; padding-left: 1rem;">
                    <strong>Items:</strong>
                    ${order.items?.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                            <span>${item.titulo}</span>
                            <span>x${item.cantidad}</span>
                            <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                    `).join('') || '<p>No hay items</p>'}
                </div>
                <button class="delete-order" data-code="${order.codigo}" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #dc3545; border: none; color: #fff; border-radius: 4px; cursor: pointer;">
                    Eliminar Pedido
                </button>
            </div>
        `).join('');
        
        document.querySelectorAll('.delete-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Eliminar este pedido?')) {
                    const code = btn.dataset.code;
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
        
        if (!searchTerm || !this.allOrders) {
            this.renderOrders(this.allOrders || []);
            return;
        }
        
        const filtered = this.allOrders.filter(order => 
            order.codigo?.toLowerCase().includes(searchTerm) ||
            order.usuario?.toLowerCase().includes(searchTerm)
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
            items: order.items
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
        
        // Guardar en localStorage
        localStorage.setItem('custom_prices', JSON.stringify(prices));
        
        // Actualizar productos existentes
        const products = await DB.obtenerProductos();
        let updated = 0;
        
        for (const product of products) {
            const newPrice = parseFloat(prices[product.seccion]);
            if (newPrice && product.precio !== newPrice) {
                product.precio = newPrice;
                await DB.guardarProducto(product);
                updated++;
            }
        }
        
        alert(`Precios guardados. Se actualizaron ${updated} productos.`);
    },
    
    saveApiKey: function() {
        const apiKey = document.getElementById('tmdb-api-key')?.value;
        if (apiKey) {
            localStorage.setItem('tmdb_api_key', apiKey);
            if (window.TMDB) window.TMDB.config.apiKey = apiKey;
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
        const apiKey = localStorage.getItem('tmdb_api_key');
        if (!apiKey) {
            alert('Por favor configura tu API Key de TMDB primero');
            return;
        }
        
        if (!confirm('¿Sincronizar todos los productos con TMDB? Este proceso puede tomar varios minutos.')) {
            return;
        }
        
        const syncProgress = document.getElementById('sync-progress');
        if (syncProgress) syncProgress.style.display = 'block';
        
        const products = await DB.obtenerProductos();
        let processed = 0;
        let updated = 0;
        
        for (const product of products) {
            processed++;
            const percent = (processed / products.length * 100).toFixed(1);
            
            const progressBar = document.getElementById('sync-progress-bar');
            const statusDiv = document.getElementById('sync-status');
            
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (statusDiv) statusDiv.textContent = `Procesando ${processed}/${products.length}: ${product.titulo}`;
            
            const tmdbType = product.tipo_contenido === 'pelicula' ? 'movie' : 'tv';
            
            try {
                const info = await window.TMDB.searchAndGetInfo(product.titulo, tmdbType);
                
                if (info) {
                    let updatedProduct = { ...product };
                    updatedProduct.titulo = info.titulo;
                    updatedProduct.sinopsis = info.sinopsis || product.sinopsis;
                    updatedProduct.anio = info.anio || product.anio;
                    updatedProduct.fecha_estreno = info.fecha_estreno;
                    updatedProduct.poster = info.poster || product.poster;
                    updatedProduct.trailer = info.trailer || product.trailer;
                    updatedProduct.fecha_actualizacion = new Date().toISOString();
                    
                    await DB.guardarProducto(updatedProduct);
                    updated++;
                }
                
                // Pequeña pausa para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`Error sincronizando ${product.titulo}:`, error);
            }
        }
        
        if (statusDiv) statusDiv.textContent = `Sincronización completada. Actualizados: ${updated} de ${products.length}`;
        alert(`Sincronización completada. Actualizados: ${updated} de ${products.length}`);
        
        this.loadProducts();
        await this.loadStats();
    },
    
    exportDatabase: async function() {
        const data = await adminTools.exportDatabase();
        alert('Base de datos exportada correctamente');
    },
    
    importDatabase: function() {
        const fileInput = document.getElementById('import-file');
        if (fileInput) fileInput.click();
        
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