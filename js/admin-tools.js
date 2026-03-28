// admin-tools.js - Herramientas específicas para el administrador
window.CONFIG = {
    GITHUB_REPO: '',
    TMDB_API_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MzA3MzUwZDBiMTY2MDU4ZDFiOTI2YWFkNzkzZWVlYyIsIm5iZiI6MTc3Mzk0ODgzMy44MzIsInN1YiI6IjY5YmM0ZmExMjAxNGE5MWU2M2FhZmZhMyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.JIq_kDsLUYIFV-x8QzvPtwwpYdraLcSecdmW9upWbOw',
    UPDATE_EXISTING: true,
    FETCH_TMDB: true,
    SCAN_RECURSIVE: true
};

class AdminTools {
    constructor() {
        this.scanner = null;
        this.loadConfig();
    }

    // Cargar configuración guardada
    async loadConfig() {
        const savedConfig = localStorage.getItem('admin_config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            window.CONFIG = { ...window.CONFIG, ...config };
        }
    }

    // Guardar configuración
    saveConfig() {
        localStorage.setItem('admin_config', JSON.stringify(window.CONFIG));
    }

    // Iniciar escaneo de archivos
    async startFileScan(options = {}) {
        const {
            recursive = true,
            updateExisting = true,
            fetchTMDB = true
        } = options;
        
        // Actualizar configuración
        window.CONFIG.UPDATE_EXISTING = updateExisting;
        window.CONFIG.FETCH_TMDB = fetchTMDB;
        window.CONFIG.SCAN_RECURSIVE = recursive;
        
        // Crear nuevo scanner
        this.scanner = new FileScanner();
        
        // Configurar callbacks
        this.scanner.onProgress = (progress) => {
            this.updateScanProgress(progress);
        };
        
        this.scanner.onLog = (log) => {
            this.addScanLog(log);
        };
        
        try {
            const stats = await this.scanner.scanAllFiles('data/', recursive);
            return stats;
        } catch (error) {
            console.error('Error en escaneo:', error);
            throw error;
        }
    }

    // Detener escaneo
    stopFileScan() {
        if (this.scanner) {
            this.scanner.stop();
        }
    }

    // Actualizar progreso en UI
    updateScanProgress(progress) {
        const percent = (progress.current / progress.total * 100).toFixed(1);
        const progressBar = document.getElementById('scan-progress-bar');
        const progressText = document.getElementById('scan-progress-text');
        const currentFile = document.getElementById('scan-current-file');
        const processedCount = document.getElementById('processed-count');
        const newCount = document.getElementById('new-count');
        const existingCount = document.getElementById('existing-count');
        const errorCount = document.getElementById('error-count');
        
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${percent}%`;
        if (currentFile) currentFile.textContent = `Procesando: ${progress.file}`;
        if (processedCount) processedCount.textContent = progress.current;
        if (newCount) newCount.textContent = progress.stats.new;
        if (existingCount) existingCount.textContent = progress.stats.existing;
        if (errorCount) errorCount.textContent = progress.stats.errors;
    }

    // Agregar log al panel
    addScanLog(log) {
        const resultsContainer = document.getElementById('scan-results');
        if (!resultsContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `scan-result-item ${log.type}`;
        logEntry.innerHTML = `
            <strong>${log.filename}</strong> - ${log.message}
            <span style="color: #666; font-size: 0.8rem; margin-left: 1rem;">
                ${new Date(log.timestamp).toLocaleTimeString()}
            </span>
        `;
        
        resultsContainer.insertBefore(logEntry, resultsContainer.firstChild);
        
        // Limitar a 100 entradas
        while (resultsContainer.children.length > 100) {
            resultsContainer.removeChild(resultsContainer.lastChild);
        }
    }

    // Limpiar cache de resultados
    clearScanResults() {
        const resultsContainer = document.getElementById('scan-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    }

    // Sincronizar todos los productos con TMDB
    async syncAllWithTMDB() {
        const products = await DB.obtenerProductos();
        let processed = 0;
        let updated = 0;
        
        const progressBar = document.getElementById('sync-progress-bar');
        const statusDiv = document.getElementById('sync-status');
        
        for (const product of products) {
            processed++;
            const percent = (processed / products.length * 100).toFixed(1);
            
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (statusDiv) {
                statusDiv.innerHTML = `Procesando ${processed}/${products.length}: ${product.titulo}`;
            }
            
            // Buscar información actualizada en TMDB
            const tmdbType = product.tipo_contenido === 'pelicula' ? 'movie' : 'tv';
            const searchUrl = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${window.CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(product.titulo)}&language=es`;
            
            try {
                const response = await fetch(searchUrl);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    let updatedProduct = { ...product };
                    
                    // Actualizar datos
                    updatedProduct.titulo = result.title || result.name;
                    updatedProduct.sinopsis = result.overview || product.sinopsis;
                    updatedProduct.anio = (result.release_date || result.first_air_date || '').split('-')[0];
                    updatedProduct.fecha_estreno = result.release_date || result.first_air_date;
                    updatedProduct.poster = result.poster_path ? 
                        `https://image.tmdb.org/t/p/w500${result.poster_path}` : product.poster;
                    updatedProduct.fecha_actualizacion = new Date().toISOString();
                    
                    // Obtener trailer
                    const videoUrl = `https://api.themoviedb.org/3/${tmdbType}/${result.id}/videos?api_key=${window.CONFIG.TMDB_API_KEY}&language=es`;
                    const videoResponse = await fetch(videoUrl);
                    const videoData = await videoResponse.json();
                    const trailer = videoData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                    if (trailer) {
                        updatedProduct.trailer = `https://www.youtube.com/embed/${trailer.key}`;
                    }
                    
                    await DB.guardarProducto(updatedProduct);
                    updated++;
                }
                
                // Pequeña pausa para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 250));
                
            } catch (error) {
                console.error(`Error sincronizando ${product.titulo}:`, error);
            }
        }
        
        if (statusDiv) {
            statusDiv.innerHTML = `Sincronización completada. Actualizados: ${updated} de ${products.length}`;
        }
        
        return { total: products.length, updated };
    }

    // Exportar base de datos completa
    async exportDatabase() {
        const productos = await DB.obtenerProductos();
        const pedidos = await DB.obtenerPedidos();
        const usuarios = await this.getAllUsers();
        
        const exportData = {
            version: '1.0',
            fecha_exportacion: new Date().toISOString(),
            productos,
            pedidos,
            usuarios,
            config: window.CONFIG
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `streamstore_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return exportData;
    }

    // Importar base de datos
    async importDatabase(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Importar productos
                    for (const product of data.productos) {
                        await DB.guardarProducto(product);
                    }
                    
                    // Importar pedidos
                    for (const pedido of data.pedidos) {
                        await DB.guardarPedido(pedido);
                    }
                    
                    // Importar usuarios
                    for (const usuario of data.usuarios) {
                        await DB.registrarUsuario(usuario);
                    }
                    
                    // Importar configuración
                    if (data.config) {
                        window.CONFIG = { ...window.CONFIG, ...data.config };
                        this.saveConfig();
                    }
                    
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // Obtener todos los usuarios
    async getAllUsers() {
        // Esta función requeriría un método en db.js para obtener todos los usuarios
        // Por ahora retornamos array vacío
        return [];
    }

    // Resetear base de datos
    async resetDatabase() {
        if (confirm('¿Estás seguro de resetear toda la base de datos? Esta acción no se puede deshacer.')) {
            // Limpiar todas las stores
            const db = await DB.openDB();
            const stores = ['productos', 'usuarios', 'pedidos'];
            
            for (const store of stores) {
                const tx = db.transaction(store, 'readwrite');
                const objectStore = tx.objectStore(store);
                await objectStore.clear();
                await new Promise(resolve => { tx.oncomplete = resolve; });
            }
            
            // Recargar admin
            location.reload();
        }
    }

    // Obtener estadísticas
    async getStats() {
        const productos = await DB.obtenerProductos();
        const pedidos = await DB.obtenerPedidos();
        const usuarios = await this.getAllUsers();
        
        const stats = {
            total_productos: productos.length,
            por_seccion: {},
            total_pedidos: pedidos.length,
            total_usuarios: usuarios.length,
            valor_total_pedidos: pedidos.reduce((sum, p) => sum + p.total, 0)
        };
        
        // Contar por sección
        for (const product of productos) {
            stats.por_seccion[product.seccion] = (stats.por_seccion[product.seccion] || 0) + 1;
        }
        
        return stats;
    }

    // Obtener últimos productos
    async getRecentProducts(limit = 10) {
        const productos = await DB.obtenerProductos();
        return productos
            .sort((a, b) => new Date(b.fecha_agregado) - new Date(a.fecha_agregado))
            .slice(0, limit);
    }
}

// Exportar para uso global
window.AdminTools = AdminTools;