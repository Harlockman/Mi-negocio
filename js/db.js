// db.js - Manejo de IndexedDB
const DB_NAME = 'StreamStoreDB';
const DB_VERSION = 2;
let dbInstance = null;

// Abrir conexión a la base de datos
function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance && dbInstance.name === DB_NAME && !dbInstance.close) {
            resolve(dbInstance);
            return;
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('Error al abrir DB:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            console.log('Base de datos abierta correctamente');
            resolve(dbInstance);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log('Actualizando estructura de base de datos...');
            
            if (!db.objectStoreNames.contains('productos')) {
                const productStore = db.createObjectStore('productos', { keyPath: 'id' });
                productStore.createIndex('seccion', 'seccion', { unique: false });
                productStore.createIndex('titulo', 'titulo', { unique: false });
                productStore.createIndex('fecha_estreno', 'fecha_estreno', { unique: false });
                console.log('Store productos creada');
            }
            
            if (!db.objectStoreNames.contains('usuarios')) {
                const userStore = db.createObjectStore('usuarios', { keyPath: 'telefono' });
                userStore.createIndex('nombre', 'nombre', { unique: false });
                console.log('Store usuarios creada');
            }
            
            if (!db.objectStoreNames.contains('pedidos')) {
                const orderStore = db.createObjectStore('pedidos', { keyPath: 'codigo' });
                orderStore.createIndex('usuario', 'usuario', { unique: false });
                orderStore.createIndex('fecha', 'fecha', { unique: false });
                console.log('Store pedidos creada');
            }
        };
    });
}

// --- Productos CRUD ---
async function guardarProducto(producto) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('productos', 'readwrite');
        const store = tx.objectStore('productos');
        const request = store.put(producto);
        
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(producto);
    });
}

async function obtenerProductos(seccion = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('productos', 'readonly');
        const store = tx.objectStore('productos');
        
        if (seccion) {
            const index = store.index('seccion');
            const request = index.getAll(seccion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        } else {
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        }
    });
}

async function eliminarProducto(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('productos', 'readwrite');
        const store = tx.objectStore('productos');
        const request = store.delete(id);
        
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve();
    });
}

// --- Usuarios CRUD ---
async function registrarUsuario(usuario) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('usuarios', 'readwrite');
        const store = tx.objectStore('usuarios');
        const request = store.put(usuario);
        
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(usuario);
    });
}

async function obtenerUsuario(telefono) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('usuarios', 'readonly');
        const store = tx.objectStore('usuarios');
        const request = store.get(telefono);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function obtenerTodosUsuarios() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('usuarios', 'readonly');
        const store = tx.objectStore('usuarios');
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// --- Pedidos CRUD ---
async function guardarPedido(pedido) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pedidos', 'readwrite');
        const store = tx.objectStore('pedidos');
        const request = store.put(pedido);
        
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(pedido);
    });
}

async function obtenerPedidos(usuario = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pedidos', 'readonly');
        const store = tx.objectStore('pedidos');
        
        if (usuario) {
            const index = store.index('usuario');
            const request = index.getAll(usuario);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        } else {
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        }
    });
}

async function eliminarPedido(codigo) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pedidos', 'readwrite');
        const store = tx.objectStore('pedidos');
        const request = store.delete(codigo);
        
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve();
    });
}

window.DB = {
    openDB,
    guardarProducto,
    obtenerProductos,
    eliminarProducto,
    registrarUsuario,
    obtenerUsuario,
    obtenerTodosUsuarios,
    guardarPedido,
    obtenerPedidos,
    eliminarPedido
};
