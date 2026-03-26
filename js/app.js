// app.js - Lógica principal de la interfaz
let currentUser = null;
let cart = [];

const App = {
    init: async function() {
        await DB.openDB();
        // Cargar usuarios de prueba (admin)
        const adminUser = await DB.obtenerUsuario('altairdbb');
        if (!adminUser) {
            await DB.registrarUsuario({ telefono: 'altairdbb', nombre: 'Administrador', password: 'altairdbb', esAdmin: true });
        }
        this.bindEvents();
        this.loadSection('home');
        this.loadCartFromStorage();
        this.updateCartUI();
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
        document.getElementById('login-btn')?.addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('register-btn')?.addEventListener('click', () => this.showAuthModal('register'));
        document.getElementById('switch-to-register')?.addEventListener('click', (e) => { e.preventDefault(); this.showAuthModal('register'); });
        document.getElementById('switch-to-login')?.addEventListener('click', (e) => { e.preventDefault(); this.showAuthModal('login'); });
        document.getElementById('submit-login')?.addEventListener('click', () => this.login());
        document.getElementById('submit-register')?.addEventListener('click', () => this.register());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        // Carrito
        document.getElementById('cart-icon')?.addEventListener('click', () => this.showCartModal());
        document.getElementById('checkout-btn')?.addEventListener('click', () => this.checkout());
        // Cerrar modales
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('auth-modal').style.display = 'none';
                document.getElementById('cart-modal').style.display = 'none';
                document.getElementById('order-confirm-modal').style.display = 'none';
            });
        });
    },
    showAuthModal: function(mode) {
        const modal = document.getElementById('auth-modal');
        const loginDiv = document.getElementById('login-form-container');
        const registerDiv = document.getElementById('register-form-container');
        if (mode === 'login') {
            loginDiv.style.display = 'block';
            registerDiv.style.display = 'none';
        } else {
            loginDiv.style.display = 'none';
            registerDiv.style.display = 'block';
        }
        modal.style.display = 'flex';
    },
    login: async function() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const user = await DB.obtenerUsuario(username);
        if (user && user.password === password) {
            currentUser = user;
            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('auth-buttons').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('username-display').innerText = user.nombre;
            if (user.esAdmin) {
                document.getElementById('admin-panel').style.display = 'block';
                if (window.Admin) window.Admin.loadOrders();
            }
            this.loadSection('home');
        } else {
            alert('Usuario o contraseña incorrectos');
        }
    },
    register: async function() {
        const nombre = document.getElementById('reg-name').value;
        const telefono = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;
        if (!nombre || !telefono || !password) {
            alert('Completa todos los campos');
            return;
        }
        const existing = await DB.obtenerUsuario(telefono);
        if (existing) {
            alert('Este teléfono ya está registrado');
            return;
        }
        const newUser = { telefono, nombre, password, esAdmin: false };
        await DB.registrarUsuario(newUser);
        alert('Registro exitoso. Inicia sesión.');
        this.showAuthModal('login');
    },
    logout: function() {
        currentUser = null;
        document.getElementById('auth-buttons').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
        this.loadSection('home');
    },
    loadSection: async function(section) {
        const main = document.getElementById('main-content');
        main.innerHTML = '<div class="loading-overlay" style="display:flex;"><div class="spinner"></div></div>';
        let productos = await DB.obtenerProductos();
        if (section !== 'home' && section !== 'ultimo') {
            productos = productos.filter(p => p.seccion === section);
        } else if (section === 'ultimo') {
            productos.sort((a,b) => new Date(b.fecha_estreno) - new Date(a.fecha_estreno));
            productos = productos.slice(0, 20);
        }
        if (section === 'home') {
            this.renderHome(productos);
        } else {
            this.renderGrid(productos, section);
        }
    },
    renderHome: function(productos) {
        const ultimos = [...productos].sort((a,b) => new Date(b.fecha_estreno) - new Date(a.fecha_estreno)).slice(0, 12);
        const peliculas = productos.filter(p => p.seccion === 'peliculas').slice(0, 10);
        const series = productos.filter(p => p.seccion === 'series').slice(0, 10);
        const html = `
            <div class="carousel-container">
                <button class="carousel-btn left" onclick="document.querySelector('.carousel-track').scrollBy({left: -300, behavior: 'smooth'})"><</button>
                <div class="carousel-track" id="home-carousel">
                    ${ultimos.map(p => this.renderCard(p)).join('')}
                </div>
                <button class="carousel-btn right" onclick="document.querySelector('.carousel-track').scrollBy({left: 300, behavior: 'smooth'})">></button>
            </div>
            <h2>Películas Destacadas</h2>
            <div class="main-grid">${peliculas.map(p => this.renderCard(p)).join('')}</div>
            <h2>Series Destacadas</h2>
            <div class="main-grid">${series.map(p => this.renderCard(p)).join('')}</div>
        `;
        document.getElementById('main-content').innerHTML = html;
        this.bindCardEvents();
    },
    renderGrid: function(productos, titulo) {
        const html = `<h2>${titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h2><div class="main-grid">${productos.map(p => this.renderCard(p)).join('')}</div>`;
        document.getElementById('main-content').innerHTML = html;
        this.bindCardEvents();
    },
    renderCard: function(producto) {
        return `
            <div class="content-card" data-id="${producto.id}">
                <img class="card-poster" src="${producto.poster}" alt="${producto.titulo}" onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'">
                <div class="card-info">
                    <h3>${producto.titulo}</h3>
                    <p>${producto.anio}</p>
                    <div class="price-tag">$${producto.precio.toFixed(2)}</div>
                </div>
            </div>
        `;
    },
    bindCardEvents: function() {
        document.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', async () => {
                const id = card.dataset.id;
                const producto = (await DB.obtenerProductos()).find(p => p.id === id);
                if (producto) this.showProductModal(producto);
            });
        });
    },
    showProductModal: function(producto) {
        // Modal básico con información y opción de agregar al carrito
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <span class="close-modal">&times;</span>
                <h2>${producto.titulo}</h2>
                <img src="${producto.poster}" style="max-width: 200px; float: left; margin-right: 1rem;">
                <p><strong>Año:</strong> ${producto.anio}</p>
                <p><strong>Director:</strong> ${producto.director}</p>
                <p><strong>Sinopsis:</strong> ${producto.sinopsis}</p>
                <p><strong>Precio:</strong> $${producto.precio.toFixed(2)}</p>
                ${producto.trailer ? `<iframe width="100%" height="315" src="${producto.trailer}" frameborder="0" allowfullscreen></iframe>` : ''}
                <button id="add-to-cart-modal" data-id="${producto.id}" class="btn-primary">Agregar al Carrito</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';
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
        this.saveCartToStorage();
        this.updateCartUI();
        alert(`${producto.titulo} agregado al carrito`);
    },
    saveCartToStorage: function() {
        localStorage.setItem('cart', JSON.stringify(cart));
    },
    loadCartFromStorage: function() {
        const stored = localStorage.getItem('cart');
        if (stored) cart = JSON.parse(stored);
    },
    updateCartUI: function() {
        const count = cart.reduce((sum, item) => sum + item.cantidad, 0);
        document.getElementById('cart-count').innerText = count;
    },
    showCartModal: function() {
        const modal = document.getElementById('cart-modal');
        const container = document.getElementById('cart-items-list');
        if (cart.length === 0) {
            container.innerHTML = '<p>No hay productos en el carrito.</p>';
            document.getElementById('cart-total').innerText = '0.00';
        } else {
            let total = 0;
            container.innerHTML = cart.map(item => {
                const subtotal = item.precio * item.cantidad;
                total += subtotal;
                return `
                    <div class="cart-item">
                        <span>${item.titulo} x ${item.cantidad}</span>
                        <span>$${subtotal.toFixed(2)}</span>
                        <button class="remove-from-cart" data-id="${item.id}">X</button>
                    </div>
                `;
            }).join('');
            document.getElementById('cart-total').innerText = total.toFixed(2);
            document.querySelectorAll('.remove-from-cart').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    cart = cart.filter(item => item.id !== id);
                    this.saveCartToStorage();
                    this.updateCartUI();
                    this.showCartModal(); // refrescar
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
        const pedido = {
            codigo: codigo,
            usuario: currentUser.telefono,
            fecha: new Date().toISOString(),
            items: cart,
            total: cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
        };
        await DB.guardarPedido(pedido);
        // Limpiar carrito
        cart = [];
        this.saveCartToStorage();
        this.updateCartUI();
        document.getElementById('cart-modal').style.display = 'none';
        // Mostrar código de pedido
        document.getElementById('order-code').innerText = codigo;
        document.getElementById('order-confirm-modal').style.display = 'flex';
        document.getElementById('close-order-modal').addEventListener('click', () => {
            document.getElementById('order-confirm-modal').style.display = 'none';
        });
    }
};

window.App = App;