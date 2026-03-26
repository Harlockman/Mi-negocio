// db.js - Manejo de IndexedDB para almacenar productos, usuarios y pedidos
const DB_NAME = 'StreamStoreDB';
const DB_VERSION = 1;

let db;

// Abrir conexión a la base de datos
function openDB() {
    return new Promise((resolve, reject) => {
        if (db && db.name === DB_NAME) {
            resolve(db);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Store de productos (películas, series, etc)
            if (!db.objectStoreNames.contains('productos')) {
                const productStore = db.createObjectStore('productos', { keyPath: 'id' });
                productStore.createIndex('titulo', 'titulo', { unique: false });
                productStore.createIndex('seccion', 'seccion', { unique: false });
                productStore.createIndex('fecha_estreno', 'fecha_estreno', { unique: false });
            }
            // Store de usuarios
            if (!db.objectStoreNames.contains('usuarios')) {
                const userStore = db.createObjectStore('usuarios', { keyPath: 'telefono' });
                userStore.createIndex('nombre', 'nombre', { unique: false });
            }
            // Store de pedidos
            if (!db.objectStoreNames.contains('pedidos')) {
                const orderStore = db.createObjectStore('pedidos', { keyPath: 'codigo' });
                orderStore.createIndex('usuario', 'usuario', { unique: false });
                orderStore.createIndex('fecha', 'fecha', { unique: false });
            }
        };
    });
}

// --- Productos CRUD ---
async function guardarProducto(producto) {
    const db = await openDB();
    const tx = db.transaction('productos', 'readwrite');
    const store = tx.objectStore('productos');
    await store.put(producto);
    return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function obtenerProductos(seccion = null) {
    const db = await openDB();
    const tx = db.transaction('productos', 'readonly');
    const store = tx.objectStore('productos');
    let productos = [];
    if (seccion) {
        const index = store.index('seccion');
        const cursor = await index.openCursor(IDBKeyRange.only(seccion));
        cursor.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                productos.push(cursor.value);
                cursor.continue();
            }
        };
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(productos);
        });
    } else {
        const all = await store.getAll();
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(all);
        });
    }
}

async function eliminarProducto(id) {
    const db = await openDB();
    const tx = db.transaction('productos', 'readwrite');
    const store = tx.objectStore('productos');
    store.delete(id);
    return new Promise((resolve) => { tx.oncomplete = resolve; });
}

// --- Usuarios CRUD ---
async function registrarUsuario(usuario) {
    const db = await openDB();
    const tx = db.transaction('usuarios', 'readwrite');
    const store = tx.objectStore('usuarios');
    await store.put(usuario);
    return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function obtenerUsuario(telefono) {
    const db = await openDB();
    const tx = db.transaction('usuarios', 'readonly');
    const store = tx.objectStore('usuarios');
    const usuario = await store.get(telefono);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(usuario);
    });
}

// --- Pedidos CRUD ---
async function guardarPedido(pedido) {
    const db = await openDB();
    const tx = db.transaction('pedidos', 'readwrite');
    const store = tx.objectStore('pedidos');
    await store.put(pedido);
    return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function obtenerPedidos(usuario = null) {
    const db = await openDB();
    const tx = db.transaction('pedidos', 'readonly');
    const store = tx.objectStore('pedidos');
    if (usuario) {
        const index = store.index('usuario');
        const cursor = await index.openCursor(IDBKeyRange.only(usuario));
        let pedidos = [];
        cursor.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                pedidos.push(cursor.value);
                cursor.continue();
            }
        };
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(pedidos);
        });
    } else {
        const all = await store.getAll();
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(all);
        });
    }
}

// Exportar funciones para uso global
window.DB = {
    openDB,
    guardarProducto,
    obtenerProductos,
    eliminarProducto,
    registrarUsuario,
    obtenerUsuario,
    guardarPedido,
    obtenerPedidos
};