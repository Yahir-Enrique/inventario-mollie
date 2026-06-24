document.addEventListener('DOMContentLoaded', () => {
    const toggleThemeBtn = document.getElementById('toggleTheme');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    const btnMenuMovil = document.getElementById('btnMenuMovil');
    const overlayMenu = document.getElementById('overlayMenu');
    const rolActualElemento = document.getElementById('rolActual');
    const tituloUsuarios = document.getElementById('tituloUsuarios');
    const editUserId = document.getElementById('editUserId');
    const newUsername = document.getElementById('newUsername');
    const newPassword = document.getElementById('newPassword');
    const newRole = document.getElementById('newRole');
    const btnAgregarUsuario = document.getElementById('btnAgregarUsuario');
    const btnCancelarUsuario = document.getElementById('btnCancelarUsuario');
    const listaUsuarios = document.getElementById('listaUsuarios');
    const toastContainer = document.getElementById('toastContainer');

    const TOKEN_KEY = 'mollie_api_token';
    const THEME_KEY = 'mollie_theme';
    let usuarioActual = null;

    function getToken() { return localStorage.getItem(TOKEN_KEY); }
    function setToken(token) {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    }

    function applyTheme(dark) {
        document.body.classList.toggle('dark-mode', dark);
        toggleThemeBtn.textContent = dark ? '☀️' : '🌙';
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    }

    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme ? savedTheme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    toggleThemeBtn.addEventListener('click', () => {
        applyTheme(!document.body.classList.contains('dark-mode'));
    });

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

    async function fetchApi(url, options = {}) {
        const headers = options.headers || {};
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(url, {
            ...options,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        let data;
        try { data = await response.json(); } catch { data = null; }
        if (!response.ok) throw new Error(data?.error || response.statusText || 'Error en la petición');
        return data;
    }

    function mostrarConfirm(mensaje, onConfirm) {
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

    function renderizarUsuarios(usuarios) {
        listaUsuarios.innerHTML = '';
        usuarios.forEach(u => {
            const item = document.createElement('div');
            item.className = 'item-categoria-admin';
            item.dataset.id = u.id;
            item.dataset.username = u.username;
            item.dataset.role = u.role;
            const deleteBtn = u.username === usuarioActual
                ? ''
                : `<button type="button" class="btn-mini-eliminar btn-eliminar-usuario" data-id="${u.id}">✕</button>`;
            item.innerHTML = `
                <span><strong>${u.username}</strong> (${u.role})</span>
                <div class="usuario-acciones">
                    <button type="button" class="btn-mini-editar btn-editar-usuario" data-id="${u.id}">Editar</button>
                    ${deleteBtn}
                </div>
            `;
            listaUsuarios.appendChild(item);
        });
    }

    async function cargarUsuarios() {
        const usuarios = await fetchApi('/api/users');
        renderizarUsuarios(usuarios);
    }

    function limpiarFormularioUsuario() {
        editUserId.value = '-1';
        newUsername.value = '';
        newPassword.value = '';
        newRole.value = 'cajero';
        newPassword.placeholder = 'Contraseña...';
        tituloUsuarios.textContent = '👥 Usuarios';
        btnAgregarUsuario.textContent = 'Crear Usuario';
        btnCancelarUsuario.hidden = true;
    }

    btnAgregarUsuario.addEventListener('click', async () => {
        const editingUserId = parseInt(editUserId.value, 10);
        const username = newUsername.value.trim().toLowerCase();
        const password = newPassword.value;
        const role = newRole.value;
        if (!username || (!password && editingUserId <= 0)) {
            mostrarError('Completa el usuario y la contraseña.');
            return;
        }
        try {
            if (editingUserId > 0) {
                const data = await fetchApi(`/api/users/${editingUserId}`, {
                    method: 'PUT',
                    body: { username, password, role }
                });
                if (data.token) {
                    setToken(data.token);
                    usuarioActual = data.username;
                    rolActualElemento.textContent = data.role === 'admin' ? 'Administrador' : 'Cajero';
                }
                mostrarMensaje('Usuario actualizado.');
            } else {
                await fetchApi('/api/users', { method: 'POST', body: { username, password, role } });
                mostrarMensaje('Usuario creado.');
            }
            limpiarFormularioUsuario();
            await cargarUsuarios();
        } catch (error) { mostrarError(error.message); }
    });

    btnCancelarUsuario.addEventListener('click', limpiarFormularioUsuario);

    listaUsuarios.addEventListener('click', async (e) => {
        const btnEditar = e.target.closest('.btn-editar-usuario');
        const btnEliminar = e.target.closest('.btn-eliminar-usuario');

        if (btnEditar) {
            const item = btnEditar.closest('.item-categoria-admin');
            editUserId.value = item.dataset.id;
            newUsername.value = item.dataset.username;
            newPassword.value = '';
            newPassword.placeholder = 'Nueva contraseña (opcional)';
            newRole.value = item.dataset.role;
            tituloUsuarios.textContent = `Editando: ${item.dataset.username}`;
            btnAgregarUsuario.textContent = 'Guardar Cambios';
            btnCancelarUsuario.hidden = false;
            newUsername.focus();
            return;
        }

        if (!btnEliminar) return;
        const id = btnEliminar.getAttribute('data-id');
        mostrarConfirm('¿Eliminar este usuario permanentemente?', async () => {
            try {
                await fetchApi(`/api/users/${id}`, { method: 'DELETE' });
                await cargarUsuarios();
                mostrarMensaje('Usuario eliminado.');
            } catch (error) { mostrarError(error.message); }
        });
    });

    document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.passwordTarget);
            if (!input) return;
            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            btn.textContent = mostrar ? 'Ocultar' : 'Ver';
            btn.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Ver contraseña');
            btn.title = mostrar ? 'Ocultar contraseña' : 'Ver contraseña';
        });
    });

    btnMenuMovil.addEventListener('click', () => document.body.classList.add('menu-abierto'));
    overlayMenu.addEventListener('click', () => document.body.classList.remove('menu-abierto'));
    btnCerrarSesion.addEventListener('click', () => {
        setToken(null);
        window.location.href = 'index.html';
    });

    async function iniciar() {
        try {
            const info = await fetchApi('/api/me');
            usuarioActual = info.username;
            if (info.role !== 'admin') {
                window.location.href = 'index.html';
                return;
            }
            rolActualElemento.textContent = 'Administrador';
            await cargarUsuarios();
        } catch {
            setToken(null);
            window.location.href = 'index.html';
        }
    }

    iniciar();
});
