document.addEventListener('DOMContentLoaded', () => {
    const seccionLogin = document.getElementById('seccionLogin');
    const seccionInventario = document.getElementById('seccionInventario');
    const formAutenticacion = document.getElementById('formAutenticacion');
    const loginUsuario = document.getElementById('loginUsuario');
    const loginPassword = document.getElementById('loginPassword');
    const loginTitulo = document.getElementById('loginTitulo');
    const loginSubtitulo = document.getElementById('loginSubtitulo');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    const toggleThemeBtn = document.getElementById('toggleTheme');

    // Theme handling
    const THEME_KEY = 'mollie_theme';
    function applyTheme(dark) {
        if (dark) {
            document.body.classList.add('dark-mode');
            toggleThemeBtn.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            toggleThemeBtn.textContent = '🌙';
        }
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    }
    // Initialize theme from storage or system preference
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
        applyTheme(savedTheme === 'dark');
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark);
    }
    toggleThemeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-mode');
        applyTheme(!isDark);
    });

    let usuarioActual = null;
    let rolActual = null;
    let categorias = [];
    let baseDatosInventario = [];

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
    let imagenBase64Guardada = "";

    const miModal = document.getElementById('miModal');
    const cerrarModal = document.getElementById('cerrarModal');
    const modalTituloProducto = document.getElementById('modalTituloProducto');
    const modalImgProducto = document.getElementById('modalImgProducto');
    const modalTextoDetalle = document.getElementById('modalTextoDetalle');

    const TOKEN_KEY = 'mollie_api_token';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }


    async function fetchApi(url, options = {}) {
        const headers = options.headers || {};
        if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        const token = getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        const response = await fetch(url, {
            ...options,
            headers,
            body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
        });
        let data;
        try {
            data = await response.json();
        } catch (err) {
            data = null;
        }
        if (!response.ok) {
            const message = data?.error || response.statusText || 'Error en la petición';
            throw new Error(message);
        }
        return data;
    }

    function mostrarError(mensaje) {
        alert(mensaje);
    }


    async function manejarAutenticacion(e) {
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
    }

    formAutenticacion.addEventListener('submit', manejarAutenticacion);

    btnCerrarSesion.addEventListener('click', () => {
        setToken(null);
        usuarioActual = null;
        rolActual = null;
        seccionLogin.style.display = 'block';
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
        } catch (error) {
            setToken(null);
            usuarioActual = null;
            rolActual = null;
            seccionLogin.style.display = 'block';
            seccionInventario.style.display = 'none';
        }
    }

    async function inicializarInventario() {
        await Promise.all([cargarCategorias(), cargarInventario()]);
    }

    async function cargarCategorias() {
        try {
            categorias = await fetchApi('/api/categories');
            actualizarInterfazCategorias();
        } catch (error) {
            mostrarError(error.message);
        }
    }

    async function cargarInventario() {
        try {
            baseDatosInventario = await fetchApi('/api/inventory');
            renderizarTablaVisual();
        } catch (error) {
            mostrarError(error.message);
        }
    }

    function actualizarInterfazCategorias() {
        selectCategoria.innerHTML = '<option value="">-- Seleccionar --</option>';
        categorias.sort((a, b) => a.name.localeCompare(b.name)).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = cat.name;
            selectCategoria.appendChild(opt);
        });
        contenedorListaCategorias.innerHTML = '';
        categorias.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'item-categoria-admin';
            item.innerHTML = `<span>${cat.name}</span><button type="button" class="btn-mini-eliminar" data-id="${cat.id}">✕</button>`;
            contenedorListaCategorias.appendChild(item);
        });
    }

    function actualizarVistaPorRol() {
        const esAdmin = rolActual === 'admin';
        panelGestionSuperior.style.display = esAdmin ? 'grid' : 'none';
        btnGuardarBaseDatos.style.display = esAdmin ? 'inline-flex' : 'none';
        rolActualElemento.textContent = esAdmin ? 'Administrador' : 'Cajero';
        renderizarTablaVisual();
    }

    function renderizarTablaVisual() {
        tablaCuerpo.innerHTML = '';
        baseDatosInventario.forEach((prod, indice) => {
            const fila = document.createElement('tr');
            const claseEstado = prod.stock === 0 ? 'agotado' : prod.stock <= 5 ? 'bajo' : 'disponible';
            const textoEstado = prod.stock === 0 ? '● Agotado' : prod.stock <= 5 ? '● Stock Bajo' : '● Disponible';
            const operaciones = rolActual === 'admin'
                ? `<button type="button" class="btn-op btn-editar" data-id="${indice}">Editar</button><button type="button" class="btn-op btn-borrar" data-id="${indice}">Borrar</button>`
                : `<span style="color: var(--texto-secundario); font-size: 12px;">Sin permisos</span>`;
            fila.innerHTML = `
                <td class="codigo-txt">${prod.codigo}</td>
                <td><span class="badge-categoria">${prod.categoria}</span></td>
                <td style="font-weight:600;">${prod.marca}</td>
                <td><button type="button" class="btn-detalle-link" data-id="${indice}">${prod.detalle}</button></td>
                <td>${prod.etiqueta}</td>
                <td><a href="#">${prod.anexo}</a></td>
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

    async function enviarProducto(nuevoProducto) {
        const idx = parseInt(editIndex.value, 10);
        try {
            if (idx > -1) {
                const producto = baseDatosInventario[idx];
                await fetchApi(`/api/inventory/${producto.id}`, {
                    method: 'PUT',
                    body: nuevoProducto
                });
                mostrarError('Producto actualizado con éxito.');
            } else {
                await fetchApi('/api/inventory', {
                    method: 'POST',
                    body: nuevoProducto
                });
                mostrarError('Producto guardado en la base de datos.');
            }
            formulario.reset();
            editIndex.value = '-1';
            tituloFormulario.textContent = '+ Añadir Elemento al Inventario';
            btnSubmitForm.textContent = 'Agregar a la Lista Temporal';
            imagenBase64Guardada = '';
            previsualizacionPegada.style.display = 'none';
            await cargarInventario();
        } catch (error) {
            mostrarError(error.message);
        }
    }

    formulario.addEventListener('submit', (e) => {
        e.preventDefault();
        const nuevoProducto = {
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
        };
        enviarProducto(nuevoProducto);
    });

    tablaCuerpo.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (!id) return;
        const producto = baseDatosInventario[id];
        if (e.target.classList.contains('btn-detalle-link')) {
            modalTituloProducto.textContent = `[${producto.codigo}] ${producto.marca} - Ficha Técnica`;
            modalImgProducto.src = producto.imagen || '';
            modalTextoDetalle.innerHTML = `<strong>Detalle:</strong> ${producto.detalle}<br><br><strong>Categoría:</strong> ${producto.categoria}<br><strong>Kit:</strong> ${producto.contenido}<br><strong>Unidad:</strong> ${producto.medida}`;
            miModal.classList.add('activo');
            return;
        }
        if (e.target.classList.contains('btn-borrar')) {
            try {
                await fetchApi(`/api/inventory/${producto.id}`, { method: 'DELETE' });
                await cargarInventario();
            } catch (error) {
                mostrarError(error.message);
            }
            return;
        }
        if (e.target.classList.contains('btn-editar')) {
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
            previsualizacionPegada.src = producto.imagen;
            previsualizacionPegada.style.display = producto.imagen ? 'block' : 'none';
            editIndex.value = id;
            tituloFormulario.textContent = '✏️ Editando Producto';
            btnSubmitForm.textContent = 'Guardar Cambios del Producto';
        }
    });

    cerrarModal.addEventListener('click', () => miModal.classList.remove('activo'));

    cajaPegarImagen.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i += 1) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    imagenBase64Guardada = event.target.result;
                    previsualizacionPegada.src = imagenBase64Guardada;
                    previsualizacionPegada.style.display = 'block';
                    textoPegar.textContent = '¡Imagen actualizada!';
                };
                reader.readAsDataURL(blob);
                e.preventDefault();
                break;
            }
        }
    });

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
        } catch (error) {
            mostrarError(error.message);
        }
    });

    contenedorListaCategorias.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('btn-mini-eliminar')) return;
        const categoryId = e.target.getAttribute('data-id');
        try {
            categorias = await fetchApi(`/api/categories/${categoryId}`, {
                method: 'DELETE'
            });
            actualizarInterfazCategorias();
        } catch (error) {
            mostrarError(error.message);
        }
    });

    btnGuardarBaseDatos.addEventListener('click', async () => {
        try {
            await cargarInventario();
            mostrarError('Inventario sincronizado con la base de datos.');
        } catch (error) {
            mostrarError(error.message);
        }
    });

    cajaBusqueda.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        tablaCuerpo.querySelectorAll('tr').forEach((fila) => {
            fila.style.display = fila.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
    });
});