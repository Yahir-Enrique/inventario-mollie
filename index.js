document.addEventListener('DOMContentLoaded', () => {
    const seccionLogin = document.getElementById('seccionLogin');
    const seccionInventario = document.getElementById('seccionInventario');
    const formAutenticacion = document.getElementById('formAutenticacion');
    const loginUsuario = document.getElementById('loginUsuario');
    const loginPassword = document.getElementById('loginPassword');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    const toggleThemeBtn = document.getElementById('toggleTheme');
    const btnMenuMovil = document.getElementById('btnMenuMovil');
    const panelNavegacion = document.getElementById('panelNavegacion');
    const overlayMenu = document.getElementById('overlayMenu');
    const navLinks = document.querySelectorAll('.nav-link[data-vista]');
    const navAdminLinks = document.querySelectorAll('.nav-admin');
    const panelesVista = document.querySelectorAll('[data-panel-vista]');

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
    let vistaActual = 'inventario';

    // ============================================================
    // DOM References
    // ============================================================
    const formulario = document.getElementById('formularioInventario');
    const panelFormularioInventario = formulario.closest('.panel-formulario');
    const panelCategorias = document.getElementById('panelCategorias');
    const editIndex = document.getElementById('editIndex');
    const tituloFormulario = document.getElementById('tituloFormulario');
    const btnSubmitForm = document.getElementById('btnSubmitForm');
    const tablaCuerpo = document.getElementById('tablaCuerpo');
    const cajaBusqueda = document.getElementById('cajaBusqueda');
    const filtroCategoria = document.getElementById('filtroCategoria');
    const filtroEstadoStock = document.getElementById('filtroEstadoStock');
    const ordenInventario = document.getElementById('ordenInventario');
    const contadorProductos = document.getElementById('contadorProductos');
    const selectCategoria = document.getElementById('insCategoria');
    const nuevaCategoriaInput = document.getElementById('nuevaCategoriaInput');
    const btnAgregarCategoria = document.getElementById('btnAgregarCategoria');
    const contenedorListaCategorias = document.getElementById('contenedorListaCategorias');
    const btnGuardarBaseDatos = document.getElementById('btnGuardarBaseDatos');
    const btnExportar = document.getElementById('btnExportar');
    const tipoExportacion = document.getElementById('tipoExportacion');
    const rolActualElemento = document.getElementById('rolActual');
    const cajaPegarImagen = document.getElementById('cajaPegarImagen');
    const textoPegar = document.getElementById('textoPegar');
    const inputImagenProducto = document.getElementById('inputImagenProducto');
    const previsualizacionPegada = document.getElementById('previsualizacionPegada');
    let imagenBase64Guardada = '';
    const insAnexo = document.getElementById('insAnexo');
    const inputAnexoProducto = document.getElementById('inputAnexoProducto');
    const textoAnexo = document.getElementById('textoAnexo');
    let anexoGuardado = '';

    const miModal = document.getElementById('miModal');
    const cerrarModal = document.getElementById('cerrarModal');
    const modalTituloProducto = document.getElementById('modalTituloProducto');
    const modalImgProducto = document.getElementById('modalImgProducto');
    const modalTextoDetalle = document.getElementById('modalTextoDetalle');

    const toastContainer = document.getElementById('toastContainer');

    const TOKEN_KEY = 'mollie_api_token';

    // ============================================================
    // UI Helpers
    // ============================================================
    function normalizarTexto(valor) {
        return String(valor ?? '').trim().toLowerCase();
    }

    function escaparHtml(valor) {
        return String(valor ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function parsearAnexo(valor) {
        if (!valor) return null;
        try {
            const data = JSON.parse(valor);
            if (data && data.name) return data;
        } catch {
            // Old records can have only a filename as plain text.
        }
        return { name: valor, data: '', type: '' };
    }

    function nombreAnexo(valor) {
        return parsearAnexo(valor)?.name || '';
    }

    function renderizarAnexo(valor) {
        const anexo = parsearAnexo(valor);
        if (!anexo?.name) return '<span class="anexo-txt">Sin anexo</span>';
        const nombreSeguro = escaparHtml(anexo.name);
        if (anexo.data) {
            return `<a class="anexo-enlace" href="${anexo.data}" download="${nombreSeguro}">${nombreSeguro}</a>`;
        }
        return `<span class="anexo-txt">${nombreSeguro}</span>`;
    }

    function limpiarTextoExport(valor) {
        return String(valor ?? '').replace(/\s+/g, ' ').trim();
    }

    function obtenerFilasExportacion() {
        return obtenerProductosVisibles().map(prod => ({
            codigo: limpiarTextoExport(prod.codigo),
            categoria: limpiarTextoExport(prod.categoria),
            marca: limpiarTextoExport(prod.marca),
            detalle: limpiarTextoExport(prod.detalle),
            etiqueta: limpiarTextoExport(prod.etiqueta),
            anexo: limpiarTextoExport(nombreAnexo(prod.anexo)),
            contenido: limpiarTextoExport(prod.contenido),
            medida: limpiarTextoExport(prod.medida),
            stock: limpiarTextoExport(prod.stock),
            estado: limpiarTextoExport(textoEstadoStock(obtenerEstadoStock(prod.stock)).replace('●', ''))
        }));
    }

    function exportarExcel() {
        const encabezados = ['Código', 'Categoría', 'Marca', 'Detalle', 'Etiqueta', 'Anexo', 'Contenido', 'Medida', 'Stock', 'Estado'];
        const filas = obtenerFilasExportacion();
        const csv = [
            encabezados,
            ...filas.map(fila => [fila.codigo, fila.categoria, fila.marca, fila.detalle, fila.etiqueta, fila.anexo, fila.contenido, fila.medida, fila.stock, fila.estado])
        ].map(row => row.map(valor => `"${String(valor).replaceAll('"', '""')}"`).join(',')).join('\r\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inventario-mollie-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    }

    function exportarPDF() {
        const filas = obtenerFilasExportacion();
        const filasHtml = filas.map(fila => `
            <tr>
                <td>${escaparHtml(fila.codigo)}</td>
                <td>${escaparHtml(fila.categoria)}</td>
                <td>${escaparHtml(fila.marca)}</td>
                <td>${escaparHtml(fila.detalle)}</td>
                <td>${escaparHtml(fila.etiqueta)}</td>
                <td>${escaparHtml(fila.anexo)}</td>
                <td>${escaparHtml(fila.contenido)}</td>
                <td>${escaparHtml(fila.medida)}</td>
                <td>${escaparHtml(fila.stock)}</td>
                <td>${escaparHtml(fila.estado)}</td>
            </tr>
        `).join('');
        const htmlReporte = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Inventario Mollie Aspen</title>
                <style>
                    @page { size: landscape; margin: 10mm; }
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
                    h1 { font-size: 18px; margin: 0 0 4px; }
                    .meta { color: #4b5563; font-size: 11px; margin-bottom: 12px; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 9px; line-height: 1.25; vertical-align: top; word-wrap: break-word; }
                    th { background: #eef2ff; color: #1f2937; font-size: 8px; text-transform: uppercase; }
                    th:nth-child(1), td:nth-child(1) { width: 8%; }
                    th:nth-child(2), td:nth-child(2) { width: 10%; }
                    th:nth-child(3), td:nth-child(3) { width: 10%; }
                    th:nth-child(4), td:nth-child(4) { width: 17%; }
                    th:nth-child(5), td:nth-child(5) { width: 9%; }
                    th:nth-child(6), td:nth-child(6) { width: 10%; }
                    th:nth-child(7), td:nth-child(7) { width: 14%; }
                    th:nth-child(8), td:nth-child(8) { width: 7%; }
                    th:nth-child(9), td:nth-child(9) { width: 5%; text-align: center; }
                    th:nth-child(10), td:nth-child(10) { width: 10%; }
                </style>
            </head>
            <body>
                <h1>Inventario Mollie Aspen</h1>
                <div class="meta">Productos exportados: ${filas.length} · ${new Date().toLocaleString('es-SV')}</div>
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Categoría</th>
                            <th>Marca</th>
                            <th>Detalle</th>
                            <th>Etiqueta</th>
                            <th>Anexo</th>
                            <th>Contenido</th>
                            <th>Medida</th>
                            <th>Stock</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>${filasHtml}</tbody>
                </table>
            </body>
            </html>
        `;
        const iframeAnterior = document.getElementById('__iframeExportPDF');
        iframeAnterior?.remove();

        const iframe = document.createElement('iframe');
        iframe.id = '__iframeExportPDF';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlReporte);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => iframe.remove(), 1000);
        }, 150);
    }

    function abrirMenuMovil() {
        document.body.classList.add('menu-abierto');
    }

    function cerrarMenuMovil() {
        document.body.classList.remove('menu-abierto');
    }

    function mostrarVista(vista) {
        const esAdmin = rolActual === 'admin';
        const destino = (!esAdmin && vista !== 'inventario') ? 'inventario' : vista;
        vistaActual = destino;
        panelesVista.forEach(panel => {
            panel.classList.toggle('activa', panel.dataset.panelVista === destino);
        });
        navLinks.forEach(link => {
            link.classList.toggle('activo', link.dataset.vista === destino);
        });
        cerrarMenuMovil();
    }

    function extraerNumeroCodigo(codigo) {
        const coincidencias = String(codigo ?? '').match(/\d+/g);
        return coincidencias ? Number(coincidencias[coincidencias.length - 1]) : Number.POSITIVE_INFINITY;
    }

    function compararCodigos(a, b) {
        const numeroA = extraerNumeroCodigo(a.codigo);
        const numeroB = extraerNumeroCodigo(b.codigo);
        if (numeroA !== numeroB) return numeroA - numeroB;
        return String(a.codigo ?? '').localeCompare(String(b.codigo ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    }

    function obtenerEstadoStock(stock) {
        const cantidad = Number(stock);
        if (cantidad === 0) return 'agotado';
        return 'disponible';
    }

    function obtenerClaseStock(stock) {
        const cantidad = Number(stock);
        if (cantidad === 0) return 'agotado';
        if (cantidad <= 5) return 'bajo';
        return 'disponible';
    }

    function textoEstadoStock(estado) {
        if (estado === 'agotado') return '● Agotado';
        return '● Disponible';
    }

    function obtenerProductosVisibles() {
        const query = normalizarTexto(cajaBusqueda.value);
        const categoria = normalizarTexto(filtroCategoria?.value);
        const estadoStock = filtroEstadoStock?.value || '';
        const orden = ordenInventario?.value || 'codigo-asc';

        return [...baseDatosInventario]
            .filter((prod) => {
                const coincideBusqueda = !query || [
                    prod.codigo,
                    prod.categoria,
                    prod.marca,
                    prod.detalle,
                    prod.etiqueta,
                    nombreAnexo(prod.anexo),
                    prod.contenido,
                    prod.medida,
                    prod.stock
                ].some(valor => normalizarTexto(valor).includes(query));

                const coincideCategoria = !categoria || normalizarTexto(prod.categoria) === categoria;
                const coincideStock = !estadoStock
                    || obtenerEstadoStock(prod.stock) === estadoStock
                    || (estadoStock === 'bajo' && obtenerClaseStock(prod.stock) === 'bajo');
                return coincideBusqueda && coincideCategoria && coincideStock;
            })
            .sort((a, b) => {
                if (orden === 'codigo-desc') return compararCodigos(b, a);
                if (orden === 'categoria') return String(a.categoria ?? '').localeCompare(String(b.categoria ?? ''), undefined, { sensitivity: 'base' }) || compararCodigos(a, b);
                if (orden === 'marca') return String(a.marca ?? '').localeCompare(String(b.marca ?? ''), undefined, { sensitivity: 'base' }) || compararCodigos(a, b);
                if (orden === 'stock-asc') return Number(a.stock) - Number(b.stock) || compararCodigos(a, b);
                if (orden === 'stock-desc') return Number(b.stock) - Number(a.stock) || compararCodigos(a, b);
                return compararCodigos(a, b);
            });
    }

    function limpiarImagenProducto() {
        imagenBase64Guardada = '';
        if (inputImagenProducto) inputImagenProducto.value = '';
        previsualizacionPegada.removeAttribute('src');
        previsualizacionPegada.style.display = 'none';
        textoPegar.textContent = 'Sube una imagen o pega con Ctrl+V';
    }

    function cargarImagenProducto(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            mostrarError('Selecciona un archivo de imagen válido.');
            if (inputImagenProducto) inputImagenProducto.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            imagenBase64Guardada = event.target.result;
            previsualizacionPegada.src = imagenBase64Guardada;
            previsualizacionPegada.style.display = 'block';
            textoPegar.textContent = 'Imagen cargada';
        };
        reader.readAsDataURL(file);
    }

    function limpiarAnexoProducto() {
        anexoGuardado = '';
        if (insAnexo) insAnexo.value = '';
        if (inputAnexoProducto) inputAnexoProducto.value = '';
        if (textoAnexo) textoAnexo.textContent = 'PDF, documento o imagen';
    }

    function cargarAnexoProducto(file) {
        if (!file) return;
        const tiposPermitidos = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain'
        ];
        const esImagen = file.type.startsWith('image/');
        const esPermitido = esImagen || tiposPermitidos.includes(file.type) || /\.(pdf|docx?|xlsx?|pptx?|txt)$/i.test(file.name);
        if (!esPermitido) {
            mostrarError('Selecciona un PDF, documento, hoja de cálculo, presentación, texto o imagen.');
            if (inputAnexoProducto) inputAnexoProducto.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            anexoGuardado = JSON.stringify({
                name: file.name,
                type: file.type || 'application/octet-stream',
                data: event.target.result
            });
            if (insAnexo) insAnexo.value = anexoGuardado;
            if (textoAnexo) textoAnexo.textContent = file.name;
        };
        reader.readAsDataURL(file);
    }

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

    navLinks.forEach(link => {
        link.addEventListener('click', () => mostrarVista(link.dataset.vista));
    });

    btnMenuMovil?.addEventListener('click', abrirMenuMovil);
    overlayMenu?.addEventListener('click', cerrarMenuMovil);

    btnCerrarSesion.addEventListener('click', () => {
        setToken(null);
        usuarioActual = null;
        rolActual = null;
        cerrarMenuMovil();
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

    // ============================================================
    // Render Functions
    // ============================================================
    function actualizarInterfazCategorias() {
        const categoriaSeleccionada = selectCategoria.value;
        const filtroSeleccionado = filtroCategoria?.value || '';
        selectCategoria.innerHTML = '<option value="">-- Seleccionar --</option>';
        if (filtroCategoria) {
            filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>';
        }
        [...categorias]
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                selectCategoria.appendChild(opt);
                if (filtroCategoria) {
                    const filtroOpt = document.createElement('option');
                    filtroOpt.value = cat.name;
                    filtroOpt.textContent = cat.name;
                    filtroCategoria.appendChild(filtroOpt);
                }
            });
        if (categoriaSeleccionada && [...selectCategoria.options].some(opt => opt.value === categoriaSeleccionada)) {
            selectCategoria.value = categoriaSeleccionada;
        }
        if (filtroCategoria && filtroSeleccionado && [...filtroCategoria.options].some(opt => opt.value === filtroSeleccionado)) {
            filtroCategoria.value = filtroSeleccionado;
        }
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
        if (panelFormularioInventario) panelFormularioInventario.style.display = esAdmin ? 'flex' : 'none';
        if (panelCategorias) panelCategorias.style.display = esAdmin ? 'flex' : 'none';
        btnGuardarBaseDatos.style.display = esAdmin ? 'inline-flex' : 'none';
        navAdminLinks.forEach(link => {
            link.style.display = esAdmin ? 'flex' : 'none';
        });
        rolActualElemento.textContent = esAdmin ? 'Administrador' : 'Cajero';
        if (!esAdmin && vistaActual !== 'inventario') {
            vistaActual = 'inventario';
        }
        mostrarVista(vistaActual);
        renderizarTablaVisual();
    }

    function renderizarTablaVisual() {
        tablaCuerpo.innerHTML = '';
        const productosVisibles = obtenerProductosVisibles();
        productosVisibles.forEach((prod) => {
            const fila = document.createElement('tr');
            const claseEstado = obtenerClaseStock(prod.stock);
            const textoEstado = textoEstadoStock(obtenerEstadoStock(prod.stock));
            const operaciones = rolActual === 'admin'
                ? `<button type="button" class="btn-op btn-editar" data-id="${prod.id}">Editar</button>
                   <button type="button" class="btn-op btn-borrar" data-id="${prod.id}">Borrar</button>`
                : `<span style="color: var(--text-muted); font-size: 12px;">Sin permisos</span>`;
            fila.innerHTML = `
                <td data-label="Código" class="codigo-txt">${prod.codigo}</td>
                <td data-label="Categoría"><span class="badge-categoria">${prod.categoria}</span></td>
                <td data-label="Marca" style="font-weight:600;">${prod.marca}</td>
                <td data-label="Detalle"><button type="button" class="btn-detalle-link" data-id="${prod.id}">${prod.detalle}</button></td>
                <td data-label="Etiqueta">${prod.etiqueta}</td>
                <td data-label="Anexo">${renderizarAnexo(prod.anexo)}</td>
                <td data-label="Contenido">${prod.contenido}</td>
                <td data-label="Medida">${prod.medida}</td>
                <td data-label="Stock" style="text-align:center; font-weight:700;">${prod.stock}</td>
                <td data-label="Estado"><span class="badge-estado ${claseEstado}">${textoEstado}</span></td>
                <td data-label="Operaciones">${operaciones}</td>
            `;
            tablaCuerpo.appendChild(fila);
        });
        contadorProductos.textContent = productosVisibles.length === baseDatosInventario.length
            ? baseDatosInventario.length
            : `${productosVisibles.length} / ${baseDatosInventario.length}`;
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
            limpiarImagenProducto();
            limpiarAnexoProducto();
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
            anexo: anexoGuardado || insAnexo.value,
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
                <strong>Etiqueta:</strong> ${producto.etiqueta}<br>
                <strong>Anexo:</strong> ${renderizarAnexo(producto.anexo)}
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
            anexoGuardado = producto.anexo || '';
            if (insAnexo) insAnexo.value = anexoGuardado;
            if (inputAnexoProducto) inputAnexoProducto.value = '';
            if (textoAnexo) textoAnexo.textContent = nombreAnexo(producto.anexo) || 'PDF, documento o imagen';
            document.getElementById('insContenido').value = producto.contenido;
            document.getElementById('insMedida').value = producto.medida;
            document.getElementById('insStock').value = producto.stock;
            imagenBase64Guardada = producto.imagen;
            if (inputImagenProducto) inputImagenProducto.value = '';
            previsualizacionPegada.src = producto.imagen || '';
            previsualizacionPegada.style.display = producto.imagen ? 'block' : 'none';
            textoPegar.textContent = producto.imagen ? 'Imagen cargada' : 'Sube una imagen o pega con Ctrl+V';
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
    // Product Image
    // ============================================================
    if (inputImagenProducto) {
        inputImagenProducto.addEventListener('change', (e) => {
            cargarImagenProducto(e.target.files?.[0]);
        });
    }

    if (inputAnexoProducto) {
        inputAnexoProducto.addEventListener('change', (e) => {
            cargarAnexoProducto(e.target.files?.[0]);
        });
    }

    cajaPegarImagen.addEventListener('click', (e) => {
        if (e.target.closest('.btn-subir-imagen') || e.target === inputImagenProducto) return;
        cajaPegarImagen.focus();
    });

    cajaPegarImagen.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                cargarImagenProducto(item.getAsFile());
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
    // Sync Button
    // ============================================================
    btnGuardarBaseDatos.addEventListener('click', async () => {
        btnGuardarBaseDatos.disabled = true;
        const orig = btnGuardarBaseDatos.innerHTML;
        btnGuardarBaseDatos.innerHTML = '🔄 Sincronizando...';
        try {
            await Promise.all([cargarInventario(), cargarCategorias()]);
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
    // Export
    // ============================================================
    btnExportar?.addEventListener('click', () => {
        if (tipoExportacion?.value === 'excel') exportarExcel();
        else exportarPDF();
    });

    // ============================================================
    // Search / Filter
    // ============================================================
    [cajaBusqueda, filtroCategoria, filtroEstadoStock, ordenInventario].forEach((control) => {
        control?.addEventListener('input', renderizarTablaVisual);
        control?.addEventListener('change', renderizarTablaVisual);
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
