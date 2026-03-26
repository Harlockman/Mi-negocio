// file-parser.js - Analiza el HTML de estructura de directorios generado por Snap2HTML

class FileParser {
    constructor() {
        this.parsedFiles = new Set();
        this.stats = {
            total: 0,
            new: 0,
            existing: 0,
            errors: 0
        };
    }

    // Parsear el archivo HTML de estructura
    async parseStructureHTML(htmlContent) {
        this.resetStats();
        const files = await this.extractFilesFromHTML(htmlContent);
        this.stats.total = files.length;
        
        const results = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const result = await this.processFile(file, i + 1, files.length);
                results.push(result);
            } catch (error) {
                this.stats.errors++;
                this.logResult(file.name, 'error', error.message);
            }
        }
        
        return { stats: this.stats, results };
    }

    // Extraer archivos del HTML
    extractFilesFromHTML(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // Buscar los datos de directorios en el script
        const scripts = doc.getElementsByTagName('script');
        let dirsData = null;
        
        for (let script of scripts) {
            const content = script.textContent;
            if (content.includes('var dirs = [];') || content.includes('D.p([')) {
                dirsData = this.extractDirsFromScript(content);
                break;
            }
        }
        
        if (!dirsData) {
            throw new Error('No se pudo encontrar la estructura de directorios en el HTML');
        }
        
        return this.processDirsData(dirsData);
    }

    // Extraer datos de directorios del script
    extractDirsFromScript(scriptContent) {
        const files = [];
        
        // Buscar patrones de archivos en el formato: "nombre*size*fecha"
        // Formato típico: "nombre.mp4*1234567*1764851657"
        const filePattern = /"([^"]*\.(?:mp4|avi|mkv|mov|wmv|mpg|mpeg))\*(\d+)\*(\d+)"/gi;
        let match;
        
        while ((match = filePattern.exec(scriptContent)) !== null) {
            files.push({
                name: match[1],
                size: parseInt(match[2]),
                timestamp: parseInt(match[3])
            });
        }
        
        // También buscar directorios
        const dirPattern = /"([^"]+)\*0\*(\d+)"/gi;
        while ((match = dirPattern.exec(scriptContent)) !== null) {
            // Ignorar el directorio raíz y otros que no son relevantes
            if (match[1] !== 'G:/[«« SERIES ANIMADAS »»]' && !match[1].endsWith('*0*')) {
                files.push({
                    name: match[1],
                    size: 0,
                    timestamp: parseInt(match[2]),
                    isDir: true
                });
            }
        }
        
        return files;
    }

    // Procesar los datos extraídos
    processDirsData(files) {
        const processedFiles = [];
        const seenNames = new Set();
        
        for (const file of files) {
            // Determinar tipo de contenido basado en la ruta
            const path = file.name;
            const type = this.detectContentType(path);
            
            // Extraer información del nombre
            const fileInfo = this.extractFileInfo(file.name);
            
            // Crear un ID único basado en el nombre limpio
            let uniqueId = fileInfo.cleanName;
            
            // Para series, incluir temporada y episodio en el ID
            if (fileInfo.season !== null && fileInfo.episode !== null) {
                uniqueId = `${fileInfo.cleanName}_S${fileInfo.season}E${fileInfo.episode}`;
            }
            
            // Evitar duplicados
            if (seenNames.has(uniqueId)) {
                continue;
            }
            seenNames.add(uniqueId);
            
            processedFiles.push({
                originalPath: file.name,
                cleanName: fileInfo.cleanName,
                title: fileInfo.title,
                season: fileInfo.season,
                episode: fileInfo.episode,
                type: type,
                size: file.size,
                timestamp: file.timestamp,
                uniqueId: uniqueId,
                isDir: file.isDir || false
            });
        }
        
        return processedFiles;
    }

    // Detectar tipo de contenido basado en la ruta
    detectContentType(path) {
        const pathLower = path.toLowerCase();
        
        // Mapeo de palabras clave a tipos
        const typeMap = [
            { keywords: ['peliculas', 'movies', 'film'], type: 'peliculas' },
            { keywords: ['series', 'tvshows', 'serie'], type: 'series' },
            { keywords: ['novelas', 'telenovelas'], type: 'novelas' },
            { keywords: ['shows', 'programas'], type: 'shows' },
            { keywords: ['animados', 'cartoons', 'dibujos'], type: 'animados' },
            { keywords: ['animes', 'anime', 'japanese'], type: 'animes' }
        ];
        
        for (const mapping of typeMap) {
            for (const keyword of mapping.keywords) {
                if (pathLower.includes(keyword)) {
                    return mapping.type;
                }
            }
        }
        
        // Detección por patrón de nombre de archivo
        if (pathLower.match(/[sS]\d+[eE]\d+/) || pathLower.match(/\d+x\d+/)) {
            return 'series';
        }
        
        // Por defecto, películas
        return 'peliculas';
    }

    // Extraer información del nombre del archivo
    extractFileInfo(filename) {
        // Obtener solo el nombre del archivo sin la ruta
        const nameWithExt = filename.includes('/') ? filename.split('/').pop() : filename;
        
        // Quitar extensión
        let cleanName = nameWithExt.replace(/\.[^/.]+$/, "");
        
        // Eliminar calidad y grupos
        cleanName = cleanName.replace(/\[.*?\]|\(.*?\)/g, '');
        
        // Eliminar información de audio
        cleanName = cleanName.replace(/\[[^\]]*?(?:Dual|Latino|Español|Inglés)[^\]]*?\]/gi, '');
        
        // Normalizar espacios
        cleanName = cleanName.replace(/[._-]/g, ' ').trim();
        
        // Detectar temporada y episodio
        let season = null;
        let episode = null;
        let title = cleanName;
        
        // Patrones para series: S01E02, 1x02, etc
        const seasonEpisodePatterns = [
            /[Ss](\d+)[Ee](\d+)/,
            /(\d+)x(\d+)/,
            /(\d+)-(\d+)/
        ];
        
        for (const pattern of seasonEpisodePatterns) {
            const match = cleanName.match(pattern);
            if (match) {
                season = parseInt(match[1]);
                episode = parseInt(match[2]);
                title = cleanName.replace(pattern, '').trim();
                break;
            }
        }
        
        // Si no se encontró patrón pero el nombre contiene números, puede ser serie
        if (season === null && cleanName.match(/\d+/)) {
            const numMatch = cleanName.match(/(\d+)$/);
            if (numMatch && !title.includes(' ' + numMatch[1])) {
                episode = parseInt(numMatch[1]);
                title = cleanName.replace(numMatch[1], '').trim();
            }
        }
        
        return {
            cleanName: cleanName,
            title: title || cleanName,
            season: season,
            episode: episode,
            extension: nameWithExt.substring(nameWithExt.lastIndexOf('.'))
        };
    }

    // Procesar un archivo individual
    async processFile(file, current, total) {
        try {
            // Verificar si ya existe en la base de datos
            const existingProduct = await this.checkExistingProduct(file);
            
            if (existingProduct) {
                this.stats.existing++;
                this.logResult(file.title, 'skip', 'Ya existe en la base de datos');
                return { file, status: 'skip', product: existingProduct };
            }
            
            // Buscar en TMDB si está configurado
            let tmdbData = null;
            if (window.CONFIG && window.CONFIG.FETCH_TMDB && window.CONFIG.TMDB_API_KEY) {
                const tmdbType = file.type === 'peliculas' ? 'movie' : 'tv';
                tmdbData = await this.fetchTMDBInfo(file.title, tmdbType);
            }
            
            // Obtener precio según tipo
            const price = this.getPriceForType(file.type);
            
            // Crear producto
            const product = this.createProduct(file, tmdbData, price);
            await DB.guardarProducto(product);
            
            this.stats.new++;
            this.logResult(file.title, 'success', 'Producto agregado');
            
            return { file, status: 'success', product };
            
        } catch (error) {
            this.stats.errors++;
            this.logResult(file.title, 'error', error.message);
            return { file, status: 'error', error: error.message };
        }
    }

    // Verificar si el producto ya existe
    async checkExistingProduct(file) {
        const allProducts = await DB.obtenerProductos();
        
        // Buscar por ID único
        return allProducts.find(p => 
            p.id === file.uniqueId ||
            p.titulo === file.title ||
            (p.temporada === file.season && p.episodio === file.episode && p.titulo === file.title)
        );
    }

    // Buscar información en TMDB
    async fetchTMDBInfo(title, type) {
        if (!window.TMDB || !window.TMDB.config.apiKey) {
            return null;
        }
        
        try {
            const info = await window.TMDB.searchAndGetInfo(title, type);
            return info;
        } catch (error) {
            console.warn(`Error buscando en TMDB para ${title}:`, error);
            return null;
        }
    }

    // Obtener precio según el tipo
    getPriceForType(type) {
        // Intentar cargar precios personalizados
        const customPrices = localStorage.getItem('custom_prices');
        if (customPrices) {
            const prices = JSON.parse(customPrices);
            if (prices[type]) {
                return parseFloat(prices[type]);
            }
        }
        
        // Precios por defecto
        const defaultPrices = {
            peliculas: 5.99,
            series: 2.99,
            novelas: 3.99,
            shows: 4.99,
            animados: 2.99,
            animes: 3.99
        };
        
        return defaultPrices[type] || 2.99;
    }

    // Crear objeto producto
    createProduct(file, tmdbData, price) {
        const now = new Date().toISOString();
        
        const product = {
            id: file.uniqueId,
            nombre_original: file.cleanName,
            titulo: tmdbData?.titulo || file.title,
            seccion: file.type,
            tipo_contenido: file.season !== null ? 'serie' : 'pelicula',
            ruta_original: file.originalPath,
            precio: price,
            sinopsis: tmdbData?.sinopsis || 'Sin información disponible.',
            anio: tmdbData?.anio || this.extractYearFromPath(file.originalPath) || 'Desconocido',
            fecha_estreno: tmdbData?.fecha_estreno || null,
            poster: tmdbData?.poster || this.getDefaultPoster(file.type),
            trailer: tmdbData?.trailer || null,
            tamaño: file.size,
            fecha_modificacion: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : null,
            fecha_agregado: now,
            fecha_actualizacion: now
        };
        
        // Información específica para series
        if (file.season !== null) {
            product.temporada = file.season;
            product.episodio = file.episode;
            product.numero_capitulo = file.episode;
            
            // Título con información de temporada/episodio
            if (file.episode) {
                product.titulo_completo = `${file.title} - Temporada ${file.season}, Capítulo ${file.episode}`;
            } else {
                product.titulo_completo = `${file.title} - Temporada ${file.season}`;
            }
        } else {
            product.titulo_completo = file.title;
        }
        
        return product;
    }

    // Extraer año de la ruta del archivo
    extractYearFromPath(path) {
        const yearMatch = path.match(/\b(19|20)\d{2}\b/);
        return yearMatch ? yearMatch[0] : null;
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
    logResult(name, type, message) {
        if (this.onLog) {
            this.onLog({ name, type, message, timestamp: new Date() });
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
}

// Exportar para uso global
window.FileParser = FileParser;