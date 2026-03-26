// tmdb.js - Configuración y funciones de TMDB
window.TMDB = {
    // Configuración por defecto
    config: {
        apiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MzA3MzUwZDBiMTY2MDU4ZDFiOTI2YWFkNzkzZWVlYyIsIm5iZiI6MTc3Mzk0ODgzMy44MzIsInN1YiI6IjY5YmM0ZmExMjAxNGE5MWU2M2FhZmZhMyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.JIq_kDsLUYIFV-x8QzvPtwwpYdraLcSecdmW9upWbOw',
        baseUrl: 'https://api.themoviedb.org/3',
        language: 'es',
        imageBaseUrl: 'https://image.tmdb.org/t/p/'
    },
    
    // Inicializar configuración
    init: function() {
        const savedApiKey = localStorage.getItem('tmdb_api_key');
        if (savedApiKey) {
            this.config.apiKey = savedApiKey;
        }
        
        const savedLanguage = localStorage.getItem('tmdb_language');
        if (savedLanguage) {
            this.config.language = savedLanguage;
        }
    },
    
    // Buscar película/serie
    search: async function(query, type = 'movie') {
        if (!this.config.apiKey) {
            throw new Error('TMDB API Key no configurada');
        }
        
        const url = `${this.config.baseUrl}/search/${type}?api_key=${this.config.apiKey}&query=${encodeURIComponent(query)}&language=${this.config.language}`;
        const response = await fetch(url);
        const data = await response.json();
        
        return data.results || [];
    },
    
    // Obtener detalles
    getDetails: async function(id, type = 'movie') {
        if (!this.config.apiKey) {
            throw new Error('TMDB API Key no configurada');
        }
        
        const url = `${this.config.baseUrl}/${type}/${id}?api_key=${this.config.apiKey}&language=${this.config.language}`;
        const response = await fetch(url);
        return await response.json();
    },
    
    // Obtener videos (trailers, etc)
    getVideos: async function(id, type = 'movie') {
        if (!this.config.apiKey) {
            throw new Error('TMDB API Key no configurada');
        }
        
        const url = `${this.config.baseUrl}/${type}/${id}/videos?api_key=${this.config.apiKey}&language=${this.config.language}`;
        const response = await fetch(url);
        const data = await response.json();
        
        return data.results || [];
    },
    
    // Obtener trailer
    getTrailer: async function(id, type = 'movie') {
        const videos = await this.getVideos(id, type);
        const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        
        if (trailer) {
            return `https://www.youtube.com/embed/${trailer.key}`;
        }
        
        return null;
    },
    
    // Obtener imagen
    getImage: function(path, size = 'w500') {
        if (!path) return null;
        return `${this.config.imageBaseUrl}${size}${path}`;
    },
    
    // Buscar y obtener información completa
    searchAndGetInfo: async function(query, type = 'movie') {
        const results = await this.search(query, type);
        
        if (results.length === 0) {
            return null;
        }
        
        const firstResult = results[0];
        const details = await this.getDetails(firstResult.id, type);
        const trailer = await this.getTrailer(firstResult.id, type);
        
        return {
            id: firstResult.id,
            titulo: firstResult.title || firstResult.name,
            sinopsis: firstResult.overview,
            anio: (firstResult.release_date || firstResult.first_air_date || '').split('-')[0],
            fecha_estreno: firstResult.release_date || firstResult.first_air_date,
            poster: this.getImage(firstResult.poster_path),
            backdrop: this.getImage(firstResult.backdrop_path, 'w1280'),
            trailer: trailer,
            generos: details.genres?.map(g => g.name) || [],
            valoracion: firstResult.vote_average,
            votos: firstResult.vote_count
        };
    }
};

// Inicializar
TMDB.init();