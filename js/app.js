// app.js - Lógica principal de la aplicación
let currentUser = null;
let cart = [];
let allProducts = [];

const App = {
    init: async function() {
        console.log('Iniciando aplicación...');
        
        // Mostrar loading
        const loading = document.getElementById('loading-overlay');
        if (loading) loading.style.display = 'flex';
        
        try {
            // Inicializar TMDB
            if (window.TMDB) window.TMDB.init();
            
            // Abrir base de datos
            await DB.openDB();
            console.log('Base de datos lista');
            
            // Crear usuario admin si no existe
            const adminExists = await DB.obtenerUsuario('altairdbb');
            if (!adminExists) {
                await DB.registrarUsuario({
                    telefono: 'altairdbb',
                    nombre: 'Administrador',
                    password: 'altairdbb',
                    esAdmin: true
                });
                console.log('Usuario admin creado');
            }
            
            // Cargar productos
            await this.loadProducts();
            
            // Cargar carrito de localStorage
            this.loadCart();
            
            // Configurar eventos
            this.bindEvents();
            
            // Cargar sección inicial
            this.loadSection('home');
            
            // Ocultar loading
            if (loading) loading.style.display = 'none';
            
            console.log('Aplicación iniciada correctamente');
            
        } catch (error) {
            console.error('Error al iniciar app:', error);
            if (loading) {
                loading.innerHTML = '<div style="color: red;">Error al cargar la aplicación. Recarga la página.</div>';
            }
        }
    },
    
    loadProducts: async function() {
        allProducts = await DB.obtenerProductos();
        console.log(`${allProducts.length} productos cargados`);
        
        // Si no hay productos, mostrar mensaje
        if (allProducts.length === 0) {
            console.log('No hay productos en la base de datos. Usa el panel admin para importar datos.');
        }
    },
    
    bindEvents: function() {
        // Navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.loadSection(section);
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
        
        // Modales de autenticación
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        
        if (loginBtn) loginBtn.addEventListener('click', () => this.showAuthModal('login'));
        if (registerBtn) registerBtn.addEventListener('click', () => this.showAuthModal('register'));
        
        const switchToRegister = document.getElementById('switch-to-register');
        const switchToLogin = document.getElementById('switch-to-login');
        
        if (switchToRegister) switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthModal('register');
        });
        
        if (switchToLogin) switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthModal('login');
        });
        
        const submitLogin = document.getElementById('submit-login');
        const submitRegister = document.getElementById('submit-register');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (submitLogin) submitLogin.addEventListener('click', () => this.login());
        if (submitRegister) submitRegister.addEventListener('click', () => this.register());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
        
        // Carrito
        const cartIcon = document.getElementById('cart-icon');
        const checkoutBtn = document.getElementById('checkout-btn');
        const closeOrderModal = document.getElementById('close-order-modal');
        
        if (cartIcon) cartIcon.addEventListener('click', () => this.showCartModal());
        if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.checkout());
        if (closeOrderModal) closeOrderModal.addEventListener('click', () => {
            document.getElementById('order-confirm-modal').style.display = 'none';
        });
        
        // Cerrar modales
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('auth-modal').style.display = 'none';
                document.getElementById('cart-modal').style.display = 'none';
                document.getElementById('order-confirm-modal').style.display = 'none';
            });
        });
        
        // Admin panel
        const adminViewOrders = document.getElementById('admin-view-orders');
        const adminSearchOrder = document.getElementById('admin-search-order');
        
        if (adminViewOrders) adminViewOrders.addEventListener('click', () => this.loadAdminOrders());
        if (adminSearchOrder) adminSearchOrder.addEventListener('click', () => this.searchAdminOrder());
    },
    
    showAuthModal: function(mode) {
        const modal = document.getElementById('auth-modal');
        const loginDiv = document.getElementById('login-form-container');
        const registerDiv = document.getElementById('register-form-container');
        
        if (mode === 'login') {
            if (loginDiv) loginDiv.style.display = 'block';
            if (registerDiv) registerDiv.style.display = 'none';
        } else {
            if (loginDiv) loginDiv.style.display = 'none';
            if (registerDiv) registerDiv.style.display = 'block';
        }
        
        if (modal) modal.style.display = 'flex';
    },
    
    login: async function() {
        const username = document.getElementById('login-username')?.value;
        const password = document.getElementById('login-password')?.value;
        
        if (!username || !password) {
            alert('Completa todos los campos');
            return;
        }
        
        const user = await DB.obtenerUsuario(username);
        
        if (user && user.password === password) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('auth-buttons').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('username-display').innerHTML = `<i class="fas fa-user"></i> ${user.nombre}`;
            
            if (user.esAdmin) {
                document.getElementById('admin-panel').style.display = 'block';
            }
            
            this.loadSection('home');
            this.updateCartUI();
        } else {
            alert('Usuario o contraseña incorrectos');
        }
    },
    
    register: async function() {
        const nombre = document.getElementById('reg-name')?.value;
        const telefono = document.getElementById('reg-phone')?.value;
        const password = document.getElementById('reg-password')?.value;
        
        if (!nombre || !telefono || !password) {
            alert('Completa todos los campos');
            return;
        }
        
        const existing = await DB.obtenerUsuario(telefono);
        if (existing) {
            alert('Este teléfono ya está registrado');
            return;
        }
        
        const newUser = {
            telefono: telefono,
            nombre: nombre,
            password: password,
            esAdmin: false,
            fecha_registro: new Date().toISOString()
        };
        
        await DB.registrarUsuario(newUser);
        alert('Registro exitoso. Ahora puedes iniciar sesión.');
        this.showAuthModal('login');
    },
    
    logout: function() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        
        document.getElementById('auth-buttons').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
        
        this.loadSection('home');
    },
    
    loadSection: async function(section) {
        const main = document.getElementById('main-content');
        if (!main) return;
        
        main.innerHTML = '<div class="loading-overlay" style="display: flex;"><div class="spinner"></div><p>Cargando contenido...</p></div>';
        
        let productos = [...allProducts];
        
        if (section !== 'home' && section !== 'ultimo') {
            productos = productos.filter(p => p.seccion === section);
        } else if (section === 'ultimo') {
            productos.sort((a, b) => new Date(b.fecha_estreno || 0) - new Date(a.fecha_estreno || 0));
            productos = productos.slice(0, 20);
        }
        
        if (section === 'home') {
            this.renderHome(productos);
        } else {
            this.renderGrid(productos, section);
        }
    },
    
    renderHome: function(productos) {
        const ultimos = [...productos]
            .sort((a, b) => new Date(b.fecha_estreno || 0) - new Date(a.fecha_estreno || 0))
            .slice(0, 12);
        
        const peliculas = productos.filter(p => p.seccion === 'peliculas').slice(0, 8);
        const series = productos.filter(p => p.seccion === 'series').slice(0, 8);
        
        const html = `
            <div style="padding: 2rem;">
                <h2 style="margin-bottom: 1rem;">🎬 Últimos Estrenos</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    ${ultimos.map(p => this.renderCard(p)).join('')}
                </div>
                
                <h2 style="margin: 2rem 0 1rem;">🎥 Películas Destacadas</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    ${peliculas.map(p => this.renderCard(p)).join('')}
                </div>
                
                <h2 style="margin: 2rem 0 1rem;">📺 Series Destacadas</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.5rem;">
                    ${series.map(p => this.renderCard(p)).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('main-content').innerHTML = html;
        this.bindCardEvents();
    },
    
    renderGrid: function(productos, titulo) {
        const titleMap = {
            peliculas: 'Películas',
            series: 'Series',
            novelas: 'Novelas',
            shows: 'Shows',
            animados: 'Animados',
            animes: 'Animes',
            ultimo: 'Lo Último'
        };
        
        const displayTitle = titleMap[titulo] || titulo;
        
        const html = `
            <div style="padding: 2rem;">
                <h2 style="margin-bottom: 1.5rem;">${displayTitle}</h2>
                ${productos.length === 0 ? '<p>No hay contenido disponible en esta sección.</p>' : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.5rem;">
                        ${productos.map(p => this.renderCard(p)).join('')}
                    </div>
                `}
            </div>
        `;
        
        document.getElementById('main-content').innerHTML = html;
        this.bindCardEvents();
    },
    
    renderCard: function(producto) {
        const posterUrl = producto.poster || 'https://via.placeholder.com/500x750?text=Sin+Poster';
        
        return `
            <div class="content-card" data-id="${producto.id}" style="cursor: pointer; background: #1f1f1f; border-radius: 8px; overflow: hidden; transition: transform 0.2s;">
                <img class="card-poster" src="${posterUrl}" alt="${producto.titulo}" 
                     style="width: 100%; aspect-ratio: 2/3; object-fit: cover;"
                     onerror="this.src='https://via.placeholder.com/500x750?text=Sin+Poster'">
                <div class="card-info" style="padding: 0.8rem;">
                    <h3 style="font-size: 0.9rem; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${producto.titulo}</h3>
                    <p style="font-size: 0.8rem; color: #aaa;">${producto.anio || 'Año desconocido'}</p>
                    <div class="price-tag" style="display: inline-block; background: #e50914; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-top: 0.5rem;">
                        $${(producto.precio || 0).toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    },
    
    bindCardEvents: function() {
        document.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', async () => {
                const id = card.dataset.id;
                const producto = allProducts.find(p => p.id === id);
                if (producto) this.showProductModal(producto);
            });
        });
    },
    
    showProductModal: function(producto) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                <span class="close-modal" style="float: right; font-size: 1.5rem; cursor: pointer;">&times;</span>
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <img src="${producto.poster || 'https://via.placeholder.com/500x750?text=Sin+Poster'}" 
                         style="width: 150px; height: 225px; object-fit: cover; border-radius: 8px;"
                         onerror="this.src='https://via.placeholder.com/500x750?text=Sin+Poster'">
                    <div>
                        <h2>${producto.titulo}</h2>
                        <p><strong>Año:</strong> ${producto.anio || 'Desconocido'}</p>
                        ${producto.temporada ? `<p><strong>Temporada:</strong> ${producto.temporada}</p>` : ''}
                        ${producto.episodio ? `<p><strong>Capítulo:</strong> ${producto.episodio}</p>` : ''}
                        <p><strong>Precio:</strong> <span style="color: #e50914;">$${(producto.precio || 0).toFixed(2)}</span></p>
                    </div>
                </div>
                <p><strong>Sinopsis:</strong></p>
                <p style="color: #aaa;">${producto.sinopsis || 'Sin información disponible.'}</p>
                ${producto.trailer ? `
                    <div style="margin-top: 1rem;">
                        <p><strong>Trailer:</strong></p>
                        <iframe width="100%" height="200" src="${producto.trailer}" frameborder="0" allowfullscreen></iframe>
                    </div>
                ` : ''}
                <button id="add-to-cart-modal" data-id="${producto.id}" class="btn-primary" style="margin-top: 1rem; width: 100%;">
                    <i class="fas fa-cart-plus"></i> Agregar al Carrito
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('#add-to-cart-modal').addEventListener('click', () => {
            this.addToCart(producto);
            modal.remove();
        });
    },
    
    addToCart: function(producto) {
        const existing = cart.find(item => item.id === producto.id);
        if (existing) {
            existing.cantidad++;
        } else {
            cart.push({ ...producto, cantidad: 1 });
        }
        this.saveCart();
        this.updateCartUI();
        alert(`${producto.titulo} agregado al carrito`);
    },
    
    saveCart: function() {
        localStorage.setItem('cart', JSON.stringify(cart));
    },
    
    loadCart: function() {
        const stored = localStorage.getItem('cart');
        if (stored) {
            try {
                cart = JSON.parse(stored);
            } catch(e) {
                cart = [];
            }
        }
        this.updateCartUI();
    },
    
    updateCartUI: function() {
        const count = cart.reduce((sum, item) => sum + (item.cantidad || 1), 0);
        const cartCount = document.getElementById('cart-count');
        if (cartCount) cartCount.textContent = count;
    },
    
    showCartModal: function() {
        const modal = document.getElementById('cart-modal');
        const container = document.getElementById('cart-items-list');
        
        if (!modal || !container) return;
        
        if (cart.length === 0) {
            container.innerHTML = '<p style="text-align: center;">No hay productos en el carrito.</p>';
            document.getElementById('cart-total').textContent = '0.00';
        } else {
            let total = 0;
            container.innerHTML = cart.map(item => {
                const subtotal = (item.precio || 0) * (item.cantidad || 1);
                total += subtotal;
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 0; border-bottom: 1px solid #333;">
                        <div style="flex: 2;">
                            <strong>${item.titulo}</strong>
                            <p style="font-size: 0.8rem; color: #aaa;">$${(item.precio || 0).toFixed(2)} c/u</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <button class="cart-qty-down" data-id="${item.id}" style="background: #333; border: none; color: #fff; width: 30px; height: 30px; border-radius: 4px; cursor: pointer;">-</button>
                            <span style="min-width: 30px; text-align: center;">${item.cantidad || 1}</span>
                            <button class="cart-qty-up" data-id="${item.id}" style="background: #333; border: none; color: #fff; width: 30px; height: 30px; border-radius: 4px; cursor: pointer;">+</button>
                        </div>
                        <div style="min-width: 80px; text-align: right;">
                            $${subtotal.toFixed(2)}
                        </div>
                        <button class="cart-remove" data-id="${item.id}" style="background: #dc3545; border: none; color: #fff; width: 30px; height: 30px; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }).join('');
            document.getElementById('cart-total').textContent = total.toFixed(2);
            
            // Bindear eventos de cantidad
            document.querySelectorAll('.cart-qty-down').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const item = cart.find(i => i.id === id);
                    if (item) {
                        if (item.cantidad > 1) {
                            item.cantidad--;
                        } else {
                            cart = cart.filter(i => i.id !== id);
                        }
                        this.saveCart();
                        this.updateCartUI();
                        this.showCartModal();
                    }
                });
            });
            
            document.querySelectorAll('.cart-qty-up').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const item = cart.find(i => i.id === id);
                    if (item) {
                        item.cantidad = (item.cantidad || 1) + 1;
                        this.saveCart();
                        this.updateCartUI();
                        this.showCartModal();
                    }
                });
            });
            
            document.querySelectorAll('.cart-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    cart = cart.filter(i => i.id !== id);
                    this.saveCart();
                    this.updateCartUI();
                    this.showCartModal();
                });
            });
        }
        
        modal.style.display = 'flex';
    },
    
    checkout: async function() {
        if (!currentUser) {
            alert('Debes iniciar sesión para realizar un pedido');
            this.showAuthModal('login');
            return;
        }
        
        if (cart.length === 0) {
            alert('El carrito está vacío');
            return;
        }
        
        const codigo = Math.random().toString(36).substring(2, 10).toUpperCase();
        const total = cart.reduce((sum, item) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0);
        
        const pedido = {
            codigo: codigo,
            usuario: currentUser.telefono,
            fecha: new Date().toISOString(),
            items: cart.map(item => ({
                id: item.id,
                titulo: item.titulo,
                precio: item.precio,
                cantidad: item.cantidad
            })),
            total: total
        };
        
        await DB.guardarPedido(pedido);
        
        // Limpiar carrito
        cart = [];
        this.saveCart();
        this.updateCartUI();
        
        document.getElementById('cart-modal').style.display = 'none';
        document.getElementById('order-code').textContent = codigo;
        document.getElementById('order-confirm-modal').style.display = 'flex';
    },
    
    loadAdminOrders: async function() {
        const orders = await DB.obtenerPedidos();
        const container = document.getElementById('admin-orders-list');
        
        if (!container) return;
        
        if (orders.length === 0) {
            container.innerHTML = '<p>No hay pedidos aún.</p>';
            return;
        }
        
        container.innerHTML = orders.map(order => `
            <div style="background: #1f1f1f; padding: 0.8rem; margin: 0.5rem 0; border-radius: 4px;">
                <strong>Código:</strong> ${order.codigo} | 
                <strong>Usuario:</strong> ${order.usuario} | 
                <strong>Total:</strong> $${order.total?.toFixed(2) || '0.00'} | 
                <strong>Fecha:</strong> ${new Date(order.fecha).toLocaleString()}
            </div>
        `).join('');
    },
    
    searchAdminOrder: async function() {
        const searchTerm = document.getElementById('admin-order-search')?.value;
        if (!searchTerm) return;
        
        const orders = await DB.obtenerPedidos();
        const order = orders.find(o => o.codigo === searchTerm);
        
        if (order) {
            alert(`Pedido encontrado:\nCódigo: ${order.codigo}\nUsuario: ${order.usuario}\nTotal: $${order.total?.toFixed(2)}\nItems: ${order.items?.length || 0} productos`);
        } else {
            alert('No se encontró ningún pedido con ese código');
        }
    }
};

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});