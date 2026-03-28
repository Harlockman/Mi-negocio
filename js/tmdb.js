// tmdb.js - Configuración de TMDB
const TMDB_CONFIG = {
    apiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MzA3MzUwZDBiMTY2MDU4ZDFiOTI2YWFkNzkzZWVlYyIsIm5iZiI6MTc3Mzk0ODgzMy44MzIsInN1YiI6IjY5YmM0ZmExMjAxNGE5MWU2M2FhZmZhMyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.JIq_kDsLUYIFV-x8QzvPtwwpYdraLcSecdmW9upWbOw',
    baseUrl: 'https://api.themoviedb.org/3',
    language: 'es',
    imageBaseUrl: 'https://image.tmdb.org/t/p/'
};

function initTMDB() {
    const savedApiKey = localStorage.getItem('tmdb_api_key');
    if (savedApiKey) {
        TMDB_CONFIG.apiKey = savedApiKey;
        console.log('TMDB API Key cargada');
    }
}

async function searchTMDB(query, type = 'movie') {
    if (!TMDB_CONFIG.apiKey) {
        console.warn('TMDB API Key no configurada');
        return [];
    }
    
    const url = `${TMDB_CONFIG.baseUrl}/search/${type}?api_key=${TMDB_CONFIG.apiKey}&query=${encodeURIComponent(query)}&language=${TMDB_CONFIG.language}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Error buscando en TMDB:', error);
        return [];
    }
}

async function getTMDBInfo(query, type = 'movie') {
    const results = await searchTMDB(query, type);
    
    if (results.length === 0) {
        return null;
    }
    
    const firstResult = results[0];
    
    let trailer = null;
    try {
        const videoUrl = `${TMDB_CONFIG.baseUrl}/${type}/${firstResult.id}/videos?api_key=${TMDB_CONFIG.apiKey}&language=${TMDB_CONFIG.language}`;
        const videoResponse = await fetch(videoUrl);
        const videoData = await videoResponse.json();
        const trailerVideo = videoData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailerVideo) {
            trailer = `https://www.youtube.com/embed/${trailerVideo.key}`;
        }
    } catch (error) {
        console.error('Error obteniendo trailer:', error);
    }
    
    return {
        id: firstResult.id,
        titulo: firstResult.title || firstResult.name,
        sinopsis: firstResult.overview || 'Sin información disponible.',
        anio: (firstResult.release_date || firstResult.first_air_date || '').split('-')[0],
        fecha_estreno: firstResult.release_date || firstResult.first_air_date,
        poster: firstResult.poster_path ? `https://image.tmdb.org/t/p/w500${firstResult.poster_path}` : null,
        trailer: trailer,
        valoracion: firstResult.vote_average,
        votos: firstResult.vote_count
    };
}

window.TMDB = {
    init: initTMDB,
    search: searchTMDB,
    getInfo: getTMDBInfo,
    config: TMDB_CONFIG
};
