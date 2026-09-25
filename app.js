const sheetID = '1pCFrPSBBh3yxhiBE13GXHUyHADCWH9IG01Wkk7hs-mU';
const appsScriptURL = 'https://script.google.com/macros/s/AKfycbwXoixFi07-aesobxOfS6Fq5HX4SqnLyYZdxXjTTHDwxrUYNiqIlgF-OxPHTknpcusi/exec';

let rawData = [];
let rawObjectsFull = []; 
let pendData = [];
let mostrarConCiudad = false;
let permisosActuales = {};
let currentDynamicFiltered = [];
let currentExportFiltered = [];
let currentBDayFiltered = [];
let currentRetFiltered = [];
let chartEvolucionMesInstance = null;
let chartCargosMesInstance = null;
let chartTipoContratoInstance = null;
let chartCargosPorAreaInstance = null;

const tabMapping = [
    { id: 'dashboard', name: 'Vista General', icon: '📊', possibleCols: ['VISTA GENERAL', 'VISTAGENERAL'] },
    { id: 'filters', name: 'Filtro Personal', icon: '🔍', possibleCols: ['FILTRO PERSONAL', 'FILTROS DINAMICOS', 'FILTROS DINÁMICOS', 'FILTROS'] },
    { id: 'info-personal', name: 'Información Personal', icon: '📇', possibleCols: ['INF_PERSONAL', 'INFORMACION PERSONAL', 'INFORMACIÓN PERSONAL', 'INFO PERSONAL'] },
    { id: 'pendientes', name: 'Personal Pendiente', icon: '📈', possibleCols: ['PERSONAL PENDIENTE', 'PENDIENTES', 'P_PEND', 'VISTAGENERAL'] },
    { id: 'table', name: 'Listado General', icon: '📋', possibleCols: ['LISTADO GENERAL', 'LISTADOGENERAL'] },
    { id: 'export', name: 'Contratación', icon: '📥', possibleCols: ['MODULO CONTRATACION', 'MODULO CONTRATACIÓN', 'MODULO EXPORTACION', 'MODULO EXPORTACIÓN', 'EXPORTAR', 'EXPORTACIÓN'] },
    { id: 'retiros', name: 'Retiros', icon: '🚪', possibleCols: ['RETIROS', 'PERSONAL RETIRADO', 'RETIRADOS'] },
    { id: 'birthdays', name: 'Cumpleaños', icon: '🎂', possibleCols: ['CUMPLEAÑOS', 'CUMPLEANOS'] }
];

window.onload = () => {
    const savedUser = localStorage.getItem('th_user');
    const savedPass = localStorage.getItem('th_pass');
    
    if (savedUser && savedPass) {
        document.getElementById('loginUser').value = savedUser;
        document.getElementById('loginPass').value = savedPass;
        document.getElementById('rememberMe').checked = true;
        intentarLogin(true);
    }
};

function intentarLogin(isAuto = false) {
    const userIn = document.getElementById('loginUser').value.trim();
    const passIn = document.getElementById('loginPass').value.trim();
    const remember = document.getElementById('rememberMe').checked;
    const errDiv = document.getElementById('loginError');

    if(!userIn || !passIn) {
        if(!isAuto) {
            errDiv.textContent = "Por favor ingresa usuario y contraseña.";
            errDiv.classList.remove('hidden');
        }
        return;
    }

    errDiv.classList.add('hidden');
    document.getElementById('loadingOverlay').classList.remove('hidden');

    const jsonpURL = `https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?sheet=Usuarios&tqx=responseHandler:handleLoginData&cacheBust=${Date.now()}`;
    const script = document.createElement('script');
    script.src = jsonpURL;
    script.onerror = function() {
        document.getElementById('loadingOverlay').classList.add('hidden');
        if(!isAuto) {
            errDiv.textContent = "Error al conectar con la pestaña Usuarios.";
            errDiv.classList.remove('hidden');
        } else {
            localStorage.removeItem('th_user');
            localStorage.removeItem('th_pass');
        }
    };

    window.handleLoginData = function(response) {
        try {
            if (!response || !response.table) throw new Error("Estructura no válida.");
            const cols = response.table.cols.map(col => col ? (col.label || '').trim().toUpperCase() : '');
            const rows = response.table.rows;

            let usuariosList = rows.map(row => {
                let obj = {};
                if (row && row.c) {
                    row.c.forEach((cell, index) => {
                        let colName = cols[index];
                        if (colName) {
                            let val = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== undefined && cell.v !== null ? cell.v : '')) : '';
                            obj[colName.trim().toUpperCase()] = String(val).trim();
                            let cleanKey = colName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
                            obj[cleanKey] = String(val).trim();
                        }
                    });
                }
                return obj;
            });

            let usuarioEncontrado = usuariosList.find(u => {
                let uSheet = (u['USUARIO'] || '').trim().toLowerCase();
                let pSheet = String(u['CONTRASEÑA'] || u['CONTRASENA'] || '').trim();
                return uSheet === userIn.toLowerCase() && pSheet === passIn;
            });

            if(!usuarioEncontrado) {
                document.getElementById('loadingOverlay').classList.add('hidden');
                if(isAuto) {
                    localStorage.removeItem('th_user');
                    localStorage.removeItem('th_pass');
                    return;
                }
                errDiv.textContent = "Usuario o contraseña incorrectos.";
                errDiv.classList.remove('hidden');
                return;
            }

            permisosActuales = usuarioEncontrado;
            let passActualEnHoja = String(permisosActuales['CONTRASEÑA'] || permisosActuales['CONTRASENA'] || '').trim();

            if (passActualEnHoja === '123456') {
                document.getElementById('loadingOverlay').classList.add('hidden');
                document.getElementById('forcedPassModal').classList.remove('hidden');
                return;
            }

            if (remember) {
                localStorage.setItem('th_user', userIn);
                localStorage.setItem('th_pass', passIn);
            } else {
                localStorage.removeItem('th_user');
                localStorage.removeItem('th_pass');
            }
            
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mobileHeader').classList.remove('hidden');
            document.getElementById('mainAppContainer').classList.remove('hidden');
            
            document.getElementById('mobileSessionUser').textContent = usuarioEncontrado['USUARIO'];
            document.getElementById('desktopSessionUser').textContent = `Sesión: ${usuarioEncontrado['USUARIO']}`;

            construirNavegacionPermisos();
            fetchPersonalData();
            fetchPendData();

        } catch (e) {
            console.error(e);
            document.getElementById('loadingOverlay').classList.add('hidden');
            if(!isAuto) {
                errDiv.textContent = "Error al procesar los permisos.";
                errDiv.classList.remove('hidden');
            }
        }
    };
    document.head.appendChild(script);
}

function procesarCambioObligatorio() {
    const newP = document.getElementById('forcedNewPass').value.trim();
    const confirmP = document.getElementById('forcedConfirmPass').value.trim();
    const msgDiv = document.getElementById('forcedPassMsg');

    if (!newP || newP !== confirmP || newP.length < 4 || newP === '123456') {
        msgDiv.className = "text-xs font-medium text-center text-rose-600";
        msgDiv.textContent = "Verifica que las contraseñas coincidan, tengan más de 4 caracteres y no sean '123456'.";
        msgDiv.classList.remove('hidden');
        return;
    }

    const payload = { usuario: permisosActuales['USUARIO'], currentPass: '123456', newPass: newP };
    fetch(appsScriptURL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(() => {
        permisosActuales['CONTRASEÑA'] = newP;
        permisosActuales['CONTRASENA'] = newP;
        document.getElementById('forcedPassModal').classList.add('hidden');
        alert("¡Contraseña actualizada con éxito! Ingresa nuevamente.");
        location.reload();
    });
}

function abrirModalCambioPass() { document.getElementById('changePassModal').classList.remove('hidden'); }
function cerrarModalCambioPass() { document.getElementById('changePassModal').classList.add('hidden'); }

function toggleVisibility(inputId, eyeId) {
    const input = document.getElementById(inputId);
    const eye = document.getElementById(eyeId);
    input.type = input.type === "password" ? "text" : "password";
    eye.textContent = input.type === "password" ? "👁️" : "🙈";
}

function procesarCambioPass() {
    const currentP = document.getElementById('currentPass').value.trim();
    const newP = document.getElementById('newPass').value.trim();
    const confirmP = document.getElementById('confirmPass').value.trim();
    const msgDiv = document.getElementById('modalPassMsg');
    const passGuardadaActual = String(permisosActuales['CONTRASEÑA'] || permisosActuales['CONTRASENA'] || '').trim();

    if (currentP !== passGuardadaActual || newP !== confirmP || newP.length < 4) {
        msgDiv.className = "text-xs font-medium text-center text-rose-600";
        msgDiv.textContent = "Datos incorrectos o las nuevas claves no coinciden.";
        msgDiv.classList.remove('hidden');
        return;
    }

    fetch(appsScriptURL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: permisosActuales['USUARIO'], currentPass: currentP, newPass: newP }) })
    .then(() => {
        msgDiv.className = "text-xs font-medium text-center text-emerald-600";
        msgDiv.textContent = "¡Actualizado con éxito!";
        setTimeout(() => cerrarModalCambioPass(), 1500);
    });
}

function construirNavegacionPermisos() {
    const mobileNav = document.getElementById('mobileNavTabs');
    const desktopNav = document.getElementById('desktopNavTabs');
    mobileNav.innerHTML = '';
    desktopNav.innerHTML = '';
    let primeraTab = null;

    tabMapping.forEach(tab => {
        let tienePermiso = tab.possibleCols.some(cName => {
            let v1 = (permisosActuales[cName] || '').toUpperCase().trim();
            let v2 = (permisosActuales[cName.normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || '').toUpperCase().trim();
            return v1 === 'SI' || v2 === 'SI';
        });

        if (tienePermiso) {
            if (!primeraTab) primeraTab = tab.id;
            
            let btnM = document.createElement('button');
            btnM.onclick = () => switchTab(tab.id);
            btnM.id = `btn-m-${tab.id}`;
            btnM.className = "whitespace-nowrap px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs flex items-center gap-2 shrink-0 border border-slate-700";
            btnM.innerHTML = `<span>${tab.icon}</span> ${tab.name}`;
            mobileNav.appendChild(btnM);

            let btnD = document.createElement('button');
            btnD.onclick = () => switchTab(tab.id);
            btnD.id = `btn-d-${tab.id}`;
            btnD.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 font-medium text-sm transition";
            btnD.innerHTML = `${tab.icon} ${tab.name}`;
            desktopNav.appendChild(btnD);
        }
    });
    switchTab(primeraTab || 'dashboard');
}

function cerrarSesion() {
    localStorage.clear();
    location.reload();
}

function switchTab(tabName) {
    tabMapping.forEach(t => {
        let content = document.getElementById(`content-${t.id}`);
        if(content) content.classList.remove('active');
        let btnD = document.getElementById(`btn-d-${t.id}`);
        if(btnD) btnD.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 font-medium text-sm transition";
        let btnM = document.getElementById(`btn-m-${t.id}`);
        if(btnM) btnM.className = "whitespace-nowrap px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs flex items-center gap-2 shrink-0 border border-slate-700";
    });

    document.getElementById(`content-${tabName}`).classList.add('active');
    let activeD = document.getElementById(`btn-d-${tabName}`);
    if(activeD) activeD.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm transition";
    let activeM = document.getElementById(`btn-m-${tabName}`);
    if(activeM) activeM.className = "whitespace-nowrap px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-medium text-xs flex items-center gap-2 shrink-0 border border-transparent";
}

function fetchPersonalData() {
    const script = document.createElement('script');
    script.src = `https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?tqx=responseHandler:handlePersonalData&cacheBust=${Date.now()}`;
    script.onerror = () => document.getElementById('loadingOverlay').classList.add('hidden');
    document.head.appendChild(script);
}

window.handlePersonalData = function(response) {
    try {
        const cols = response.table.cols.map(col => col ? (col.label || '').trim().toUpperCase() : '');
        rawData = response.table.rows.map(row => {
            let obj = {};
            row.c.forEach((cell, idx) => {
                if (cols[idx]) obj[cols[idx]] = cell ? (cell.f || cell.v || '') : '';
            });
            return {
                original: obj,
                id: obj["IDENTIFICACION"] || obj["DOCUMENTO"] || "",
                name: obj["NOMBRE COMPLETO"] || "",
                cargo: obj["CARGO"] || "",
                area: obj["AREA"] || obj["DEPENDENCIA CARGO"] || "",
                city: obj["CIUDAD"] || "",
                date: obj["FECHA INGRESO"] || obj["FECHA DE INGRESO"] || "",
                fechaRenuncia: obj["FECHA RENUNCIA"] || "",
                status: obj["ACTIVO/INACTIVO"] || obj["ESTADO"] || ""
            };
        }).filter(i => i.id !== "");

        document.getElementById('loadingOverlay').classList.add('hidden');
        updateDashboardGeneral();
        applyFilters();
    } catch(e) {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
};

function fetchPendData() {
    const script = document.createElement('script');
    script.src = `https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?sheet=P_Pend&tqx=responseHandler:handlePendData&cacheBust=${Date.now()}`;
    document.head.appendChild(script);
}

window.handlePendData = function(response) {
    try {
        const cols = response.table.cols.map(col => col ? (col.label || '').trim().toUpperCase() : '');
        pendData = response.table.rows.map(row => {
            let obj = {};
            row.c.forEach((cell, idx) => {
                if (cols[idx]) obj[cols[idx]] = cell ? (cell.f || cell.v || '') : '';
            });
            return {
                cargo: obj["CARGO"] || "SIN CARGO",
                area: obj["AREA"] || "SIN ÁREA",
                city: obj["CIUDAD"] || "SIN CIUDAD"
            };
        });
        renderPendientesTable();
    } catch(e) {}
};

function parseDateStandard(dateStr) {
    if (!dateStr) return null;
    let dPart = String(dateStr).split(' ')[0].trim();
    if (dPart.includes('-')) return dPart;
    if (dPart.includes('/')) {
        let p = dPart.split('/');
        return p[2].length === 4 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`;
    }
    return null;
}

function formatearFechaDDMMYYYY(fechaStr) {
    let std = parseDateStandard(fechaStr);
    if (!std) return fechaStr;
    let [y, m, d] = std.split('-');
    return `${d}/${m}/${y}`;
}

function updateDashboardGeneral() {
    document.getElementById('kpiTotal').textContent = rawData.length;
    document.getElementById('kpiActivos').textContent = rawData.filter(i => i.status.toUpperCase() === 'ACTIVO').length;
}

function applyFilters() {
    currentDynamicFiltered = rawData;
    renderDynamicTable(currentDynamicFiltered);
}

function renderDynamicTable(data) {
    const tbody = document.getElementById('dynamicTableBody');
    tbody.innerHTML = data.slice(0, 100).map(item => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
            <td class="px-6 py-3">${item.id}</td>
            <td class="px-6 py-3 font-semibold">${item.name}</td>
            <td class="px-6 py-3">${item.cargo}</td>
            <td class="px-6 py-3">${item.area}</td>
            <td class="px-6 py-3">${item.city}</td>
            <td class="px-6 py-3">${formatearFechaDDMMYYYY(item.date)}</td>
            <td class="px-6 py-3">${item.status}</td>
        </tr>
    `).join('');
}

function exportarExcelProfesional(dataArray, filename) {
    const worksheet = XLSX.utils.json_to_sheet(dataArray);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
    XLSX.writeFile(workbook, filename);
}
