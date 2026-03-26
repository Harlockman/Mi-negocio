// file-scanner.js - Escáner de archivos desde GitHub
class FileScanner {
    constructor() {
        this.isScanning = false;
        this.shouldStop = false;
        this.processedFiles = new Set();
        this.stats = {
            total: 0,
            new: 0,
            existing: 0,
            errors: 0
        };
    }

    // Escanear todos los archivos recursivamente
    async scanAllFiles(basePath = 'data/', recursive = true) {
        this.isScanning = true;
        this.shouldStop = false;
        this.resetStats();
        
        try {
            // Obtener todos los archivos recursivamente
            const files = await this.getAllFilesRecursive(basePath, recursive);
            this.stats.total = files.length;
            
            for (let i = 0; i < files.length && !this.shouldStop; i++) {
                const file = files[i];
                await this.processFile(file, i + 1, files.length);
            }
            
            return this.stats;
        } finally {
            this.isScanning = false;
        }
    }

    // Obtener todos los archivos recursivamente desde GitHub
    async getAllFilesRecursive(path, recursive, currentDepth = 0, maxDepth = 10) {
        if (currentDepth > maxDepth) return [];
        
        const files = [];
        const contents = await this.getDirectoryContents(path);
        
        for (const item of contents) {
            if (item.type === 'file') {
                // Verificar extensiones válidas
                const validExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.mpg', '.mpeg'];
                const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
                if (validExtensions.includes(ext)) {
                    files.push({
                        name: item.name,
                        path: item.path,
                        download_url: item.download_url,
                        type: this.detectContentType(item.name, path)
                    });
                }
            } else if (item.type === 'dir' && recursive) {
                const subFiles = await this.getAllFilesRecursive(item.path, recursive, currentDepth + 1, maxDepth);
                files.push(...subFiles);
            }
        }
        
        return files;
    }

    // Obtener contenido de un directorio desde GitHub
    async getDirectoryContents(path) {
        const url = `https://api.github.com/repos/${window.CONFIG.GITHUB_REPO}/contents/${path}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error al leer directorio: ${path}`);
        }
        return await response.json();
    }

    // Detectar tipo de contenido basado en la ruta
    detectContentType(filename, path) {
        const pathLower = path.toLowerCase();
        const nameLower = filename.toLowerCase();
        
        // Mapeo de carpetas a tipos
        const typeMap = {
            'peliculas': 'peliculas',
            'movies': 'peliculas',
            'series': 'series',
            'tvshows': 'series',
            'novelas': 'novelas',
            'telenovelas': 'novelas',
            'shows': 'shows',
            'animados': 'animados',
            'cartoons': 'animados',
            'animes': 'animes',
            'anime': 'animes'
        };
        
        for (const [folder, type] of Object.entries(typeMap)) {
            if (pathLower.includes(folder)) {
                return type;
            }
        }
        
        // Si no se detecta por carpeta, intentar por nombre de archivo
        if (nameLower.includes('s0') || nameLower.includes('x0') || nameLower.match(/\d+x\d+/)) {
            return 'series';
        }
        
        return 'peliculas';
    }

    // Procesar un archivo individual
    async processFile(file, current, total) {
        try {
            // Verificar si ya existe en la base de datos
            const existingProduct = await this.checkExistingProduct(file);
            
            if (existingProduct && !window.CONFIG.UPDATE_EXISTING) {
                this.stats.existing++;
                this.logResult(file.name, 'skip', 'Ya existe en la base de datos');
                return;
            }
            
            // Extraer información del nombre del archivo
            const fileInfo = this.extractFileInfo(file);
            
            // Buscar en TMDB si está configurado
            let tmdbData = null;
            if (window.CONFIG.FETCH_TMDB) {
                tmdbData = await this.fetchTMDBInfo(fileInfo, file.type);
            }
            
            // Crear o actualizar producto
            const product = this.createProduct(file, fileInfo, tmdbData);
            await DB.guardarProducto(product);
            
            this.stats.new++;
            this.logResult(file.name, 'success', 'Producto agregado/actualizado');
            
        } catch (error) {
            this.stats.errors++;
            this.logResult(file.name, 'error', error.message);
            console.error(`Error procesando ${file.name}:`, error);
        }
        
        // Actualizar progreso
        if (this.onProgress) {
            this.onProgress({
                current,
                total,
                file: file.name,
                stats: this.stats
            });
        }
    }

    // Verificar si el producto ya existe
    async checkExistingProduct(file) {
        const allProducts = await DB.obtenerProductos();
        // Buscar por nombre de archivo o por ID basado en el nombre limpio
        const cleanName = this.cleanFileName(file.name);
        return allProducts.find(p => 
            p.id === cleanName || 
            p.archivo === file.name ||
            p.titulo === cleanName
        );
    }

    // Extraer información del nombre del archivo
    extractFileInfo(file) {
        const name = file.name;
        const cleanName = this.cleanFileName(name);
        
        // Detectar temporada y episodio
        const seasonMatch = name.match(/[Ss](\d+)[Ee](\d+)/) || name.match(/(\d+)x(\d+)/);
        const season = seasonMatch ? parseInt(seasonMatch[1]) : null;
        const episode = seasonMatch ? parseInt(seasonMatch[2]) : null;
        
        // Detectar título (sin números de temporada/episodio)
        let title = cleanName;
        if (seasonMatch) {
            title = cleanName.replace(/[Ss]\d+[Ee]\d+|\d+x\d+/, '').trim();
        }
        
        return {
            cleanName,
            title: title || cleanName,
            season,
            episode,
            extension: name.substring(name.lastIndexOf('.')),
            isSeries: season !== null
        };
    }

    // Limpiar nombre de archivo
    cleanFileName(filename) {
        // Quitar extensión
        let name = filename.replace(/\.[^/.]+$/, "");
        // Quitar calidad y grupos
        name = name.replace(/\[.*?\]|\(.*?\)/g, '');
        // Quitar información de audio
        name = name.replace(/\[[^\]]*?(?:Dual|Latino|Español|Inglés)[^\]]*?\]/gi, '');
        // Normalizar espacios
        name = name.replace(/[._-]/g, ' ').trim();
        return name;
    }

    // Buscar información en TMDB
    async fetchTMDBInfo(fileInfo, type) {
        const tmdbType = type === 'peliculas' ? 'movie' : 'tv';
        const searchUrl = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${window.CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(fileInfo.title)}&language=es`;
        
        try {
            const response = await fetch(searchUrl);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                
                // Obtener trailer
                let trailer = null;
                const videoUrl = `https://api.themoviedb.org/3/${tmdbType}/${result.id}/videos?api_key=${window.CONFIG.TMDB_API_KEY}&language=es`;
                const videoResponse = await fetch(videoUrl);
                const videoData = await videoResponse.json();
                const trailerVideo = videoData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                if (trailerVideo) {
                    trailer = `https://www.youtube.com/embed/${trailerVideo.key}`;
                }
                
                return {
                    id: result.id,
                    titulo: result.title || result.name,
                    sinopsis: result.overview,
                    anio: (result.release_date || result.first_air_date || '').split('-')[0],
                    poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
                    trailer: trailer,
                    fecha_estreno: result.release_date || result.first_air_date
                };
            }
        } catch (error) {
            console.warn(`Error buscando en TMDB para ${fileInfo.title}:`, error);
        }
        
        return null;
    }

    // Crear objeto producto
    createProduct(file, fileInfo, tmdbData) {
        const baseProduct = {
            id: fileInfo.cleanName,
            archivo: file.name,
            ruta_completa: file.path,
            seccion: file.type,
            tipo_contenido: fileInfo.isSeries ? 'serie' : 'pelicula',
            titulo: tmdbData?.titulo || fileInfo.title,
            nombre_original: fileInfo.cleanName,
            precio: this.getPriceForType(file.type),
            sinopsis: tmdbData?.sinopsis || 'Sin información disponible.',
            anio: tmdbData?.anio || 'Desconocido',
            fecha_estreno: tmdbData?.fecha_estreno || null,
            poster: tmdbData?.poster || this.getDefaultPoster(file.type),
            trailer: tmdbData?.trailer || null,
            extension: fileInfo.extension,
            tamaño: null, // Se podría obtener si se desea
            fecha_agregado: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
        };
        
        // Información específica para series
        if (fileInfo.isSeries) {
            baseProduct.temporada = fileInfo.season;
            baseProduct.episodio = fileInfo.episode;
            baseProduct.numero_capitulo = fileInfo.episode;
        }
        
        return baseProduct;
    }

    // Obtener precio según el tipo
    getPriceForType(type) {
        const prices = {
            peliculas: 5.99,
            series: 2.99,
            novelas: 3.99,
            shows: 4.99,
            animados: 2.99,
            animes: 3.99
        };
        return prices[type] || 2.99;
    }

    // Obtener póster por defecto
    getDefaultPoster(type) {
        const posters = {
            peliculas: 'https://via.placeholder.com/500x750?text=Pel%C3%ADcula',
            series: 'https://via.placeholder.com/500x750?text=Serie',
            novelas: 'https://via.placeholder.com/500x750?text=Novela',
            shows: 'https://via.placeholder.com/500x750?text=Show',
            animados: 'https://via.placeholder.com/500x750?text=Animado',
            animes: 'https://via.placeholder.com/500x750?text=Anime'
        };
        return posters[type] || 'https://via.placeholder.com/500x750?text=Contenido';
    }

    // Log de resultados
    logResult(filename, type, message) {
        if (this.onLog) {
            this.onLog({ filename, type, message, timestamp: new Date() });
        }
    }

    // Resetear estadísticas
    resetStats() {
        this.stats = {
            total: 0,
            new: 0,
            existing: 0,
            errors: 0
        };
    }

    // Detener escaneo
    stop() {
        this.shouldStop = true;
    }
}

// Exportar para uso global
window.FileScanner = FileScanner;