// tmdb.js - API Key de TMDB (¡OBTÉN LA TUYA EN https://www.themoviedb.org/signup!)
const TMDB_API_KEY = 'TU_API_KEY_AQUI'; // Reemplaza con tu clave
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/';

// --- Lectura de archivos desde GitHub ---
async function leerArchivoGitHub(ruta) {
    const url = `${GITHUB_RAW_BASE}${ruta}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo leer ${ruta}`);
    return await response.text();
}

// Obtener la estructura de archivos desde la carpeta "data"
// Nota: GitHub no permite listar directorios fácilmente. Simularemos con un archivo index.json que generarías manualmente.
// Mejor opción: Tener un archivo `data/index.json` que contenga la lista de archivos.
async function obtenerEstructuraArchivos() {
    try {
        const indexContent = await leerArchivoGitHub('data/index.json');
        return JSON.parse(indexContent);
    } catch (error) {
        console.error('Error al leer index.json, se usará estructura vacía', error);
        return { peliculas: [], series: [], novelas: [], shows: [], animados: [], animes: [] };
    }
}

// Obtener precios desde prices.txt
async function obtenerPrecios() {
    const content = await leerArchivoGitHub('data/precios.txt');
    const lines = content.split('\n');
    const precios = {};
    for (let line of lines) {
        line = line.trim();
        if (line && line.includes('=')) {
            const [tipo, precio] = line.split('=');
            precios[tipo.trim()] = parseFloat(precio);
        }
    }
    return precios;
}

// Buscar en TMDB por nombre de archivo (limpiamos extensión)
async function buscarEnTMDB(nombreArchivo, tipo) {
    // Limpiar nombre: quitar extensión, números de capítulo, etc.
    let nombreLimpio = nombreArchivo.replace(/\.[^/.]+$/, ""); // quitar extensión
    // Eliminar patrones como "S01E01", "1x01", etc. para series
    if (tipo === 'serie') {
        nombreLimpio = nombreLimpio.replace(/[Ss]\d+[Ee]\d+|\d+x\d+/g, '').trim();
    }
    const searchUrl = `${TMDB_BASE_URL}/search/${tipo === 'pelicula' ? 'movie' : 'tv'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(nombreLimpio)}&language=es`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
        return data.results[0];
    }
    return null;
}

// Obtener trailer de TMDB
async function obtenerTrailer(tmdbId, tipo) {
    const url = `${TMDB_BASE_URL}/${tipo === 'pelicula' ? 'movie' : 'tv'}/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=es`;
    const response = await fetch(url);
    const data = await response.json();
    const trailer = data.results?.find(video => video.type === 'Trailer' && video.site === 'YouTube');
    return trailer ? `https://www.youtube.com/embed/${trailer.key}` : null;
}

// Procesar todos los archivos de la carpeta data para crear/actualizar productos en DB
async function sincronizarProductosDesdeGitHub() {
    const precios = await obtenerPrecios();
    const estructura = await obtenerEstructuraArchivos();
    const productosProcesados = new Set(); // Para evitar duplicados por nombre

    for (const [seccion, archivos] of Object.entries(estructura)) {
        for (const archivo of archivos) {
            const nombreSinExt = archivo.replace(/\.[^/.]+$/, "");
            if (productosProcesados.has(nombreSinExt)) continue; // Evitar duplicados

            // Determinar tipo TMDB: pelicula o serie (por ahora solo diferenciamos esos dos)
            let tipoTMDB = 'pelicula';
            if (seccion === 'series' || seccion === 'animes' || seccion === 'novelas') {
                tipoTMDB = 'serie';
            }

            const tmdbInfo = await buscarEnTMDB(archivo, tipoTMDB);
            const trailer = tmdbInfo ? await obtenerTrailer(tmdbInfo.id, tipoTMDB) : null;

            const producto = {
                id: nombreSinExt, // ID único basado en nombre limpio
                titulo: tmdbInfo?.title || tmdbInfo?.name || nombreSinExt,
                archivo: archivo,
                seccion: seccion,
                tipo_contenido: seccion === 'peliculas' ? 'pelicula' : 'serie',
                sinopsis: tmdbInfo?.overview || 'Sin información disponible.',
                anio: tmdbInfo?.release_date?.split('-')[0] || tmdbInfo?.first_air_date?.split('-')[0] || 'Desconocido',
                director: tmdbInfo?.director || 'No especificado',
                poster: tmdbInfo?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbInfo.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster',
                trailer: trailer,
                fecha_estreno: tmdbInfo?.release_date || tmdbInfo?.first_air_date || '2000-01-01',
                precio: precios[seccion] || 0
            };
            await DB.guardarProducto(producto);
            productosProcesados.add(nombreSinExt);
        }
    }
    console.log('Sincronización completada');
}

// Exportar funciones
window.TMDB = {
    sincronizarProductosDesdeGitHub,
    obtenerPrecios,
    obtenerEstructuraArchivos
};