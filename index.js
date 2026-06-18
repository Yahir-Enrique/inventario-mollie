document.addEventListener('DOMContentLoaded', () => {
    const seccionLogin = document.getElementById('seccionLogin');
    const seccionInventario = document.getElementById('seccionInventario');
    const formAutenticacion = document.getElementById('formAutenticacion');
    const loginUsuario = document.getElementById('loginUsuario');
    const loginPassword = document.getElementById('loginPassword');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    const toggleThemeBtn = document.getElementById('toggleTheme');

    // ============================================================
    // Theme Handling
    // ============================================================
    const THEME_KEY = 'mollie_theme';
    function applyTheme(dark) {
        document.body.classList.toggle('dark-mode', dark);
        toggleThemeBtn.textContent = dark ? '☀️' : '🌙';
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    }
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
        applyTheme(savedTheme === 'dark');
    } else {
        applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    toggleThemeBtn.addEventListener('click', () => {
        applyTheme(!document.body.classList.contains('dark-mode'));
    });

    // ============================================================
    // State
    // ============================================================
    let usuarioActual = null;
    let rolActual = null;
    let categorias = [];
    let baseDatosInventario = [];

    // ============================================================
    // DOM References
    // ============================================================
    const formulario = document.getElementById('formularioInventario');
    const editIndex = document.getElementById('editIndex');
    const tituloFormulario = document.getElementById('tituloFormulario');
    const btnSubmitForm = document.getElementById('btnSubmitForm');
    const tablaCuerpo = document.getElementById('tablaCuerpo');
    const cajaBusqueda = document.getElementById('cajaBusqueda');
    const contadorProductos = document.getElementById('contadorProductos');
    const selectCategoria = document.getElementById('insCategoria');
    const nuevaCategoriaInput = document.getElementById('nuevaCategoriaInput');
    const btnAgregarCategoria = document.getElementById('btnAgregarCategoria');
    const contenedorListaCategorias = document.getElementById('contenedorListaCategorias');
    const btnGuardarBaseDatos = document.getElementById('btnGuardarBaseDatos');
    const btnDescargarPDF = document.getElementById('btnDescargarPDF');
    const rolActualElemento = document.getElementById('rolActual');
    const panelGestionSuperior = document.querySelector('.seccion-gestion-superior');
    const cajaPegarImagen = document.getElementById('cajaPegarImagen');
    const textoPegar = document.getElementById('textoPegar');
    const previsualizacionPegada = document.getElementById('previsualizacionPegada');
    let imagenBase64Guardada = '';

    const miModal = document.getElementById('miModal');
    const cerrarModal = document.getElementById('cerrarModal');
    const modalTituloProducto = document.getElementById('modalTituloProducto');
    const modalImgProducto = document.getElementById('modalImgProducto');
    const modalTextoDetalle = document.getElementById('modalTextoDetalle');

    const panelUsuarios = document.getElementById('panelUsuarios');
    const newUsername = document.getElementById('newUsername');
    const newPassword = document.getElementById('newPassword');
    const newRole = document.getElementById('newRole');
    const btnAgregarUsuario = document.getElementById('btnAgregarUsuario');
    const listaUsuarios = document.getElementById('listaUsuarios');
    const toastContainer = document.getElementById('toastContainer');

    const TOKEN_KEY = 'mollie_api_token';

    // ============================================================
    // Auth Token
    // ============================================================
    function getToken() { return localStorage.getItem(TOKEN_KEY); }
    function setToken(token) {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    }

    // ============================================================
    // Toast Notifications
    // ============================================================
    function mostrarMensaje(mensaje, tipo = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.innerHTML = `<strong>${tipo === 'error' ? '⚠️ Error' : '✅ Listo'}</strong><span>${mensaje}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px) scale(0.95)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
    function mostrarError(msg) { mostrarMensaje(msg, 'error'); }

    // ============================================================
    // Inline Confirm Dialog (replaces browser confirm())
    // ============================================================
    function mostrarConfirm(mensaje, onConfirm) {
        // Remove existing confirm if any
        document.getElementById('__confirmDialog')?.remove();

        const overlay = document.createElement('div');
        overlay.id = '__confirmDialog';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9998;
            background: rgba(15,23,42,0.45); backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center;
        `;
        overlay.innerHTML = `
            <div style="
                background: var(--bg-card); border: 1px solid var(--border);
                border-radius: 16px; padding: 28px 32px; max-width: 360px; width: 90%;
                box-shadow: 0 25px 50px rgba(0,0,0,0.3); text-align: center;
            ">
                <p style="font-size:15px; font-weight:600; margin-bottom:20px; line-height:1.5;">${mensaje}</p>
                <div style="display:flex; gap:12px; justify-content:center;">
                    <button id="__confirmNo" style="
                        flex:1; padding:10px 20px; border-radius:10px; border:1px solid var(--border);
                        background: var(--bg-input); font-weight:600; font-size:13px;
                        cursor:pointer; font-family:inherit; color: var(--text-main);
                    ">Cancelar</button>
                    <button id="__confirmSi" style="
                        flex:1; padding:10px 20px; border-radius:10px; border:none;
                        background: hsl(350,80%,45%); color:white; font-weight:700; font-size:13px;
                        cursor:pointer; font-family:inherit;
                    ">Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('__confirmNo').onclick = () => overlay.remove();
        document.getElementById('__confirmSi').onclick = () => {
            overlay.remove();
            onConfirm();
        };
    }

    // ============================================================
    // API Fetch Helper
    // ============================================================
    async function fetchApi(url, options = {}) {
        const headers = options.headers || {};
        if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(url, {
            ...options,
            headers,
            body: options.body && !(options.body instanceof FormData)
                ? JSON.stringify(options.body)
                : options.body
        });
        let data;
        try { data = await response.json(); } catch { data = null; }
        if (!response.ok) {
            throw new Error(data?.error || response.statusText || 'Error en la petición');
        }
        return data;
    }

    // ============================================================
    // Auth Flow
    // ============================================================
    formAutenticacion.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usuarioInput = loginUsuario.value.trim().toLowerCase();
        const passwordInput = loginPassword.value;
        if (!usuarioInput || !passwordInput) return;
        try {
            const data = await fetchApi('/api/login', {
                method: 'POST',
                body: { username: usuarioInput, password: passwordInput }
            });
            setToken(data.token);
            usuarioActual = data.username;
            rolActual = data.role;
            loginUsuario.value = '';
            loginPassword.value = '';
            await iniciarSesion();
        } catch (error) {
            mostrarError(error.message);
        }
    });

    btnCerrarSesion.addEventListener('click', () => {
        setToken(null);
        usuarioActual = null;
        rolActual = null;
        seccionLogin.style.display = 'flex';
        seccionInventario.style.display = 'none';
    });

    async function iniciarSesion() {
        try {
            const info = await fetchApi('/api/me');
            usuarioActual = info.username;
            rolActual = info.role;
            seccionLogin.style.display = 'none';
            seccionInventario.style.display = 'block';
            await inicializarInventario();
            actualizarVistaPorRol();
        } catch {
            setToken(null);
            usuarioActual = null;
            rolActual = null;
            seccionLogin.style.display = 'flex';
            seccionInventario.style.display = 'none';
        }
    }

    async function inicializarInventario() {
        await Promise.all([cargarCategorias(), cargarInventario()]);
    }

    // ============================================================
    // Data Loaders
    // ============================================================
    async function cargarCategorias() {
        try {
            categorias = await fetchApi('/api/categories');
            actualizarInterfazCategorias();
        } catch (error) { mostrarError(error.message); }
    }

    async function cargarInventario() {
        try {
            baseDatosInventario = await fetchApi('/api/inventory');
            renderizarTablaVisual();
        } catch (error) { mostrarError(error.message); }
    }

    async function cargarUsuarios() {
        if (rolActual !== 'admin') return;
        try {
            const usuarios = await fetchApi('/api/users');
            renderizarUsuarios(usuarios);
        } catch { /* silent */ }
    }

    // ============================================================
    // Render Functions
    // ============================================================
    function renderizarUsuarios(usuarios) {
        if (!listaUsuarios) return;
        listaUsuarios.innerHTML = '';
        usuarios.forEach(u => {
            const item = document.createElement('div');
            item.className = 'item-categoria-admin';
            const deleteBtn = u.username === usuarioActual
                ? ''
                : `<button type="button" class="btn-mini-eliminar btn-eliminar-usuario" data-id="${u.id}">✕</button>`;
            item.innerHTML = `<span><strong>${u.username}</strong> (${u.role})</span>${deleteBtn}`;
            listaUsuarios.appendChild(item);
        });
    }

    function actualizarInterfazCategorias() {
        selectCategoria.innerHTML = '<option value="">-- Seleccionar --</option>';
        [...categorias]
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                selectCategoria.appendChild(opt);
            });
        contenedorListaCategorias.innerHTML = '';
        categorias.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'item-categoria-admin';
            item.innerHTML = `<span>${cat.name}</span><button type="button" class="btn-mini-eliminar btn-eliminar-categoria" data-id="${cat.id}">✕</button>`;
            contenedorListaCategorias.appendChild(item);
        });
    }

    function actualizarVistaPorRol() {
        const esAdmin = rolActual === 'admin';
        panelGestionSuperior.style.display = esAdmin ? 'grid' : 'none';
        btnGuardarBaseDatos.style.display = esAdmin ? 'inline-flex' : 'none';
        if (panelUsuarios) panelUsuarios.style.display = esAdmin ? 'block' : 'none';
        rolActualElemento.textContent = esAdmin ? 'Administrador' : 'Cajero';
        renderizarTablaVisual();
        if (esAdmin) cargarUsuarios();
    }

    function renderizarTablaVisual() {
        tablaCuerpo.innerHTML = '';
        baseDatosInventario.forEach((prod) => {
            const fila = document.createElement('tr');
            const claseEstado = prod.stock === 0 ? 'agotado' : prod.stock <= 5 ? 'bajo' : 'disponible';
            const textoEstado = prod.stock === 0 ? '● Agotado' : prod.stock <= 5 ? '● Stock Bajo' : '● Disponible';
            const operaciones = rolActual === 'admin'
                ? `<button type="button" class="btn-op btn-editar" data-id="${prod.id}">Editar</button>
                   <button type="button" class="btn-op btn-borrar" data-id="${prod.id}">Borrar</button>`
                : `<span style="color: var(--text-muted); font-size: 12px;">Sin permisos</span>`;
            fila.innerHTML = `
                <td class="codigo-txt">${prod.codigo}</td>
                <td><span class="badge-categoria">${prod.categoria}</span></td>
                <td style="font-weight:600;">${prod.marca}</td>
                <td><button type="button" class="btn-detalle-link" data-id="${prod.id}">${prod.detalle}</button></td>
                <td>${prod.etiqueta}</td>
                <td><span class="anexo-txt">${prod.anexo}</span></td>
                <td>${prod.contenido}</td>
                <td>${prod.medida}</td>
                <td style="text-align:center; font-weight:700;">${prod.stock}</td>
                <td><span class="badge-estado ${claseEstado}">${textoEstado}</span></td>
                <td>${operaciones}</td>
            `;
            tablaCuerpo.appendChild(fila);
        });
        contadorProductos.textContent = baseDatosInventario.length;
    }

    // ============================================================
    // Form Submit (Add / Edit)
    // ============================================================
    async function enviarProducto(nuevoProducto) {
        const editingId = parseInt(editIndex.value, 10);
        try {
            if (editingId > 0) {
                await fetchApi(`/api/inventory/${editingId}`, { method: 'PUT', body: nuevoProducto });
                mostrarMensaje('Producto actualizado con éxito.');
            } else {
                await fetchApi('/api/inventory', { method: 'POST', body: nuevoProducto });
                mostrarMensaje('Producto guardado.');
            }
            formulario.reset();
            editIndex.value = '-1';
            tituloFormulario.textContent = '+ Añadir Elemento al Inventario';
            btnSubmitForm.textContent = 'Agregar al Inventario';
            imagenBase64Guardada = '';
            previsualizacionPegada.style.display = 'none';
            textoPegar.textContent = 'Haz clic y presiona Ctrl+V para pegar imagen';
            await cargarInventario();
        } catch (error) {
            mostrarError(error.message);
        }
    }

    formulario.addEventListener('submit', (e) => {
        e.preventDefault();
        enviarProducto({
            codigo: document.getElementById('insCodigo').value,
            categoria: selectCategoria.value,
            marca: document.getElementById('insMarca').value,
            detalle: document.getElementById('insDetalle').value,
            imagen: imagenBase64Guardada,
            etiqueta: document.getElementById('insEtiqueta').value,
            anexo: document.getElementById('insAnexo').value,
            contenido: document.getElementById('insContenido').value,
            medida: document.getElementById('insMedida').value,
            stock: parseInt(document.getElementById('insStock').value, 10)
        });
    });

    // ============================================================
    // Table Interactions (using closest() for robust click handling)
    // ============================================================
    tablaCuerpo.addEventListener('click', async (e) => {
        const btnDetalle = e.target.closest('.btn-detalle-link');
        const btnBorrar = e.target.closest('.btn-borrar');
        const btnEditar = e.target.closest('.btn-editar');

        if (!btnDetalle && !btnBorrar && !btnEditar) return;

        const btn = btnDetalle || btnBorrar || btnEditar;
        const id = parseInt(btn.getAttribute('data-id'), 10);
        if (isNaN(id)) return;
        const producto = baseDatosInventario.find(p => p.id === id);
        if (!producto) return;

        if (btnDetalle) {
            modalTituloProducto.textContent = `[${producto.codigo}] ${producto.marca}`;
            modalImgProducto.src = producto.imagen || '';
            modalImgProducto.style.display = producto.imagen ? 'block' : 'none';
            modalTextoDetalle.innerHTML = `
                <strong>Detalle:</strong> ${producto.detalle}<br><br>
                <strong>Categoría:</strong> ${producto.categoria}<br>
                <strong>Contenido:</strong> ${producto.contenido}<br>
                <strong>Unidad:</strong> ${producto.medida}<br>
                <strong>Etiqueta:</strong> ${producto.etiqueta}
            `;
            miModal.classList.add('activo');
            return;
        }

        if (btnBorrar) {
            mostrarConfirm(`¿Eliminar "${producto.marca} – ${producto.codigo}"?`, async () => {
                try {
                    await fetchApi(`/api/inventory/${producto.id}`, { method: 'DELETE' });
                    await cargarInventario();
                    mostrarMensaje('Producto eliminado.');
                } catch (error) {
                    mostrarError(error.message);
                }
            });
            return;
        }

        if (btnEditar) {
            document.getElementById('insCodigo').value = producto.codigo;
            selectCategoria.value = producto.categoria;
            document.getElementById('insMarca').value = producto.marca;
            document.getElementById('insDetalle').value = producto.detalle;
            document.getElementById('insEtiqueta').value = producto.etiqueta;
            document.getElementById('insAnexo').value = producto.anexo;
            document.getElementById('insContenido').value = producto.contenido;
            document.getElementById('insMedida').value = producto.medida;
            document.getElementById('insStock').value = producto.stock;
            imagenBase64Guardada = producto.imagen;
            previsualizacionPegada.src = producto.imagen || '';
            previsualizacionPegada.style.display = producto.imagen ? 'block' : 'none';
            editIndex.value = producto.id;
            tituloFormulario.textContent = `✏️ Editando: ${producto.codigo}`;
            btnSubmitForm.textContent = 'Guardar Cambios';
            formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    cerrarModal.addEventListener('click', () => miModal.classList.remove('activo'));
    miModal.addEventListener('click', (e) => {
        if (e.target === miModal) miModal.classList.remove('activo');
    });

    // ============================================================
    // Paste Image
    // ============================================================
    cajaPegarImagen.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    imagenBase64Guardada = event.target.result;
                    previsualizacionPegada.src = imagenBase64Guardada;
                    previsualizacionPegada.style.display = 'block';
                    textoPegar.textContent = '✓ Imagen cargada';
                };
                reader.readAsDataURL(blob);
                e.preventDefault();
                break;
            }
        }
    });

    // ============================================================
    // Category Management
    // ============================================================
    btnAgregarCategoria.addEventListener('click', async () => {
        const nuevaCat = nuevaCategoriaInput.value.trim();
        if (!nuevaCat) return;
        try {
            categorias = await fetchApi('/api/categories', {
                method: 'POST',
                body: { name: nuevaCat }
            });
            actualizarInterfazCategorias();
            nuevaCategoriaInput.value = '';
            mostrarMensaje('Categoría añadida.');
        } catch (error) { mostrarError(error.message); }
    });

    contenedorListaCategorias.addEventListener('click', async (e) => {
        if (!e.target.closest('.btn-eliminar-categoria')) return;
        const categoryId = e.target.closest('.btn-eliminar-categoria').getAttribute('data-id');
        try {
            categorias = await fetchApi(`/api/categories/${categoryId}`, { method: 'DELETE' });
            actualizarInterfazCategorias();
            mostrarMensaje('Categoría eliminada.');
        } catch (error) { mostrarError(error.message); }
    });

    // ============================================================
    // User Management
    // ============================================================
    if (btnAgregarUsuario) {
        btnAgregarUsuario.addEventListener('click', async () => {
            const username = newUsername.value.trim().toLowerCase();
            const password = newPassword.value;
            const role = newRole.value;
            if (!username || !password) {
                mostrarError('Completa el usuario y la contraseña.');
                return;
            }
            try {
                await fetchApi('/api/users', { method: 'POST', body: { username, password, role } });
                newUsername.value = '';
                newPassword.value = '';
                await cargarUsuarios();
                mostrarMensaje('Usuario creado.');
            } catch (error) { mostrarError(error.message); }
        });
    }

    if (listaUsuarios) {
        listaUsuarios.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-eliminar-usuario');
            if (!btn) return;
            const id = btn.getAttribute('data-id');
            mostrarConfirm('¿Eliminar este usuario permanentemente?', async () => {
                try {
                    await fetchApi(`/api/users/${id}`, { method: 'DELETE' });
                    await cargarUsuarios();
                    mostrarMensaje('Usuario eliminado.');
                } catch (error) { mostrarError(error.message); }
            });
        });
    }

    // ============================================================
    // Sync Button
    // ============================================================
    btnGuardarBaseDatos.addEventListener('click', async () => {
        btnGuardarBaseDatos.disabled = true;
        const orig = btnGuardarBaseDatos.innerHTML;
        btnGuardarBaseDatos.innerHTML = '🔄 Sincronizando...';
        try {
            await Promise.all([cargarInventario(), cargarCategorias()]);
            if (rolActual === 'admin') await cargarUsuarios();
            mostrarMensaje('Lista sincronizada.');
        } catch (error) { mostrarError(error.message); }
        finally {
            setTimeout(() => {
                btnGuardarBaseDatos.disabled = false;
                btnGuardarBaseDatos.innerHTML = orig;
            }, 600);
        }
    });

    // ============================================================
    // PDF Export
    // ============================================================
    if (btnDescargarPDF) {
        btnDescargarPDF.addEventListener('click', () => window.print());
    }

    // ============================================================
    // Search / Filter
    // ============================================================
    cajaBusqueda.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        tablaCuerpo.querySelectorAll('tr').forEach((fila) => {
            fila.style.display = fila.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
    });

    // ============================================================
    // Auto-sync every 15 seconds (background, silent)
    // ============================================================
    setInterval(async () => {
        if (!usuarioActual) return;
        try {
            baseDatosInventario = await fetchApi('/api/inventory');
            renderizarTablaVisual();
            if (rolActual === 'admin') {
                categorias = await fetchApi('/api/categories');
                actualizarInterfazCategorias();
                const usrs = await fetchApi('/api/users');
                renderizarUsuarios(usrs);
            }
        } catch {
            // Silent background sync failure
        }
    }, 15000);

    // ============================================================
    // Boot: Try to restore session from saved token
    // ============================================================
    iniciarSesion();
});