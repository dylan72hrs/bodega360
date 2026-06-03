// ============================================================================
// BODEGA360 - CORE APPLICATION LOGIC
// ============================================================================

// --- Constantes y Claves de Persistencia ---
const STORAGE_KEYS = {
    MATERIALS: 'bodega360_materials',
    SEARCH_LOGS: 'bodega360_search_logs',
    CHANGE_LOGS: 'bodega360_change_logs',
    IMPORT_LOGS: 'bodega360_import_logs',
    DISMISSED_SEARCHES: 'bodega360_dismissed_searches',
    DICTIONARY: 'bodega360_search_dictionary',
    CATEGORIES: 'bodega360_categories',
    TICKETS: 'bodega360_tickets',
    PENDING_STATES: 'bodega360_pending_states',
    SETTINGS: 'bodega360_settings'
};

// ============================================================================
// STORAGE ADAPTER
// ============================================================================
/**
 * CAPA DE ABSTRACCIÓN DE ALMACENAMIENTO (StorageAdapter)
 * Actualmente usa localStorage. 
 * Para un futuro servidor local multiusuario, reemplazar los métodos internos de
 * este adapter por llamadas a una API local (ej: usando fetch hacia Node.js o Python).
 * Toda la app debe interactuar exclusivamente con este adapter para leer/escribir datos.
 */
const StorageAdapter = {
    // Métodos privados internos actuales (localStorage)
    _loadLocal(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    _saveLocal(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    // Métodos públicos de la API de Almacenamiento
    getMaterials() { return this._loadLocal(STORAGE_KEYS.MATERIALS); },
    saveMaterials(data) { this._saveLocal(STORAGE_KEYS.MATERIALS, data); },
    
    getSearchLogs() { return this._loadLocal(STORAGE_KEYS.SEARCH_LOGS); },
    saveSearchLogs(data) { this._saveLocal(STORAGE_KEYS.SEARCH_LOGS, data); },
    
    getChangeLogs() { return this._loadLocal(STORAGE_KEYS.CHANGE_LOGS); },
    saveChangeLogs(data) { this._saveLocal(STORAGE_KEYS.CHANGE_LOGS, data); },
    
    getImportLogs() { return this._loadLocal(STORAGE_KEYS.IMPORT_LOGS); },
    saveImportLogs(data) { this._saveLocal(STORAGE_KEYS.IMPORT_LOGS, data); },
    
    getDismissedSearches() { return this._loadLocal(STORAGE_KEYS.DISMISSED_SEARCHES); },
    saveDismissedSearches(data) { this._saveLocal(STORAGE_KEYS.DISMISSED_SEARCHES, data); },

    getDictionary() { return this._loadLocal(STORAGE_KEYS.DICTIONARY); },
    saveDictionary(data) { this._saveLocal(STORAGE_KEYS.DICTIONARY, data); },

    getCategories() { return this._loadLocal(STORAGE_KEYS.CATEGORIES); },
    saveCategories(data) { this._saveLocal(STORAGE_KEYS.CATEGORIES, data); },

    getTickets() { return this._loadLocal(STORAGE_KEYS.TICKETS); },
    saveTickets(data) { this._saveLocal(STORAGE_KEYS.TICKETS, data); },

    getPendingStates() {
        const data = localStorage.getItem(STORAGE_KEYS.PENDING_STATES);
        return data ? JSON.parse(data) : {};
    },
    savePendingStates(data) {
        localStorage.setItem(STORAGE_KEYS.PENDING_STATES, JSON.stringify(data));
    },

    getSettings() {
        const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return {
            costoVigenciaDias: 90,
            minutosAhorroPorConsulta: 2,
            ultimoRespaldo: null,
            cambiosUltimoRespaldo: 0,
            ...(data ? JSON.parse(data) : {})
        };
    },
    saveSettings(data) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
    },
    
    clearAll() { localStorage.clear(); }
};

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
let isAdmin = false;
let currentMaterialEditing = null;
let currentImportData = null; // Guarda los datos parseados antes de confirmar
let lastSearchLog = { rut: '', query: '', time: 0 };
let searchDebounceTimer = null;
let currentPendingTerm = null;
let currentTicketContext = null;
let currentInventoryCode = null;
let inventoryPhotoDraft = null;

// ============================================================================
// FUNCIONES UTILITARIAS Y DE SIMILITUD
// ============================================================================
function formatCurrency(amount) {
    if (amount === null || amount === undefined || amount === "") return "-";
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

function formatDate(date) { return date.toISOString().split('T')[0]; }
function formatTime(date) { return date.toTimeString().split(' ')[0].substring(0, 5); }

// Ignora mayúsculas, minúsculas, tildes y recorta espacios dobles
function normalizeText(text) {
    if (!text) return "";
    return text.toString()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[ch]));
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
}

function safeCsvValue(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values) {
    return values.map(safeCsvValue).join(',') + '\n';
}

function getField(material, ...keys) {
    for (const key of keys) {
        if (material && material[key] !== undefined && material[key] !== null && material[key] !== '') return material[key];
    }
    return '';
}

function splitKeywords(value) {
    return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function normalizeMaterial(material) {
    const normalized = { ...material };
    normalized.codigo = String(getField(material, 'codigo', 'code')).trim();
    normalized.codigoAlternativo = String(getField(material, 'codigoAlternativo', 'alternateCode')).trim();
    normalized.codigoBarra = String(getField(material, 'codigoBarra', 'barcode', 'ean')).trim();
    normalized.nombre = String(getField(material, 'nombre', 'name')).trim();
    normalized.descripcion = String(getField(material, 'descripcion', 'description')).trim();
    normalized.categoria = String(getField(material, 'categoria', 'category')).trim();
    normalized.marca = String(getField(material, 'marca', 'brand')).trim();
    normalized.modelo = String(getField(material, 'modelo', 'model')).trim();
    normalized.unidadMedida = String(getField(material, 'unidadMedida', 'unidad', 'unit') || 'UN').trim();
    normalized.ubicacion = String(getField(material, 'ubicacion', 'location')).trim();
    normalized.equipoAsociado = String(getField(material, 'equipoAsociado', 'equipo')).trim();
    normalized.aliasBusqueda = String(getField(material, 'aliasBusqueda', 'alias', 'sinonimos')).trim();
    normalized.fotoPrincipal = String(getField(material, 'fotoPrincipal', 'foto', 'imagen', 'urlFoto')).trim();
    normalized.foto = normalized.fotoPrincipal;
    normalized.fotosAdicionales = Array.isArray(material.fotosAdicionales)
        ? material.fotosAdicionales
        : splitKeywords(getField(material, 'fotosAdicionales', 'fotos', 'imagenes'));
    normalized.stockMinimo = getField(material, 'stockMinimo') === '' ? '' : Number(getField(material, 'stockMinimo'));
    normalized.fechaCostoPromedio = String(getField(material, 'fechaCostoPromedio', 'fechaCosto')).trim();
    normalized.origenCosto = String(getField(material, 'origenCosto') || 'Manual').trim();
    normalized.esCritico = material.esCritico === true || String(material.esCritico).toLowerCase() === 'true' || String(material.esCritico).toLowerCase() === 'si';
    normalized.estadoRevision = String(getField(material, 'estadoRevision') || 'Pendiente').trim();
    normalized.validado = material.validado === true || String(material.validado).toLowerCase() === 'true' || String(material.validado).toLowerCase() === 'si';
    normalized.ultimaModificacion = normalized.ultimaModificacion || new Date().toISOString();
    normalized.calidadDato = calculateDataQuality(normalized);
    return normalized;
}

function calculateDataQuality(material) {
    const checks = [
        material.codigo,
        material.nombre,
        material.descripcion,
        material.categoria,
        material.ubicacion,
        material.stock !== '' && material.stock !== null && material.stock !== undefined,
        material.costoPromedio !== '' && material.costoPromedio !== null && material.costoPromedio !== undefined,
        material.fechaCostoPromedio,
        material.validado,
        material.aliasBusqueda
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getStockInfo(material) {
    if (material.stock === '' || material.stock === null || material.stock === undefined) {
        return { label: 'Stock no informado', className: 'badge-neutral' };
    }
    const stock = Number(material.stock);
    const min = material.stockMinimo === '' || material.stockMinimo === null || material.stockMinimo === undefined ? null : Number(material.stockMinimo);
    if (stock === 0) return { label: material.esCritico ? 'Critico sin stock' : 'Sin stock', className: 'badge-danger' };
    if (min !== null && !Number.isNaN(min) && stock <= min) return { label: `Stock bajo: ${stock}`, className: 'badge-warning' };
    return { label: `Disponible: ${stock}`, className: 'badge-success' };
}

function isCostOutdated(material) {
    if (!material.fechaCostoPromedio) return false;
    const days = Number(StorageAdapter.getSettings().costoVigenciaDias || 90);
    const costDate = new Date(material.fechaCostoPromedio);
    if (Number.isNaN(costDate.getTime())) return false;
    return ((Date.now() - costDate.getTime()) / 86400000) > days;
}

function getDictionaryTerms(query) {
    const normalized = normalizeText(query);
    const terms = new Set([normalized]);
    StorageAdapter.getDictionary().forEach(entry => {
        const word = normalizeText(entry.palabra);
        const equivalent = normalizeText(entry.equivalente);
        if (!word || !equivalent) return;
        if (normalized.includes(word)) terms.add(equivalent);
        if (normalized.includes(equivalent)) terms.add(word);
    });
    return Array.from(terms).filter(Boolean);
}

function getCategorySuggestion(value) {
    const text = normalizeText(value);
    if (!text) return null;
    const activeCategories = StorageAdapter.getCategories().filter(c => c.activa !== false);
    let best = null;
    activeCategories.forEach(cat => {
        const name = normalizeText(cat.nombre);
        if (!name) return;
        const dist = levenshteinDistance(text, name);
        if (name.includes(text) || text.includes(name) || dist <= 2) {
            if (!best || dist < best.dist) best = { nombre: cat.nombre, dist };
        }
    });
    return best?.nombre || null;
}

function sanitizePhotoCode(code) {
    return String(code || '')
        .trim()
        .replace(/[\\\/\s]+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function getPhotoCandidates(material) {
    const item = normalizeMaterial(material);
    const manual = [item.fotoPrincipal, item.foto].filter(Boolean);
    const additional = Array.isArray(item.fotosAdicionales)
        ? item.fotosAdicionales
        : splitKeywords(item.fotosAdicionales);
    const codes = Array.from(new Set([item.codigo, sanitizePhotoCode(item.codigo)].filter(Boolean)));
    const generated = [];
    codes.forEach(code => {
        ['webp', 'jpg', 'png'].forEach(ext => generated.push(`assets/fotos/${code}.${ext}`));
    });
    return Array.from(new Set([...manual, ...additional, ...generated].filter(Boolean)));
}

function getPhotoState(material) {
    const item = normalizeMaterial(material);
    if (item.fotoPrincipal || item.foto) return 'Con foto';
    if ((Array.isArray(item.fotosAdicionales) && item.fotosAdicionales.length > 0) || (!Array.isArray(item.fotosAdicionales) && item.fotosAdicionales)) return 'Foto pendiente';
    return 'Sin foto';
}

function renderPhotoHtml(material, className = 'material-photo', alt = 'Foto material') {
    const candidates = getPhotoCandidates(material);
    const safeAlt = escapeAttr(alt);
    if (!candidates.length) {
        return `<div class="${className} photo-placeholder" role="img" aria-label="Sin foto"><span>Sin foto</span></div>`;
    }
    return `<img class="${className}" src="${escapeAttr(candidates[0])}" data-photo-candidates="${escapeAttr(JSON.stringify(candidates))}" data-photo-index="0" alt="${safeAlt}" onerror="handlePhotoError(this)">`;
}

function handlePhotoError(img) {
    try {
        const candidates = JSON.parse(img.dataset.photoCandidates || '[]');
        const nextIndex = Number(img.dataset.photoIndex || 0) + 1;
        if (candidates[nextIndex]) {
            img.dataset.photoIndex = String(nextIndex);
            img.src = candidates[nextIndex];
            return;
        }
    } catch {
        // Silencioso: foto ausente no es error funcional.
    }
    const placeholder = document.createElement('div');
    placeholder.className = `${img.className} photo-placeholder`;
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', 'Sin foto');
    placeholder.innerHTML = '<span>Sin foto</span>';
    img.replaceWith(placeholder);
}

function getLocalStorageUsageBytes() {
    return Object.values(STORAGE_KEYS).reduce((sum, key) => sum + ((localStorage.getItem(key) || '').length * 2), 0);
}

function warnIfPhotoStorageHigh() {
    const mb = getLocalStorageUsageBytes() / (1024 * 1024);
    if (mb > 3) {
        alert('Muchas fotos pueden llenar el almacenamiento local. Exporte respaldo o use servidor interno.');
    }
}

function compressImageFile(file, maxSide = 1280) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Selecciona una imagen valida.'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
            img.onload = () => {
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const finish = (blob, mime) => {
                    if (!blob) return reject(new Error('El navegador no pudo comprimir la imagen.'));
                    const outReader = new FileReader();
                    outReader.onload = () => resolve({
                        dataUrl: outReader.result,
                        mime,
                        originalBytes: file.size,
                        compressedBytes: blob.size,
                        width,
                        height
                    });
                    outReader.onerror = () => reject(new Error('No se pudo preparar la imagen comprimida.'));
                    outReader.readAsDataURL(blob);
                };

                canvas.toBlob((webpBlob) => {
                    if (webpBlob && webpBlob.type === 'image/webp') finish(webpBlob, 'image/webp');
                    else canvas.toBlob((jpegBlob) => finish(jpegBlob, 'image/jpeg'), 'image/jpeg', 0.75);
                }, 'image/webp', 0.75);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handlePhotoFileSelection(file, onAccepted) {
    try {
        const compressed = await compressImageFile(file);
        const originalKb = Math.round(compressed.originalBytes / 1024);
        const compressedKb = Math.round(compressed.compressedBytes / 1024);
        const warning = compressed.originalBytes > 4 * 1024 * 1024 || compressed.compressedBytes > 900 * 1024
            ? '\n\nAdvertencia: la imagen sigue siendo pesada para localStorage. Esto es solo para prototipo local.'
            : '';
        const ok = confirm(`Imagen preparada.\nOriginal: ${originalKb} KB\nComprimida: ${compressedKb} KB\nFormato: ${compressed.mime}\n\nGuardar esta imagen comprimida en el prototipo local?${warning}`);
        if (!ok) return null;
        onAccepted(compressed);
        warnIfPhotoStorageHigh();
        return compressed;
    } catch (err) {
        alert(`${err.message}\nSi la camara no esta disponible, selecciona un archivo manualmente.`);
        return null;
    }
}

function copyText(text) {
    const value = String(text || '');
    if (!value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => showToast(`Codigo copiado: ${value}`)).catch(() => fallbackCopyText(value));
    } else {
        fallbackCopyText(value);
    }
}

function fallbackCopyText(text) {
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try { document.execCommand('copy'); showToast(`Codigo copiado: ${text}`); }
    catch { alert(`Codigo: ${text}`); }
    temp.remove();
}

function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'app-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('active');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('active'), 2200);
}

/**
 * Distancia de Levenshtein simple para similitud (fuzzy search local)
 * Retorna la distancia (0 = idénticos, mayor = más diferentes)
 */
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // Sustitución
                    matrix[i][j - 1] + 1,     // Inserción
                    matrix[i - 1][j] + 1      // Borrado
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function checkEmptyDBWarning() {
    const materials = StorageAdapter.getMaterials();
    const warning = document.getElementById('empty-db-warning');
    if(materials.length === 0) {
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
}

// ============================================================================
// LÓGICA DE BÚSQUEDA PÚBLICA (Google Interno)
// ============================================================================

function getSearchableText(material) {
    const m = normalizeMaterial(material);
    return [
        m.codigo,
        m.codigoAlternativo,
        m.codigoBarra,
        m.nombre,
        m.descripcion,
        m.categoria,
        m.marca,
        m.modelo,
        m.ubicacion,
        m.equipoAsociado,
        m.aliasBusqueda,
        splitKeywords(m.aliasBusqueda).join(' ')
    ].map(normalizeText).join(' ');
}

function scoreMaterial(material, rawQuery) {
    const item = normalizeMaterial(material);
    const queryTerms = getDictionaryTerms(rawQuery);
    const queryNorm = normalizeText(rawQuery);
    const queryWords = queryNorm.split(/\s+/).filter(Boolean);
    let score = 0;
    let matchType = null;
    let matchedWords = 0;

    const code = normalizeText(item.codigo);
    const alt = normalizeText(item.codigoAlternativo);
    const barcode = normalizeText(item.codigoBarra);
    const name = normalizeText(item.nombre);
    const aliases = splitKeywords(item.aliasBusqueda).map(normalizeText);
    const searchable = getSearchableText(item);

    queryTerms.forEach(term => {
        if (!term) return;
        if (code === term) { score = Math.max(score, 1000); matchType = 'exact'; }
        if (alt === term || barcode === term) { score = Math.max(score, 940); matchType = 'exact'; }
        if (code.startsWith(term) || alt.startsWith(term) || barcode.startsWith(term)) { score = Math.max(score, 820); matchType = matchType || 'partial'; }
        if (code.includes(term) || alt.includes(term) || barcode.includes(term)) { score = Math.max(score, 740); matchType = matchType || 'partial'; }
        if (name.includes(term)) { score = Math.max(score, 640); matchType = matchType || 'partial'; }
        if (aliases.some(a => a === term || a.includes(term) || term.includes(a))) { score = Math.max(score, 620); matchType = matchType || 'partial'; }
        if (searchable.includes(term)) { score = Math.max(score, 520); matchType = matchType || 'partial'; }
    });

    queryWords.forEach(word => {
        if (searchable.includes(word)) matchedWords++;
    });
    if (queryWords.length && matchedWords === queryWords.length) {
        score = Math.max(score, 500 + matchedWords * 12);
        matchType = matchType || 'partial';
    } else if (matchedWords > 0) {
        score = Math.max(score, matchedWords * 80);
        matchType = matchType || 'partial';
    }

    if (score < 500 && queryNorm.length > 4) {
        const tokens = [name, item.descripcion, item.categoria, item.marca, item.modelo, item.aliasBusqueda]
            .map(normalizeText)
            .join(' ')
            .split(/\s+/)
            .filter(t => t.length > 4);
        for (const token of tokens) {
            const dist = levenshteinDistance(queryNorm, token);
            if (dist <= 2) {
                score = Math.max(score, 210 - dist * 20);
                matchType = matchType || 'possible';
                break;
            }
        }
    }

    const popularity = Number(item.cantidadConsultas || 0);
    if (score > 0 && popularity > 0) score += Math.min(popularity, 20);
    if (score > 0 && !matchType) matchType = 'partial';
    return { item, score, matchType, matchedWords };
}

function rankMaterials(rawQuery, minScore = 50) {
    return StorageAdapter.getMaterials()
        .map(m => scoreMaterial(m, rawQuery))
        .filter(r => r.score >= minScore || r.matchType === 'possible')
        .sort((a, b) => b.score - a.score);
}

function renderSearchSuggestions() {
    const input = document.getElementById('search-query');
    const box = document.getElementById('search-suggestions');
    const rawQuery = input.value.trim();
    if (!rawQuery || rawQuery.length < 2) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }

    const suggestions = rankMaterials(rawQuery, 80).slice(0, 6);
    if (suggestions.length === 0) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }

    box.innerHTML = suggestions.map(r => {
        const item = r.item;
        return `
            <button type="button" class="suggestion-item" data-query="${escapeAttr(item.codigo)}">
                <span class="suggestion-code">${escapeHtml(item.codigo)}</span>
                <span class="suggestion-name">${escapeHtml(item.nombre || 'Sin nombre')}</span>
                <span class="suggestion-meta">${escapeHtml(item.ubicacion || item.categoria || '')}</span>
            </button>
        `;
    }).join('');
    box.classList.remove('hidden');
}

function markPendingState(term, state, note = '') {
    const key = normalizeText(term);
    if (!key) return;
    const states = StorageAdapter.getPendingStates();
    states[key] = {
        estado: state,
        nota: note,
        fecha: formatDate(new Date()),
        hora: formatTime(new Date())
    };
    StorageAdapter.savePendingStates(states);
}

function getPendingState(term) {
    return StorageAdapter.getPendingStates()[normalizeText(term)] || { estado: 'Pendiente' };
}

// Debounce en vivo
document.getElementById('search-query').addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(renderSearchSuggestions, 250);
});

// Forzar búsqueda en Enter o Botón
document.getElementById('btn-search').addEventListener('click', () => {
    clearTimeout(searchDebounceTimer);
    performSearch();
});
document.getElementById('search-query').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        performSearch();
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-query') && !e.target.closest('#search-suggestions')) {
        document.getElementById('search-suggestions')?.classList.add('hidden');
    }
});

function performSearch() {
    const userRut = document.getElementById('search-user').value.trim();
    const rawQuery = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results-container');
    const noResultsContainer = document.getElementById('no-results-container');
    document.getElementById('search-suggestions')?.classList.add('hidden');

    if (!rawQuery) {
        resultsContainer.classList.add('hidden');
        noResultsContainer.classList.add('hidden');
        return;
    }

    const MAX_RESULTS_LOCAL = 50;
    const rankedResults = rankMaterials(rawQuery, 50);
    const isTruncatedLocal = rankedResults.length > MAX_RESULTS_LOCAL;
    const finalResultsLocal = rankedResults.slice(0, MAX_RESULTS_LOCAL);
    renderSearchResults(finalResultsLocal, isTruncatedLocal, rawQuery);

    const nowTimeLocal = Date.now();
    if (lastSearchLog.rut === userRut && lastSearchLog.query === rawQuery && (nowTimeLocal - lastSearchLog.time < 3000)) {
        return;
    }

    lastSearchLog = { rut: userRut, query: rawQuery, time: nowTimeLocal };
    const searchLogsLocal = StorageAdapter.getSearchLogs();
    const nowLocal = new Date();

    if (finalResultsLocal.length > 0) {
        const first = finalResultsLocal[0].item;
        searchLogsLocal.push({
            personaConsulta: userRut || 'Anonimo',
            terminoBuscado: rawQuery,
            fecha: formatDate(nowLocal),
            hora: formatTime(nowLocal),
            resultadoEncontrado: true,
            codigoResultado: first.codigo,
            nombreResultado: first.nombre
        });

        const materialsLocal = StorageAdapter.getMaterials();
        const idx = materialsLocal.findIndex(m => String(m.codigo) === String(first.codigo));
        if (idx >= 0) {
            materialsLocal[idx] = normalizeMaterial({
                ...materialsLocal[idx],
                cantidadConsultas: Number(materialsLocal[idx].cantidadConsultas || 0) + 1
            });
            StorageAdapter.saveMaterials(materialsLocal);
        }
    } else {
        searchLogsLocal.push({
            personaConsulta: userRut || 'Anonimo',
            terminoBuscado: rawQuery,
            fecha: formatDate(nowLocal),
            hora: formatTime(nowLocal),
            resultadoEncontrado: false,
            codigoResultado: null,
            nombreResultado: null
        });
    }

    StorageAdapter.saveSearchLogs(searchLogsLocal);
    return;
    
    const container = document.getElementById('search-results-container');
    const grid = document.getElementById('search-results');

    if (!rawQuery) {
        container.classList.add('hidden');
        return;
    }

    const queryNorm = normalizeText(rawQuery);
    const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 0);
    const materials = StorageAdapter.getMaterials();
    
    // Algoritmo Inteligente de Ranking y Similitud
    let results = materials.map(m => {
        let score = 0;
        let matchType = null; // 'exact', 'partial', 'possible'
        
        const codNorm = normalizeText(m.codigo);
        const altNorm = normalizeText(m.codigoAlternativo);
        const nomNorm = normalizeText(m.nombre);
        const descNorm = normalizeText(m.descripcion);
        const catNorm = normalizeText(m.categoria);
        const marcNorm = normalizeText(m.marca);
        const modNorm = normalizeText(m.modelo);
        const ubiNorm = normalizeText(m.ubicacion);

        // 1. Código exacto
        if (codNorm === queryNorm) { score += 1000; matchType = 'exact'; }
        // 2. Código alternativo exacto
        if (altNorm === queryNorm && score < 1000) { score += 900; matchType = 'exact'; }
        // 3. Código comienza con término
        if (codNorm.startsWith(queryNorm) && score < 900) { score += 800; matchType = 'partial'; }
        // 4. Código contiene término
        if (codNorm.includes(queryNorm) && score < 800) { score += 700; matchType = 'partial'; }
        // 5. Nombre contiene término
        if (nomNorm.includes(queryNorm) && score < 700) { score += 600; matchType = 'partial'; }

        // 6. Coincidencia por palabras separadas
        let matchedWords = 0;
        queryWords.forEach(word => {
            if (codNorm.includes(word) || altNorm.includes(word) || nomNorm.includes(word) || 
                descNorm.includes(word) || catNorm.includes(word) || marcNorm.includes(word) || 
                modNorm.includes(word) || ubiNorm.includes(word)) {
                matchedWords++;
            }
        });
        
        if (matchedWords === queryWords.length && score < 600) { score += 500; matchType = 'partial'; }
        else if (matchedWords > 0) { score += (matchedWords * 10); }

        // 7. Similitud Levenshtein si no hubo match fuerte (Posible coincidencia)
        if (score < 500) {
            // Comparamos el nombre con la query. 
            // Para nombres largos, la distancia será enorme, así que solo si son parecidos.
            // Tolerancia: 3 caracteres de diferencia para palabras > 5 letras
            if (queryNorm.length > 4 && nomNorm.length > 0) {
                // Chequear por token para ser más precisos
                const nameTokens = nomNorm.split(/\s+/);
                for (let t of nameTokens) {
                    if (t.length > 4) {
                        const dist = levenshteinDistance(queryNorm, t);
                        if (dist <= 2) {
                            score += 200 - (dist * 10);
                            matchType = matchType || 'possible';
                            break;
                        }
                    }
                }
            }
        }
        
        if (score > 0 && !matchType) {
            matchType = 'partial'; // Fallback para pequeñas coincidencias
        }

        return { item: m, score: score, matchType: matchType, matchedWords: matchedWords };
    });

    // Filtrar resultados válidos (umbral mínimo)
    results = results.filter(r => r.score >= 50 || r.matchType === 'possible');
    
    // Ordenar por score descendente
    results.sort((a, b) => b.score - a.score);

    // Limitamos a los primeros 50 para fluidez y rendimiento
    const MAX_RESULTS = 50;
    const isTruncated = results.length > MAX_RESULTS;
    const finalResults = results.slice(0, MAX_RESULTS);

    renderSearchResults(finalResults, isTruncated);
    
    // =======================================
    // Registro de Historial (Anti-Spam 3 seg)
    // =======================================
    const nowTime = Date.now();
    if (lastSearchLog.rut === userRut && lastSearchLog.query === rawQuery && (nowTime - lastSearchLog.time < 3000)) {
        return; // Ignorar duplicado
    }
    
    lastSearchLog = { rut: userRut, query: rawQuery, time: nowTime };
    const searchLogs = StorageAdapter.getSearchLogs();
    const now = new Date();
    
    if (finalResults.length > 0) {
        searchLogs.push({
            personaConsulta: userRut || 'Anónimo',
            terminoBuscado: rawQuery,
            fecha: formatDate(now),
            hora: formatTime(now),
            resultadoEncontrado: true,
            codigoResultado: finalResults[0].item.codigo,
            nombreResultado: finalResults[0].item.nombre
        });
    } else {
        searchLogs.push({
            personaConsulta: userRut || 'Anónimo',
            terminoBuscado: rawQuery,
            fecha: formatDate(now),
            hora: formatTime(now),
            resultadoEncontrado: false,
            codigoResultado: null,
            nombreResultado: null
        });
    }
    
    StorageAdapter.saveSearchLogs(searchLogs);
}

function renderSearchResults(results, isTruncated, rawQuery = '') {
    const container = document.getElementById('search-results-container');
    const grid = document.getElementById('search-results');
    const noResults = document.getElementById('no-results-container');
    grid.innerHTML = '';

    if (results.length === 0) {
        container.classList.add('hidden');
        noResults.classList.remove('hidden');
        document.getElementById('no-results-message').textContent = `No hay materiales cargados para "${rawQuery}". La busqueda quedo registrada en historial.`;
        const q = normalizeText(rawQuery);
        const suggestions = StorageAdapter.getMaterials()
            .map(m => {
                const item = normalizeMaterial(m);
                const tokens = normalizeText(item.nombre).split(/\s+/).filter(Boolean);
                const best = tokens.reduce((min, token) => Math.min(min, levenshteinDistance(q, token)), 99);
                return { item, score: best };
            })
            .filter(r => r.score <= 3)
            .sort((a, b) => a.score - b.score)
            .slice(0, 5);

        document.getElementById('levenshtein-suggestions').innerHTML = suggestions.map(r => `
            <button type="button" class="action-btn suggestion-search" data-query="${escapeAttr(r.item.codigo)}">
                ${escapeHtml(r.item.codigo)} - ${escapeHtml(r.item.nombre)}
            </button>
        `).join('');
        return;
    }

    noResults.classList.add('hidden');
    container.classList.remove('hidden');

    results.forEach(r => {
        const item = normalizeMaterial(r.item);
        const stockInfo = getStockInfo(item);
        const stockBadge = `<span class="badge ${stockInfo.className}">${escapeHtml(stockInfo.label)} ${item.unidadMedida ? escapeHtml(item.unidadMedida) : ''}</span>`;

        let matchBadge = '';
        if (r.matchType === 'exact') matchBadge = `<span class="badge badge-primary" style="font-size:0.7rem;">Coincidencia exacta</span>`;
        else if (r.matchType === 'partial') matchBadge = `<span class="badge badge-secondary" style="font-size:0.7rem; background:#E2E8F0; color:#334155;">Coincidencia parcial</span>`;
        else if (r.matchType === 'possible') matchBadge = `<span class="badge badge-warning" style="font-size:0.7rem; background:#FEF3C7; color:#B45309;">Posible coincidencia</span>`;

        const costBadge = isCostOutdated(item) ? `<span class="badge badge-warning">Costo antiguo</span>` : '';
        const qualityBadge = `<span class="badge ${item.calidadDato >= 75 ? 'badge-success' : item.calidadDato >= 45 ? 'badge-warning' : 'badge-danger'}">Dato ${item.calidadDato}%</span>`;
        const photoState = getPhotoState(item);
        const photoBadge = `<span class="badge ${photoState === 'Con foto' ? 'badge-success' : 'badge-neutral'}">${escapeHtml(photoState)}</span>`;
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            ${renderPhotoHtml(item, 'result-photo', item.nombre)}
            <div class="card-header">
                <div>
                    <span class="card-code" style="display:inline-block; margin-bottom: 0.2rem;">${escapeHtml(item.codigo)}</span><br>
                    <div class="badge-row">${matchBadge}${item.esCritico ? '<span class="badge badge-danger">Critico</span>' : ''}${qualityBadge}${costBadge}${photoBadge}</div>
                </div>
                ${stockBadge}
            </div>
            <div class="card-title">${escapeHtml(item.nombre || 'Sin nombre')}</div>
            <div class="card-desc">${escapeHtml(item.descripcion || 'Sin descripcion')}</div>
            <div class="card-meta">
                <div><strong>Categoria</strong> <span>${escapeHtml(item.categoria || '-')}</span></div>
                <div><strong>Ubicacion</strong> <span>${escapeHtml(item.ubicacion || '-')}</span></div>
                <div><strong>Equipo</strong> <span>${escapeHtml(item.equipoAsociado || '-')}</span></div>
                <div><strong>Costo</strong> <span>${item.costoPromedio !== '' && item.costoPromedio !== null ? escapeHtml(formatCurrency(item.costoPromedio)) : '-'}</span></div>
            </div>
            <div class="card-actions">
                <button class="btn-secondary btn-copy-code" data-codigo="${escapeAttr(item.codigo)}">Copiar codigo</button>
                <button class="btn-secondary btn-detail" data-codigo="${escapeAttr(item.codigo)}">Ver detalle</button>
            </div>
        `;
        grid.appendChild(card);
    });

    if (isTruncated) {
        const trunMsg = document.createElement('div');
        trunMsg.className = 'full-width text-center text-muted';
        trunMsg.style.padding = '1.5rem';
        trunMsg.innerHTML = '<em>Hay mas resultados. Por favor refine su busqueda para ser mas especifico.</em>';
        grid.appendChild(trunMsg);
    }
    return;
    
    grid.innerHTML = '';
    container.classList.remove('hidden');

    if (results.length === 0) {
        grid.innerHTML = '<p class="text-center full-width text-muted" style="padding: 2rem;">No se encontraron resultados para esta búsqueda.</p>';
        return;
    }

    results.forEach(r => {
        const item = r.item;
        
        let stockBadge = '';
        if (item.stock > 10) stockBadge = `<span class="badge badge-success">Stock: ${item.stock} ${item.unidadMedida || 'UN'}</span>`;
        else if (item.stock > 0) stockBadge = `<span class="badge badge-warning">Stock: ${item.stock} ${item.unidadMedida || 'UN'}</span>`;
        else if (item.stock === 0) stockBadge = `<span class="badge badge-danger">Sin Stock</span>`;
        else stockBadge = `<span class="badge badge-neutral">S/I</span>`;

        let matchBadge = '';
        if (r.matchType === 'exact') matchBadge = `<span class="badge badge-primary" style="font-size:0.7rem;">Coincidencia exacta</span>`;
        else if (r.matchType === 'partial') matchBadge = `<span class="badge badge-secondary" style="font-size:0.7rem; background:#E2E8F0; color:#334155;">Coincidencia parcial</span>`;
        else if (r.matchType === 'possible') matchBadge = `<span class="badge badge-warning" style="font-size:0.7rem; background:#FEF3C7; color:#B45309;">Posible coincidencia</span>`;

        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <span class="card-code" style="display:inline-block; margin-bottom: 0.2rem;">${item.codigo}</span><br>
                    ${matchBadge}
                </div>
                ${stockBadge}
            </div>
            <div class="card-title">${item.nombre}</div>
            <div class="card-desc">${item.descripcion || 'Sin descripción'}</div>
            <div class="card-meta">
                <div><strong>Categoría</strong> <span>${item.categoria || '-'}</span></div>
                <div><strong>Ubicación</strong> <span>${item.ubicacion || '-'}</span></div>
            </div>
            <button class="btn-secondary btn-detail" data-codigo="${item.codigo}" style="width:100%;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                Ver detalle
            </button>
        `;
        grid.appendChild(card);
    });

    if (isTruncated) {
        const trunMsg = document.createElement('div');
        trunMsg.className = 'full-width text-center text-muted';
        trunMsg.style.padding = '1.5rem';
        trunMsg.innerHTML = '<em>Hay más resultados. Por favor refine su búsqueda para ser más específico.</em>';
        grid.appendChild(trunMsg);
    }
}

// Event Delegation para Resultados Públicos
document.getElementById('search-results').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-detail');
    const copyBtn = e.target.closest('.btn-copy-code');
    if (btn) {
        const codigo = btn.getAttribute('data-codigo');
        openDetailModal(codigo);
    } else if (copyBtn) {
        copyText(copyBtn.getAttribute('data-codigo'));
    }
});

document.getElementById('search-suggestions').addEventListener('click', (e) => {
    const btn = e.target.closest('.suggestion-item');
    if (!btn) return;
    document.getElementById('search-query').value = btn.getAttribute('data-query');
    document.getElementById('search-suggestions').classList.add('hidden');
    performSearch();
});

document.getElementById('levenshtein-suggestions').addEventListener('click', (e) => {
    const btn = e.target.closest('.suggestion-search');
    if (!btn) return;
    document.getElementById('search-query').value = btn.getAttribute('data-query');
    performSearch();
});

document.getElementById('btn-request-alta').addEventListener('click', () => {
    const term = document.getElementById('search-query').value.trim();
    openTicketModal({ type: 'Alta material', term });
});

// ============================================================================
// LÓGICA DE DETALLE DE MATERIAL
// ============================================================================
function openDetailModal(codigo) {
    const materials = StorageAdapter.getMaterials();
    const item = materials.find(m => m.codigo === codigo);
    if (!item) return;
    const detail = normalizeMaterial(item);
    const stockInfo = getStockInfo(detail);
    const costOld = isCostOutdated(detail);

    const changeLogs = StorageAdapter.getChangeLogs();
    const lastChange = changeLogs.slice().reverse().find(l => l.codigo === codigo);
    const modDateText = lastChange ? `${lastChange.fecha} ${lastChange.hora}` : 'Nunca (Original)';

    const content = document.getElementById('detail-content');
    content.innerHTML = `
        ${renderPhotoHtml(detail, 'detail-img', detail.nombre)}
        <div class="detail-item"><div class="detail-label">Codigo</div><div class="detail-value">${escapeHtml(detail.codigo)}</div></div>
        <div class="detail-item"><div class="detail-label">Codigo de barra</div><div class="detail-value">${escapeHtml(detail.codigoBarra || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Codigo alternativo</div><div class="detail-value">${escapeHtml(detail.codigoAlternativo || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Estado dato</div><div class="detail-value">${escapeHtml(detail.estadoRevision || '-')} / ${detail.calidadDato}%</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Nombre</div><div class="detail-value">${escapeHtml(detail.nombre)}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Descripcion</div><div class="detail-value">${escapeHtml(detail.descripcion || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Categoria</div><div class="detail-value">${escapeHtml(detail.categoria || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Marca / Modelo</div><div class="detail-value">${escapeHtml([detail.marca, detail.modelo].filter(Boolean).join(' / ') || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Stock</div><div class="detail-value"><span class="badge ${stockInfo.className}">${escapeHtml(stockInfo.label)}</span></div></div>
        <div class="detail-item"><div class="detail-label">Stock minimo</div><div class="detail-value">${detail.stockMinimo !== '' && detail.stockMinimo !== null ? escapeHtml(detail.stockMinimo) : '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Costo promedio</div><div class="detail-value">${detail.costoPromedio !== '' && detail.costoPromedio !== null ? escapeHtml(formatCurrency(detail.costoPromedio)) + ' ' + escapeHtml(detail.moneda || 'CLP') : '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Fecha costo</div><div class="detail-value">${escapeHtml(detail.fechaCostoPromedio || '-')}${costOld ? ' <span class="badge badge-warning">antiguo</span>' : ''}</div></div>
        <div class="detail-item"><div class="detail-label">Ubicacion</div><div class="detail-value">${escapeHtml(detail.ubicacion || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Equipo asociado</div><div class="detail-value">${escapeHtml(detail.equipoAsociado || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Estado</div><div class="detail-value">${escapeHtml(detail.estado || '-')}</div></div>
        <div class="detail-item"><div class="detail-label">Validado</div><div class="detail-value">${detail.validado ? 'Si' : 'No'}${detail.esCritico ? ' <span class="badge badge-danger">Critico</span>' : ''}</div></div>
        <div class="detail-item"><div class="detail-label">Ultima modificacion</div><div class="detail-value">${escapeHtml(modDateText)}</div></div>
        <div class="detail-item"><div class="detail-label">Origen costo</div><div class="detail-value">${escapeHtml(detail.origenCosto || '-')}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Alias de busqueda</div><div class="detail-value">${escapeHtml(detail.aliasBusqueda || '-')}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Observaciones</div><div class="detail-value">${escapeHtml(detail.observaciones || '-')}</div></div>
        <div class="detail-item detail-full">
            <div class="detail-actions">
                <button class="btn-secondary" type="button" onclick="copyText('${escapeAttr(detail.codigo)}')">Copiar codigo</button>
                <button class="btn-secondary" type="button" onclick="openTicketModal({ type: 'Reporte error', code: '${escapeAttr(detail.codigo)}', name: '${escapeAttr(detail.nombre)}' })">Reportar error</button>
                ${isAdmin ? `<button class="btn-secondary" type="button" onclick="changePhotoFromDetail('${escapeAttr(detail.codigo)}')">Cambiar foto</button>` : ''}
            </div>
        </div>
    `;

    document.getElementById('detail-modal').classList.remove('hidden');
    setTimeout(() => { document.getElementById('detail-modal').classList.add('active'); }, 10);
    return;
    content.innerHTML = `
        ${item.foto ? `<img src="${item.foto}" class="detail-img" alt="${item.nombre}">` : ''}
        <div class="detail-item"><div class="detail-label">Código</div><div class="detail-value">${item.codigo}</div></div>
        <div class="detail-item"><div class="detail-label">Código Alternativo</div><div class="detail-value">${item.codigoAlternativo || '-'}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Nombre</div><div class="detail-value">${item.nombre}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Descripción</div><div class="detail-value">${item.descripcion || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Categoría</div><div class="detail-value">${item.categoria || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Marca</div><div class="detail-value">${item.marca || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Modelo</div><div class="detail-value">${item.modelo || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Stock</div><div class="detail-value">${item.stock !== "" && item.stock !== null ? item.stock + ' ' + (item.unidadMedida||'UN') : '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Costo Promedio</div><div class="detail-value">${item.costoPromedio !== "" && item.costoPromedio !== null ? formatCurrency(item.costoPromedio) + ' ' + (item.moneda || 'CLP') : '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Ubicación</div><div class="detail-value">${item.ubicacion || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Estado</div><div class="detail-value">${item.estado || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Validado</div><div class="detail-value">${item.validado ? 'Sí' : 'No'}</div></div>
        <div class="detail-item"><div class="detail-label">Última Modificación</div><div class="detail-value">${modDateText}</div></div>
        <div class="detail-item detail-full"><div class="detail-label">Observaciones</div><div class="detail-value">${item.observaciones || '-'}</div></div>
    `;

    document.getElementById('detail-modal').classList.remove('hidden');
    setTimeout(() => { document.getElementById('detail-modal').classList.add('active'); }, 10);
}

document.getElementById('close-detail-modal').addEventListener('click', () => {
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('active');
    setTimeout(() => { modal.classList.add('hidden'); }, 250);
});

function changePhotoFromDetail(codigo) {
    if (!isAdmin) return;
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('active');
    setTimeout(() => { modal.classList.add('hidden'); }, 250);
    editMaterial(codigo);
    setTimeout(() => document.getElementById('mat-foto-file')?.focus(), 50);
}

// ============================================================================
// LÓGICA DE MODALES ADMIN Y NAVEGACIÓN
// ============================================================================
const loginModal = document.getElementById('login-modal');

document.getElementById('btn-open-admin-login').addEventListener('click', () => {
    loginModal.classList.remove('hidden');
    setTimeout(() => { loginModal.classList.add('active'); }, 10);
});

document.getElementById('close-login-modal').addEventListener('click', () => {
    loginModal.classList.remove('active');
    setTimeout(() => { 
        loginModal.classList.add('hidden'); 
        document.getElementById('login-error').classList.add('hidden');
    }, 250);
});

document.getElementById('btn-login').addEventListener('click', () => {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;

    if (user === 'admin' && pass === 'admin') {
        isAdmin = true;
        loginModal.classList.remove('active');
        setTimeout(() => { loginModal.classList.add('hidden'); }, 250);
        
        document.getElementById('public-view').classList.add('hidden');
        document.getElementById('admin-view').classList.remove('hidden');
        
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
        document.getElementById('login-error').classList.add('hidden');

        refreshAdminViews();
    } else {
        document.getElementById('login-error').classList.remove('hidden');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    isAdmin = false;
    document.getElementById('admin-view').classList.add('hidden');
    document.getElementById('public-view').classList.remove('hidden');
    checkEmptyDBWarning();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');

        if(targetId === 'admin-add-material' && !currentMaterialEditing) {
            resetMaterialForm();
        }
    });
});

function switchTab(tabId) { document.querySelector(`.tab-btn[data-target="${tabId}"]`).click(); }

function refreshAdminViews() {
    renderAdminMaterials();
    renderAdminHistory();
    calculatePendings();
    renderMasterHistory();
    renderDictionary();
    renderCategories();
    renderTickets();
    renderReports();
    renderDiagnostics();
    updateCategoriesDatalist();
    renderInventoryCard();
}

// ============================================================================
// GESTIÓN DE MATERIALES (ADMIN)
// ============================================================================
function renderAdminMaterials() {
    const materials = StorageAdapter.getMaterials();
    const tbody = document.querySelector('#materials-table tbody');
    const filterText = normalizeText(document.getElementById('admin-search-materials').value);
    
    tbody.innerHTML = '';
    
    // Optimización: Si hay filtro mostrar los que machan, sino solo mostrar los primeros 200 para evitar trabar el DOM si hay 50,000 registros
    const MAX_ADMIN_ROWS = 200; 
    let count = 0;

    for (let item of materials) {
        if (filterText) {
            if (!(normalizeText(item.codigo).includes(filterText) || normalizeText(item.nombre).includes(filterText))) {
                continue;
            }
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.codigo}</strong></td>
            <td>${item.nombre}</td>
            <td><span class="badge badge-neutral">${item.categoria || '-'}</span></td>
            <td>${item.stock !== "" && item.stock !== null ? item.stock : '-'}</td>
            <td>${item.ubicacion || '-'}</td>
            <td>${item.estado || 'Activo'}</td>
            <td><button class="action-btn btn-edit" data-codigo="${item.codigo}">Editar</button></td>
        `;
        tbody.appendChild(tr);
        count++;

        if (count >= MAX_ADMIN_ROWS && !filterText) {
            const trMsg = document.createElement('tr');
            trMsg.innerHTML = `<td colspan="7" class="text-center text-muted">Mostrando 200 registros. Use el filtro para buscar específicos.</td>`;
            tbody.appendChild(trMsg);
            break; 
        }
    }
}

// ============================================================================
// MODO INVENTARIO OPCIONAL (ADMIN / TABLET)
// ============================================================================
function findInventoryMaterial(query) {
    const ranked = rankMaterials(query, 50);
    return ranked[0]?.item || null;
}

function renderInventoryCard() {
    const empty = document.getElementById('inventory-empty');
    const card = document.getElementById('inventory-card');
    if (!empty || !card) return;
    const material = StorageAdapter.getMaterials().map(normalizeMaterial).find(m => m.codigo === currentInventoryCode);
    if (!material) {
        empty.classList.remove('hidden');
        card.classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');
    card.classList.remove('hidden');
    document.getElementById('inventory-photo-panel').innerHTML = renderPhotoHtml(material, 'inventory-photo', material.nombre);
    document.getElementById('inventory-status-photo').textContent = getPhotoState(material);
    document.getElementById('inventory-name').textContent = material.nombre || 'Sin nombre';
    document.getElementById('inventory-code').textContent = material.codigo;
    document.getElementById('inventory-location').value = material.ubicacion || '';
    document.getElementById('inventory-stock').value = material.stock !== '' && material.stock !== null ? material.stock : '';
    document.getElementById('inventory-cost').textContent = material.costoPromedio !== '' && material.costoPromedio !== null ? formatCurrency(material.costoPromedio) : '-';
    document.getElementById('inventory-state').textContent = material.estado || '-';
    document.getElementById('inventory-validated').textContent = material.validado ? 'Si' : 'No';
    document.getElementById('inventory-photo-state').textContent = getPhotoState(material);
}

function openInventoryMaterial(query) {
    const material = findInventoryMaterial(query);
    if (!material) {
        alert('No se encontro material para inventario. Puedes crearlo desde Agregar Material si corresponde.');
        return;
    }
    currentInventoryCode = material.codigo;
    inventoryPhotoDraft = null;
    renderInventoryCard();
}

function updateInventoryMaterial(mutator) {
    if (!currentInventoryCode) return alert('Busca un material primero.');
    const materials = StorageAdapter.getMaterials();
    const idx = materials.findIndex(m => String(m.codigo) === String(currentInventoryCode));
    if (idx < 0) return alert('El material seleccionado ya no existe.');
    const oldMaterial = normalizeMaterial(materials[idx]);
    const nextMaterial = normalizeMaterial(mutator({ ...oldMaterial }));
    materials[idx] = nextMaterial;
    StorageAdapter.saveMaterials(materials);
    logChanges(oldMaterial.codigo, oldMaterial, nextMaterial);
    currentInventoryCode = nextMaterial.codigo;
    renderInventoryCard();
    refreshAdminViews();
}

document.getElementById('btn-inventory-search')?.addEventListener('click', () => {
    openInventoryMaterial(document.getElementById('inventory-search').value.trim());
});

document.getElementById('inventory-search')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') openInventoryMaterial(e.target.value.trim());
});

document.getElementById('btn-inventory-confirm-location')?.addEventListener('click', () => {
    updateInventoryMaterial(m => {
        m.ubicacion = document.getElementById('inventory-location').value.trim();
        m.estadoRevision = 'En revision';
        m.ultimaModificacion = new Date().toISOString();
        return m;
    });
    showToast('Ubicacion confirmada');
});

document.getElementById('btn-inventory-validate')?.addEventListener('click', () => {
    updateInventoryMaterial(m => {
        m.validado = true;
        m.estadoRevision = 'Validado';
        m.ultimaModificacion = new Date().toISOString();
        return m;
    });
    showToast('Material marcado como validado');
});

document.getElementById('btn-inventory-save')?.addEventListener('click', () => {
    updateInventoryMaterial(m => {
        m.ubicacion = document.getElementById('inventory-location').value.trim();
        const stockValue = document.getElementById('inventory-stock').value.trim();
        m.stock = stockValue === '' ? '' : Number(stockValue);
        if (inventoryPhotoDraft) {
            m.fotoPrincipal = inventoryPhotoDraft.dataUrl;
            m.foto = inventoryPhotoDraft.dataUrl;
        }
        m.ultimaModificacion = new Date().toISOString();
        return m;
    });
    inventoryPhotoDraft = null;
    showToast('Inventario guardado');
});

document.getElementById('btn-inventory-next')?.addEventListener('click', () => {
    currentInventoryCode = null;
    inventoryPhotoDraft = null;
    document.getElementById('inventory-search').value = '';
    document.getElementById('inventory-search').focus();
    renderInventoryCard();
});

document.getElementById('btn-inventory-change-photo')?.addEventListener('click', () => {
    document.getElementById('inventory-photo-file').click();
});

document.getElementById('inventory-photo-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handlePhotoFileSelection(file, (compressed) => {
        inventoryPhotoDraft = compressed;
        document.getElementById('inventory-photo-panel').innerHTML = `<img class="inventory-photo" src="${escapeAttr(compressed.dataUrl)}" alt="Foto comprimida">`;
        document.getElementById('inventory-photo-state').textContent = 'Foto pendiente';
        document.getElementById('inventory-status-photo').textContent = `Foto pendiente (${Math.round(compressed.compressedBytes / 1024)} KB)`;
    });
    e.target.value = '';
});

document.getElementById('admin-search-materials').addEventListener('input', () => {
    // Pequeño debounce para la tabla de admin
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(renderAdminMaterials, 300);
});

// Event Delegation Materiales Admin
document.getElementById('materials-table').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-edit');
    if (btn) editMaterial(btn.getAttribute('data-codigo'));
});

// Guardar / Editar Material
document.getElementById('material-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const codigoInput = document.getElementById('mat-codigo').value.trim();
    const nombre = document.getElementById('mat-nombre').value.trim();
    
    if (!codigoInput || !nombre) {
        showFormError("Código y Nombre son obligatorios.");
        return;
    }

    // Reglas estrictas: Código como String preservando ceros. Stock numérico o nulo. No convertir vacío a cero.
    const codigo = String(codigoInput); 
    const stockStr = document.getElementById('mat-stock').value.trim();
    const costoStr = document.getElementById('mat-costo').value.trim();
    
    const stockVal = stockStr === "" ? "" : Number(stockStr);
    const costoVal = costoStr === "" ? "" : Number(costoStr);

    const newMaterial = {
        codigo: codigo,
        codigoBarra: String(document.getElementById('mat-codigo-barra').value.trim()),
        codigoAlternativo: String(document.getElementById('mat-codigo-alt').value.trim()),
        nombre: nombre,
        descripcion: document.getElementById('mat-descripcion').value.trim(),
        categoria: document.getElementById('mat-categoria').value.trim(),
        marca: document.getElementById('mat-marca').value.trim(),
        modelo: document.getElementById('mat-modelo').value.trim(),
        unidadMedida: document.getElementById('mat-unidad').value.trim() || 'UN',
        stock: stockVal,
        stockMinimo: document.getElementById('mat-stock-minimo').value.trim() === "" ? "" : Number(document.getElementById('mat-stock-minimo').value.trim()),
        costoPromedio: costoVal,
        fechaCostoPromedio: document.getElementById('mat-fecha-costo').value,
        origenCosto: document.getElementById('mat-origen-costo').value || 'Manual',
        moneda: document.getElementById('mat-moneda').value.trim() || 'CLP',
        ubicacion: document.getElementById('mat-ubicacion').value.trim(),
        estado: document.getElementById('mat-estado').value.trim() || 'Activo',
        equipoAsociado: document.getElementById('mat-equipo').value.trim(),
        aliasBusqueda: document.getElementById('mat-alias').value.trim(),
        observaciones: document.getElementById('mat-observaciones').value.trim(),
        fotoPrincipal: document.getElementById('mat-foto').value.trim(),
        foto: document.getElementById('mat-foto').value.trim(),
        fotosAdicionales: splitKeywords(document.getElementById('mat-fotos-adicionales').value),
        validado: document.getElementById('mat-validado').checked,
        esCritico: document.getElementById('mat-es-critico').checked,
        estadoRevision: document.getElementById('mat-estado-revision').value,
        ultimaModificacion: new Date().toISOString()
    };
    const materialToSave = normalizeMaterial(newMaterial);

    let materials = StorageAdapter.getMaterials();
    const oldCode = document.getElementById('mat-old-code').value;

    if (oldCode) {
        if (oldCode !== codigo && materials.some(m => m.codigo === codigo)) {
            showFormError("Ya existe otro material con el nuevo código ingresado.");
            return;
        }
        const index = materials.findIndex(m => m.codigo === oldCode);
        const oldMaterial = materials[index];
        materials[index] = materialToSave;
        logChanges(oldCode, oldMaterial, materialToSave); // Auditoría Historial
        alert("Material actualizado correctamente.");
    } else {
        if (materials.some(m => m.codigo === codigo)) {
            showFormError("El código ya existe. Por favor usa otro o edita el existente.");
            return;
        }
        materials.push(materialToSave);
        if (currentPendingTerm) markPendingState(currentPendingTerm, 'Cargado', `Creado como ${codigo}`);
        alert("Material agregado correctamente.");
    }

    StorageAdapter.saveMaterials(materials);
    resetMaterialForm();
    refreshAdminViews();
    switchTab('admin-materials');
});

function showFormError(msg) {
    const el = document.getElementById('form-error');
    el.querySelector('span').textContent = msg;
    el.classList.remove('hidden');
}

function editMaterial(codigo) {
    const materials = StorageAdapter.getMaterials();
    const item = materials.find(m => m.codigo === codigo);
    if (!item) return;

    currentMaterialEditing = codigo;
    
    document.getElementById('form-material-title').textContent = "Editar Material";
    document.getElementById('mat-old-code').value = item.codigo;
    document.getElementById('mat-codigo').value = item.codigo;
    document.getElementById('mat-codigo-barra').value = item.codigoBarra || '';
    document.getElementById('mat-codigo-alt').value = item.codigoAlternativo || '';
    document.getElementById('mat-nombre').value = item.nombre;
    document.getElementById('mat-descripcion').value = item.descripcion || '';
    document.getElementById('mat-categoria').value = item.categoria || '';
    document.getElementById('mat-marca').value = item.marca || '';
    document.getElementById('mat-modelo').value = item.modelo || '';
    document.getElementById('mat-unidad').value = item.unidadMedida || '';
    document.getElementById('mat-stock').value = item.stock !== "" && item.stock !== null ? item.stock : '';
    document.getElementById('mat-stock-minimo').value = item.stockMinimo !== "" && item.stockMinimo !== null && item.stockMinimo !== undefined ? item.stockMinimo : '';
    document.getElementById('mat-costo').value = item.costoPromedio !== "" && item.costoPromedio !== null ? item.costoPromedio : '';
    document.getElementById('mat-fecha-costo').value = item.fechaCostoPromedio || '';
    document.getElementById('mat-origen-costo').value = item.origenCosto || 'Manual';
    document.getElementById('mat-moneda').value = item.moneda || 'CLP';
    document.getElementById('mat-ubicacion').value = item.ubicacion || '';
    document.getElementById('mat-estado').value = item.estado || 'Activo';
    document.getElementById('mat-equipo').value = item.equipoAsociado || '';
    document.getElementById('mat-alias').value = item.aliasBusqueda || '';
    document.getElementById('mat-observaciones').value = item.observaciones || '';
    document.getElementById('mat-foto').value = item.fotoPrincipal || item.foto || '';
    document.getElementById('mat-fotos-adicionales').value = Array.isArray(item.fotosAdicionales) ? item.fotosAdicionales.join(', ') : (item.fotosAdicionales || '');
    document.getElementById('mat-validado').checked = item.validado || false;
    document.getElementById('mat-es-critico').checked = item.esCritico || false;
    document.getElementById('mat-estado-revision').value = item.estadoRevision || 'Pendiente';

    document.getElementById('form-error').classList.add('hidden');
    document.getElementById('btn-cancel-material').classList.remove('hidden');
    
    switchTab('admin-add-material');
}

document.getElementById('btn-cancel-material').addEventListener('click', () => {
    resetMaterialForm();
    switchTab('admin-materials');
});

function resetMaterialForm() {
    currentMaterialEditing = null;
    currentPendingTerm = null;
    document.getElementById('form-material-title').textContent = "Agregar Material";
    document.getElementById('material-form').reset();
    document.getElementById('mat-old-code').value = '';
    document.getElementById('btn-cancel-material').classList.add('hidden');
    document.getElementById('form-error').classList.add('hidden');
}

function logChanges(codigo, oldMat, newMat) {
    const changeLogs = StorageAdapter.getChangeLogs();
    const now = new Date();
    Object.keys(newMat).forEach(key => {
        if (oldMat[key] !== newMat[key]) {
            changeLogs.push({
                fecha: formatDate(now),
                hora: formatTime(now),
                usuario: 'admin',
                codigo: codigo,
                campoModificado: key,
                valorAnterior: oldMat[key] !== undefined ? oldMat[key] : '',
                valorNuevo: newMat[key] !== undefined ? newMat[key] : ''
            });
        }
    });
    StorageAdapter.saveChangeLogs(changeLogs);
}

// ============================================================================
// DICCIONARIO, CATEGORIAS Y TICKETS (ADMIN)
// ============================================================================
function renderDictionary() {
    const tbody = document.querySelector('#dictionary-table tbody');
    if (!tbody) return;
    const rows = StorageAdapter.getDictionary().slice().sort((a, b) => String(a.palabra).localeCompare(String(b.palabra)));
    tbody.innerHTML = rows.map((entry, index) => `
        <tr>
            <td><strong>${escapeHtml(entry.palabra)}</strong></td>
            <td>${escapeHtml(entry.equivalente)}</td>
            <td><button class="action-btn text-danger btn-delete-dict" data-index="${index}">Eliminar</button></td>
        </tr>
    `).join('');
}

function saveDictionaryEntry() {
    const palabra = document.getElementById('dict-word').value.trim();
    const equivalente = document.getElementById('dict-equivalent').value.trim();
    if (!palabra || !equivalente) return alert('Ingresa palabra y equivalente.');
    const dictionary = StorageAdapter.getDictionary();
    const existingIndex = dictionary.findIndex(d => normalizeText(d.palabra) === normalizeText(palabra));
    const entry = { palabra, equivalente, fecha: formatDate(new Date()) };
    if (existingIndex >= 0) dictionary[existingIndex] = entry;
    else dictionary.push(entry);
    StorageAdapter.saveDictionary(dictionary);
    document.getElementById('dict-word').value = '';
    document.getElementById('dict-equivalent').value = '';
    renderDictionary();
}

function renderCategories() {
    const tbody = document.querySelector('#categories-table tbody');
    if (!tbody) return;
    const materials = StorageAdapter.getMaterials().map(normalizeMaterial);
    const categories = StorageAdapter.getCategories().slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    tbody.innerHTML = categories.map((cat, index) => {
        const count = materials.filter(m => normalizeText(m.categoria) === normalizeText(cat.nombre)).length;
        return `
            <tr>
                <td><strong>${escapeHtml(cat.nombre)}</strong></td>
                <td>${cat.activa === false ? '<span class="badge badge-neutral">Inactiva</span>' : '<span class="badge badge-success">Activa</span>'}</td>
                <td>${count}</td>
                <td>
                    <button class="action-btn btn-toggle-category" data-index="${index}">${cat.activa === false ? 'Activar' : 'Desactivar'}</button>
                    <button class="action-btn text-danger btn-delete-category" data-index="${index}">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateCategoriesDatalist() {
    const list = document.getElementById('categories-datalist');
    if (!list) return;
    const official = StorageAdapter.getCategories().filter(c => c.activa !== false).map(c => c.nombre);
    const fromMaterials = StorageAdapter.getMaterials().map(m => normalizeMaterial(m).categoria).filter(Boolean);
    const names = Array.from(new Set([...official, ...fromMaterials])).sort((a, b) => a.localeCompare(b));
    list.innerHTML = names.map(name => `<option value="${escapeAttr(name)}"></option>`).join('');
}

function saveCategory() {
    const nombre = document.getElementById('category-name').value.trim();
    const activa = document.getElementById('category-active').value === 'true';
    if (!nombre) return alert('Ingresa una categoria.');
    const categories = StorageAdapter.getCategories();
    const existingIndex = categories.findIndex(c => normalizeText(c.nombre) === normalizeText(nombre));
    const category = { nombre, activa, fecha: formatDate(new Date()) };
    if (existingIndex >= 0) categories[existingIndex] = category;
    else categories.push(category);
    StorageAdapter.saveCategories(categories);
    document.getElementById('category-name').value = '';
    renderCategories();
    updateCategoriesDatalist();
}

function renderTickets() {
    const tbody = document.querySelector('#tickets-table tbody');
    if (!tbody) return;
    const tickets = StorageAdapter.getTickets().slice().reverse();
    tbody.innerHTML = tickets.map(ticket => `
        <tr>
            <td>${escapeHtml(ticket.fecha)} ${escapeHtml(ticket.hora)}</td>
            <td>${escapeHtml(ticket.tipo)}</td>
            <td><span class="badge ${ticket.estado === 'Cerrado' ? 'badge-success' : ticket.estado === 'En revision' ? 'badge-warning' : 'badge-primary'}">${escapeHtml(ticket.estado)}</span></td>
            <td>${escapeHtml(ticket.prioridad)}</td>
            <td>${escapeHtml(ticket.persona || '-')}</td>
            <td>${escapeHtml(ticket.codigo ? `${ticket.codigo} - ${ticket.nombre || ''}` : ticket.termino || '-')}</td>
            <td>${escapeHtml(ticket.comentario || '-')}</td>
            <td>
                <button class="action-btn btn-ticket-review" data-id="${escapeAttr(ticket.id)}">En revision</button>
                <button class="action-btn btn-ticket-close" data-id="${escapeAttr(ticket.id)}">Cerrar</button>
            </td>
        </tr>
    `).join('');
}

function openTicketModal(context = {}) {
    currentTicketContext = context;
    document.getElementById('ticket-modal-title').textContent = context.code ? 'Reportar material' : 'Crear ticket';
    document.getElementById('ticket-related-code').value = context.code || '';
    document.getElementById('ticket-related-name').value = context.name || '';
    document.getElementById('ticket-person').value = document.getElementById('search-user')?.value.trim() || '';
    document.getElementById('ticket-term').value = context.term || context.name || '';
    document.getElementById('ticket-type').value = context.type || (context.code ? 'Error de dato' : 'Busqueda sin resultado');
    document.getElementById('ticket-comment').value = '';
    const modal = document.getElementById('ticket-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeTicketModal() {
    const modal = document.getElementById('ticket-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 250);
}

function saveTicket() {
    const now = new Date();
    const ticket = {
        id: `TCK-${Date.now()}`,
        fecha: formatDate(now),
        hora: formatTime(now),
        tipo: document.getElementById('ticket-type').value,
        estado: 'Abierto',
        prioridad: document.getElementById('ticket-priority').value,
        persona: document.getElementById('ticket-person').value.trim(),
        termino: document.getElementById('ticket-term').value.trim(),
        codigo: document.getElementById('ticket-related-code').value,
        nombre: document.getElementById('ticket-related-name').value,
        comentario: document.getElementById('ticket-comment').value.trim()
    };
    if (!ticket.termino && !ticket.codigo) return alert('Ingresa un termino, codigo o material relacionado.');
    const tickets = StorageAdapter.getTickets();
    tickets.push(ticket);
    StorageAdapter.saveTickets(tickets);
    if (ticket.termino) markPendingState(ticket.termino, 'Ticket creado', ticket.id);
    closeTicketModal();
    renderTickets();
    calculatePendings();
    showToast(`Ticket creado: ${ticket.id}`);
}

function updateTicketState(id, state) {
    const tickets = StorageAdapter.getTickets();
    const idx = tickets.findIndex(t => t.id === id);
    if (idx < 0) return;
    tickets[idx].estado = state;
    tickets[idx].fechaEstado = new Date().toISOString();
    StorageAdapter.saveTickets(tickets);
    renderTickets();
}

document.getElementById('btn-save-dictionary')?.addEventListener('click', saveDictionaryEntry);
document.getElementById('dictionary-table')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-dict');
    if (!btn) return;
    const rows = StorageAdapter.getDictionary().slice().sort((a, b) => String(a.palabra).localeCompare(String(b.palabra)));
    const entry = rows[Number(btn.dataset.index)];
    const next = StorageAdapter.getDictionary().filter(d => !(normalizeText(d.palabra) === normalizeText(entry.palabra) && normalizeText(d.equivalente) === normalizeText(entry.equivalente)));
    StorageAdapter.saveDictionary(next);
    renderDictionary();
});

document.getElementById('btn-save-category')?.addEventListener('click', saveCategory);
document.getElementById('category-name')?.addEventListener('input', (e) => {
    const suggestion = getCategorySuggestion(e.target.value);
    const box = document.getElementById('category-suggestion');
    if (suggestion && normalizeText(suggestion) !== normalizeText(e.target.value)) {
        box.textContent = `Categoria similar existente: ${suggestion}`;
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
});
document.getElementById('categories-table')?.addEventListener('click', (e) => {
    const toggle = e.target.closest('.btn-toggle-category');
    const del = e.target.closest('.btn-delete-category');
    if (!toggle && !del) return;
    const categories = StorageAdapter.getCategories().slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    const category = categories[Number((toggle || del).dataset.index)];
    const original = StorageAdapter.getCategories();
    const idx = original.findIndex(c => normalizeText(c.nombre) === normalizeText(category.nombre));
    if (idx < 0) return;
    if (toggle) original[idx].activa = original[idx].activa === false;
    if (del) original.splice(idx, 1);
    StorageAdapter.saveCategories(original);
    renderCategories();
    updateCategoriesDatalist();
});

document.getElementById('btn-new-ticket')?.addEventListener('click', () => openTicketModal({ type: 'Otro' }));
document.getElementById('close-ticket-modal')?.addEventListener('click', closeTicketModal);
document.getElementById('btn-save-ticket')?.addEventListener('click', saveTicket);
document.getElementById('tickets-table')?.addEventListener('click', (e) => {
    const review = e.target.closest('.btn-ticket-review');
    const close = e.target.closest('.btn-ticket-close');
    if (review) updateTicketState(review.dataset.id, 'En revision');
    if (close) updateTicketState(close.dataset.id, 'Cerrado');
});

// ============================================================================
// HISTORIAL DE CONSULTAS (ADMIN)
// ============================================================================
function renderAdminHistory() {
    const logs = StorageAdapter.getSearchLogs();
    const tbody = document.querySelector('#history-table tbody');
    
    const fPerson = document.getElementById('filter-history-person').value.toLowerCase();
    const fTerm = document.getElementById('filter-history-term').value.toLowerCase();
    const fResult = document.getElementById('filter-history-result').value;

    tbody.innerHTML = '';

    const filtered = logs.slice().reverse().filter(log => {
        if (fPerson && (!log.personaConsulta || !log.personaConsulta.toLowerCase().includes(fPerson))) return false;
        if (fTerm && (!log.terminoBuscado || !log.terminoBuscado.toLowerCase().includes(fTerm))) return false;
        if (fResult === 'found' && !log.resultadoEncontrado) return false;
        if (fResult === 'not_found' && log.resultadoEncontrado) return false;
        return true;
    });

    // Renderizar maximo 200 logs para evitar freeze en DOM
    filtered.slice(0, 200).forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.fecha}</td>
            <td>${log.hora}</td>
            <td>${log.personaConsulta}</td>
            <td><strong>${log.terminoBuscado}</strong></td>
            <td>${log.resultadoEncontrado ? '<span class="badge badge-success">Encontrado</span>' : '<span class="badge badge-danger">Sin resultado</span>'}</td>
            <td>${log.codigoResultado || '-'}</td>
            <td>${log.nombreResultado || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    const stats = document.getElementById('history-stats-container');
    const tot = logs.length;
    const con = logs.filter(l => l.resultadoEncontrado).length;
    const sin = tot - con;
    stats.innerHTML = `
        <div class="stat-card"><div class="stat-value">${tot}</div><div class="stat-label">Total Búsquedas</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success-color)">${con}</div><div class="stat-label">Con Resultado</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger-color)">${sin}</div><div class="stat-label">Sin Resultado</div></div>
    `;
}

document.getElementById('filter-history-person').addEventListener('input', () => {
    clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(renderAdminHistory, 300);
});
document.getElementById('filter-history-term').addEventListener('input', () => {
    clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(renderAdminHistory, 300);
});
document.getElementById('filter-history-result').addEventListener('change', renderAdminHistory);

document.getElementById('btn-export-history-csv').addEventListener('click', () => {
    const logs = StorageAdapter.getSearchLogs();
    if(logs.length === 0) return alert("No hay datos para exportar.");
    
    let csv = "Fecha,Hora,Persona/RUT,Termino Buscado,Resultado,Codigo Encontrado,Nombre Encontrado\n";
    logs.forEach(l => {
        const r = l.resultadoEncontrado ? "Encontrado" : "Sin resultado";
        csv += `"${l.fecha}","${l.hora}","${l.personaConsulta || ''}","${l.terminoBuscado || ''}","${r}","${l.codigoResultado || ''}","${l.nombreResultado || ''}"\n`;
    });

    downloadFile(csv, `bodega360-historial-consultas-${Date.now()}.csv`, "text/csv");
});

document.getElementById('btn-clear-history').addEventListener('click', () => {
    if(confirm("⚠️ ¿Estás seguro de eliminar todo el historial de búsquedas de los usuarios? Esta acción no se puede deshacer.")) {
        StorageAdapter.saveSearchLogs([]);
        renderAdminHistory();
    }
});

// ============================================================================
// PENDIENTES Y MÉTRICAS (ADMIN)
// ============================================================================
function calculatePendings() {
    const materials = StorageAdapter.getMaterials();
    const searchLogs = StorageAdapter.getSearchLogs();
    const dismissed = StorageAdapter.getDismissedSearches();
    const pendingStates = StorageAdapter.getPendingStates();

    const normalizedMaterials = materials.map(normalizeMaterial);
    const totalLocal = normalizedMaterials.length;
    const sinFotoLocal = normalizedMaterials.filter(m => getPhotoState(m) !== 'Con foto').length;
    const criticosSinFotoLocal = normalizedMaterials.filter(m => m.esCritico && getPhotoState(m) !== 'Con foto').length;
    const sinUbiLocal = normalizedMaterials.filter(m => !m.ubicacion).length;
    const sinCostoLocal = normalizedMaterials.filter(m => m.costoPromedio === "" || m.costoPromedio === null).length;
    const sinStockLocal = normalizedMaterials.filter(m => m.stock === "" || m.stock === null).length;
    const sinCatLocal = normalizedMaterials.filter(m => !m.categoria).length;
    const noValidadosLocal = normalizedMaterials.filter(m => !m.validado).length;
    const criticosBajoStock = normalizedMaterials.filter(m => m.esCritico && getStockInfo(m).className !== 'badge-success').length;

    document.getElementById('stats-container').innerHTML = `
        <div class="stat-card"><div class="stat-value">${totalLocal}</div><div class="stat-label">Total Materiales</div></div>
        <div class="stat-card"><div class="stat-value">${sinUbiLocal}</div><div class="stat-label">Sin Ubicacion</div></div>
        <div class="stat-card"><div class="stat-value">${sinFotoLocal}</div><div class="stat-label">Materiales sin foto</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning-color)">${criticosSinFotoLocal}</div><div class="stat-label">Criticos sin foto</div></div>
        <div class="stat-card"><div class="stat-value">${sinCostoLocal}</div><div class="stat-label">Sin Costo Prom.</div></div>
        <div class="stat-card"><div class="stat-value">${sinStockLocal}</div><div class="stat-label">Sin Stock</div></div>
        <div class="stat-card"><div class="stat-value">${sinCatLocal}</div><div class="stat-label">Sin Categoria</div></div>
        <div class="stat-card"><div class="stat-value">${noValidadosLocal}</div><div class="stat-label">No Validados</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger-color)">${criticosBajoStock}</div><div class="stat-label">Criticos por revisar</div></div>
    `;

    const groupsLocal = {};
    searchLogs.filter(l => !l.resultadoEncontrado).forEach(f => {
        const key = normalizeText(f.terminoBuscado);
        if (!key || dismissed.includes(key)) return;
        if (!groupsLocal[key]) {
            groupsLocal[key] = {
                term: f.terminoBuscado,
                count: 0,
                lastDate: f.fecha,
                lastTime: f.hora,
                people: new Set()
            };
        }
        groupsLocal[key].count++;
        if (`${f.fecha} ${f.hora}` > `${groupsLocal[key].lastDate} ${groupsLocal[key].lastTime}`) {
            groupsLocal[key].lastDate = f.fecha;
            groupsLocal[key].lastTime = f.hora;
        }
        if (f.personaConsulta) groupsLocal[key].people.add(f.personaConsulta);
    });

    const tbodyLocal = document.querySelector('#missing-searches-table tbody');
    tbodyLocal.innerHTML = '';
    Object.values(groupsLocal).sort((a, b) => b.count - a.count).forEach(g => {
        const state = pendingStates[normalizeText(g.term)] || { estado: 'Pendiente' };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(g.term)}</strong></td>
            <td><span class="badge badge-warning">${g.count} veces</span></td>
            <td>${escapeHtml(g.lastDate)}</td>
            <td>${escapeHtml(g.lastTime)}</td>
            <td>${escapeHtml(Array.from(g.people).join(', ') || '-')}</td>
            <td><span class="badge ${state.estado === 'Cargado' || state.estado === 'No corresponde' ? 'badge-success' : state.estado === 'Ticket creado' || state.estado === 'En revision' ? 'badge-warning' : 'badge-neutral'}">${escapeHtml(state.estado || 'Pendiente')}</span></td>
            <td>
                <button class="action-btn btn-create-search" data-term="${escapeAttr(g.term)}">Crear material</button>
                <button class="action-btn btn-ticket-search" data-term="${escapeAttr(g.term)}">Ticket</button>
                <button class="action-btn btn-review-search" data-term="${escapeAttr(g.term)}">En revision</button>
                <button class="action-btn btn-not-applicable-search" data-term="${escapeAttr(g.term)}">No corresponde</button>
                <button class="action-btn text-warning btn-dismiss-search" data-term="${escapeAttr(g.term)}">Ocultar</button>
            </td>
        `;
        tbodyLocal.appendChild(tr);
    });
    return;

    const total = materials.length;
    const sinFoto = materials.filter(m => !m.foto).length;
    const sinUbi = materials.filter(m => !m.ubicacion).length;
    const sinCosto = materials.filter(m => m.costoPromedio === "" || m.costoPromedio === null).length;
    const sinStock = materials.filter(m => m.stock === "" || m.stock === null).length;
    const sinCat = materials.filter(m => !m.categoria).length;
    const noValidados = materials.filter(m => !m.validado).length;
    
    const container = document.getElementById('stats-container');
    container.innerHTML = `
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Materiales</div></div>
        <div class="stat-card"><div class="stat-value">${sinUbi}</div><div class="stat-label">Sin Ubicación</div></div>
        <div class="stat-card"><div class="stat-value">${sinFoto}</div><div class="stat-label">Sin Foto</div></div>
        <div class="stat-card"><div class="stat-value">${sinCosto}</div><div class="stat-label">Sin Costo Prom.</div></div>
        <div class="stat-card"><div class="stat-value">${sinStock}</div><div class="stat-label">Sin Stock</div></div>
        <div class="stat-card"><div class="stat-value">${sinCat}</div><div class="stat-label">Sin Categoría</div></div>
        <div class="stat-card"><div class="stat-value">${noValidados}</div><div class="stat-label">No Validados</div></div>
    `;

    // Procesar faltantes agrupados
    const failures = searchLogs.filter(l => !l.resultadoEncontrado);
    const groups = {};

    failures.forEach(f => {
        const t = f.terminoBuscado.toLowerCase().trim();
        if(dismissed.includes(t) || t === "") return;

        if(!groups[t]) {
            groups[t] = {
                term: f.terminoBuscado,
                count: 0,
                lastDate: f.fecha,
                lastTime: f.hora,
                people: new Set()
            };
        }
        groups[t].count++;
        if (f.fecha > groups[t].lastDate || (f.fecha === groups[t].lastDate && f.hora > groups[t].lastTime)) {
            groups[t].lastDate = f.fecha;
            groups[t].lastTime = f.hora;
        }
        if(f.personaConsulta) groups[t].people.add(f.personaConsulta);
    });

    const tbody = document.querySelector('#missing-searches-table tbody');
    tbody.innerHTML = '';
    
    Object.values(groups).sort((a,b) => b.count - a.count).forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${g.term}</strong></td>
            <td><span class="badge badge-warning">${g.count} veces</span></td>
            <td>${g.lastDate}</td>
            <td>${g.lastTime}</td>
            <td>${Array.from(g.people).join(', ')}</td>
            <td>
                <button class="action-btn btn-create-search" data-term="${g.term.replace(/"/g, '&quot;')}">Crear material</button>
                <button class="action-btn text-warning btn-dismiss-search" data-term="${g.term.replace(/"/g, '&quot;')}">Ocultar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('missing-searches-table').addEventListener('click', (e) => {
    const btnCreate = e.target.closest('.btn-create-search');
    const btnDismiss = e.target.closest('.btn-dismiss-search');
    const btnTicket = e.target.closest('.btn-ticket-search');
    const btnReview = e.target.closest('.btn-review-search');
    const btnNotApplicable = e.target.closest('.btn-not-applicable-search');
    
    if (btnCreate) createFromSearch(btnCreate.getAttribute('data-term'));
    else if (btnDismiss) dismissSearch(btnDismiss.getAttribute('data-term'));
    else if (btnTicket) openTicketModal({ type: 'Busqueda sin resultado', term: btnTicket.getAttribute('data-term') });
    else if (btnReview) { markPendingState(btnReview.getAttribute('data-term'), 'En revision'); calculatePendings(); }
    else if (btnNotApplicable) { markPendingState(btnNotApplicable.getAttribute('data-term'), 'No corresponde'); calculatePendings(); }
});

document.getElementById('btn-export-pendings-csv')?.addEventListener('click', () => {
    const logs = StorageAdapter.getSearchLogs().filter(l => !l.resultadoEncontrado);
    const states = StorageAdapter.getPendingStates();
    const groups = {};
    logs.forEach(log => {
        const key = normalizeText(log.terminoBuscado);
        if (!key) return;
        if (!groups[key]) groups[key] = { term: log.terminoBuscado, count: 0, people: new Set(), last: `${log.fecha} ${log.hora}` };
        groups[key].count++;
        groups[key].people.add(log.personaConsulta || '');
        groups[key].last = `${log.fecha} ${log.hora}` > groups[key].last ? `${log.fecha} ${log.hora}` : groups[key].last;
    });
    let csv = csvLine(['Termino', 'Veces', 'Consultantes', 'Ultima consulta', 'Estado', 'Nota']);
    Object.values(groups).forEach(g => {
        const state = states[normalizeText(g.term)] || {};
        csv += csvLine([g.term, g.count, Array.from(g.people).filter(Boolean).join('; '), g.last, state.estado || 'Pendiente', state.nota || '']);
    });
    downloadFile(csv, `bodega360-pendientes-${Date.now()}.csv`, 'text/csv');
});

function createFromSearch(term) {
    resetMaterialForm();
    currentPendingTerm = term;
    markPendingState(term, 'En revision', 'Prellenado para carga manual');
    // Heurística de pre-llenado: si tiene números probablemente es código
    if(/\d/.test(term)) {
        document.getElementById('mat-codigo').value = term.toUpperCase().trim();
    } else {
        document.getElementById('mat-nombre').value = term.charAt(0).toUpperCase() + term.slice(1);
    }
    document.getElementById('mat-observaciones').value = `Creado a partir de búsqueda fallida: "${term}"`;
    switchTab('admin-add-material');
}

function dismissSearch(term) {
    const termLow = term.toLowerCase().trim();
    const d = StorageAdapter.getDismissedSearches();
    if(!d.includes(termLow)) {
        d.push(termLow);
        StorageAdapter.saveDismissedSearches(d);
        calculatePendings();
    }
}

// ============================================================================
// IMPORTAR / EXPORTAR BACKUPS
// ============================================================================
document.getElementById('btn-export-backup').addEventListener('click', () => {
    const settings = StorageAdapter.getSettings();
    settings.ultimoRespaldo = new Date().toISOString();
    settings.cambiosUltimoRespaldo = StorageAdapter.getChangeLogs().length;
    StorageAdapter.saveSettings(settings);
    const backup = {
        materiales: StorageAdapter.getMaterials(),
        historialConsultas: StorageAdapter.getSearchLogs(),
        historialCambios: StorageAdapter.getChangeLogs(),
        historialCargas: StorageAdapter.getImportLogs(),
        busquedasOcultas: StorageAdapter.getDismissedSearches(),
        diccionarioBusqueda: StorageAdapter.getDictionary(),
        categorias: StorageAdapter.getCategories(),
        tickets: StorageAdapter.getTickets(),
        estadosPendientes: StorageAdapter.getPendingStates(),
        configuracion: StorageAdapter.getSettings(),
        fechaExportacion: new Date().toISOString()
    };
    const dateStr = formatDate(new Date()).replace(/-/g, '') + '-' + formatTime(new Date()).replace(':', '');
    downloadFile(JSON.stringify(backup, null, 2), `bodega360-respaldo-${dateStr}.json`, "application/json");
    renderDiagnostics();
});

document.getElementById('btn-restore-backup').addEventListener('click', () => {
    const fileInput = document.getElementById('file-restore-backup');
    if (!fileInput.files.length) return alert("Selecciona un archivo JSON de respaldo primero.");
    if (!confirm("⚠️ ADVERTENCIA: Esto reemplazará TODOS los datos locales actuales. ¿Estás seguro?")) return;

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.materiales) StorageAdapter.saveMaterials(data.materiales);
            if (data.historialConsultas) StorageAdapter.saveSearchLogs(data.historialConsultas);
            if (data.historialCambios) StorageAdapter.saveChangeLogs(data.historialCambios);
            if (data.historialCargas) StorageAdapter.saveImportLogs(data.historialCargas);
            if (data.busquedasOcultas) StorageAdapter.saveDismissedSearches(data.busquedasOcultas);
            if (data.diccionarioBusqueda) StorageAdapter.saveDictionary(data.diccionarioBusqueda);
            if (data.categorias) StorageAdapter.saveCategories(data.categorias);
            if (data.tickets) StorageAdapter.saveTickets(data.tickets);
            if (data.estadosPendientes) StorageAdapter.savePendingStates(data.estadosPendientes);
            if (data.configuracion) StorageAdapter.saveSettings(data.configuracion);

            alert("Respaldo restaurado exitosamente.");
            refreshAdminViews();
            fileInput.value = '';
        } catch (err) { alert("Error al restaurar respaldo: " + err.message); }
    };
    reader.readAsText(file);
});

document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm("⚠️ PELIGRO EXTREMO: Vas a borrar absolutamente todos los datos locales. Esto no se puede deshacer. ¿Estás 100% seguro?")) {
        StorageAdapter.clearAll();
        alert("Datos limpiados.");
        location.reload(); // Recargar limpia todo el estado en memoria
    }
});

// ============================================================================
// MÓDULO: BASE MAESTRA
// ============================================================================
document.getElementById('btn-load-local-catalog').addEventListener('click', () => {
    fetch('data/catalogo-materiales.json')
        .then(res => {
            if(!res.ok) throw new Error("File not found or CORS issue");
            return res.json();
        })
        .then(data => { processMasterData(data, "data/catalogo-materiales.json"); })
        .catch(err => {
            alert("No se pudo cargar automáticamente desde /data.\nPosible causa: Ejecutando via file:// sin servidor local.\nAbre la app con 'python -m http.server' o usa 'Seleccionar archivo'.");
        });
});

document.getElementById('file-master-catalog').addEventListener('change', (e) => {
    if(!e.target.files.length) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        if(file.name.endsWith('.json')) {
            try { processMasterData(JSON.parse(ev.target.result), file.name); } 
            catch(err) { alert("Error JSON: " + err.message); }
        } else if(file.name.endsWith('.csv')) {
            processMasterData(parseCSV(ev.target.result), file.name);
        } else {
            alert("Formato no soportado. Usa CSV o JSON.");
        }
    };
    reader.readAsText(file);
});

// CSV Parser robusto que mantiene ceros a la izquierda tratando todo como string
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if(lines.length < 2) return [];
    
    const sep = lines[0].includes(';') ? ';' : ',';
    const splitCSVRow = (str) => {
        const result = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '"') { inQuote = !inQuote; }
            else if (str[i] === sep && !inQuote) { result.push(cur); cur = ''; }
            else { cur += str[i]; }
        }
        result.push(cur);
        return result.map(s => String(s).trim().replace(/^"|"$/g, ''));
    };

    const headers = splitCSVRow(lines[0]);
    const results = [];
    
    for(let i=1; i<lines.length; i++){
        const row = splitCSVRow(lines[i]);
        if(row.length < 2) continue;
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = String(row[idx] || ''); });
        results.push(obj);
    }
    return results;
}

function normalizeMasterRow(row) {
    const out = {
        codigo: '', codigoAlternativo: '', codigoBarra: '', nombre: '', descripcion: '', categoria: '',
        marca: '', modelo: '', unidadMedida: 'UN', stock: '', stockMinimo: '', costoPromedio: '',
        fechaCostoPromedio: '', origenCosto: 'Excel', moneda: 'CLP', ubicacion: '', estado: 'Activo',
        equipoAsociado: '', aliasBusqueda: '', estadoRevision: 'Pendiente',
        observaciones: '', fotoPrincipal: '', foto: '', fotosAdicionales: [], validado: true, esCritico: false
    };

    Object.keys(row).forEach(k => {
        const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        const val = row[k];
        if (['codigo','cod','sku','item','itemcode'].includes(kl)) out.codigo = String(val);
        else if (['codigoalternativo','codalternativo','alternativo'].includes(kl)) out.codigoAlternativo = String(val);
        else if (['codigobarra','codigodebarra','barcode','ean','qr'].includes(kl)) out.codigoBarra = String(val);
        else if (['nombre','producto','material','descripcioncorta'].includes(kl)) out.nombre = String(val);
        else if (['descripcion','detalle','glosa'].includes(kl)) out.descripcion = String(val);
        else if (['categoria','familia','grupo'].includes(kl)) out.categoria = String(val);
        else if (['marca'].includes(kl)) out.marca = String(val);
        else if (['modelo'].includes(kl)) out.modelo = String(val);
        else if (['unidadmedida','unidad','um'].includes(kl)) out.unidadMedida = String(val);
        else if (['stock','cantidad','existencia'].includes(kl)) out.stock = val;
        else if (['stockminimo','minimo','stockcritico'].includes(kl)) out.stockMinimo = val;
        else if (['costopromedio','preciopromedio','costo','precio','valor'].includes(kl)) out.costoPromedio = val;
        else if (['fechacostopromedio','fechacosto','fechaprecio'].includes(kl)) out.fechaCostoPromedio = String(val);
        else if (['origencosto','origenprecio'].includes(kl)) out.origenCosto = String(val);
        else if (['moneda'].includes(kl)) out.moneda = String(val);
        else if (['ubicacion','bodega','lugar','sector','estante'].includes(kl)) out.ubicacion = String(val);
        else if (['equipoasociado','equipo','maquina'].includes(kl)) out.equipoAsociado = String(val);
        else if (['aliasbusqueda','alias','sinonimos','keywords'].includes(kl)) out.aliasBusqueda = String(val);
        else if (['estado'].includes(kl)) out.estado = String(val);
        else if (['estadorevision','revision'].includes(kl)) out.estadoRevision = String(val);
        else if (['observaciones','nota','comentario'].includes(kl)) out.observaciones = String(val);
        else if (['fotoprincipal','foto','imagen','urlfoto'].includes(kl)) { out.fotoPrincipal = String(val); out.foto = String(val); }
        else if (['fotosadicionales','fotos','imagenes'].includes(kl)) out.fotosAdicionales = splitKeywords(val);
        else if (['validado','revisado'].includes(kl)) out.validado = (val === 'true' || val === true || val === '1' || String(val).toLowerCase() === 'si');
        else if (['escritico','critico','materialcritico'].includes(kl)) out.esCritico = (val === 'true' || val === true || val === '1' || String(val).toLowerCase() === 'si');
    });

    if(out.stock !== "" && !isNaN(out.stock)) out.stock = Number(out.stock);
    if(out.stockMinimo !== "" && !isNaN(out.stockMinimo)) out.stockMinimo = Number(out.stockMinimo);
    if(out.costoPromedio !== "" && !isNaN(out.costoPromedio)) out.costoPromedio = Number(out.costoPromedio);

    return normalizeMaterial(out);
}

function processMasterData(rawData, fileName) {
    if(!Array.isArray(rawData)) return alert("El formato no es un arreglo válido.");
    
    const existing = StorageAdapter.getMaterials();
    const existingCodes = new Set(existing.map(m => String(m.codigo)));
    const processed = [];
    const localCodes = new Set();
    
    let validCount = 0;
    let errorCount = 0;
    
    rawData.forEach((row, index) => {
        const item = normalizeMasterRow(row);
        item._originalRow = index + 1;
        item._errors = [];
        item._warnings = [];
        item._isExisting = existingCodes.has(item.codigo);

        if(!item.codigo) item._errors.push("Código vacío");
        if(!item.nombre) item._errors.push("Nombre vacío");
        if(localCodes.has(item.codigo)) item._errors.push("Código duplicado en archivo");
        if(item.stock !== "" && isNaN(item.stock)) item._errors.push("Stock no numérico");
        if(item.costoPromedio !== "" && isNaN(item.costoPromedio)) item._errors.push("Costo no numérico");

        if(item._errors.length > 0) {
            errorCount++;
        } else {
            validCount++;
            localCodes.add(item.codigo);
        }

        if(!item.ubicacion) item._warnings.push("Sin ubicación");
        if(!item.foto) item._warnings.push("Sin foto");
        if(item.stock === "") item._warnings.push("Sin stock");
        if(item.costoPromedio === "") item._warnings.push("Sin costo");
        if(item._isExisting) item._warnings.push("Material ya existe");

        processed.push(item);
    });

    currentImportData = {
        fileName: fileName,
        total: rawData.length,
        valid: validCount,
        error: errorCount,
        items: processed
    };

    renderMasterPreview();
}

function renderMasterPreview() {
    document.getElementById('master-preview-section').classList.remove('hidden');
    
    const d = currentImportData;
    const stats = document.getElementById('master-stats-container');
    stats.innerHTML = `
        <div class="stat-card"><div class="stat-value">${d.total}</div><div class="stat-label">Total Filas</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success-color)">${d.valid}</div><div class="stat-label">Válidos</div></div>
        <div class="stat-card" style="${d.error > 0 ? 'border-color: var(--danger-color)' : ''}"><div class="stat-value" style="color:var(--danger-color)">${d.error}</div><div class="stat-label">Con Errores</div></div>
    `;

    const tbody = document.querySelector('#master-preview-table tbody');
    tbody.innerHTML = '';

    d.items.slice(0, 100).forEach(item => {
        const tr = document.createElement('tr');
        if(item._errors.length > 0) tr.style.backgroundColor = 'var(--danger-light)';
        
        const errsHtml = item._errors.map(e => `<span style="color:var(--danger-color);display:block;font-size:0.8rem;">❌ ${e}</span>`).join('');
        const warnsHtml = item._warnings.map(e => `<span style="color:var(--warning-color);display:block;font-size:0.8rem;">⚠️ ${e}</span>`).join('');

        tr.innerHTML = `
            <td>${item._originalRow}</td>
            <td><strong>${item.codigo}</strong></td>
            <td>${item.nombre}</td>
            <td>${item.categoria || ''}</td>
            <td>${item.stock !== "" ? item.stock : ''}</td>
            <td>${item.costoPromedio !== "" ? formatCurrency(item.costoPromedio) : ''}</td>
            <td>${item.ubicacion || ''}</td>
            <td>${item.estado}</td>
            <td>${item._errors.length === 0 ? '<span class="badge badge-success">OK</span>' : '<span class="badge badge-danger">Error</span>'}</td>
            <td>${errsHtml}${warnsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-cancel-master-import').addEventListener('click', () => {
    document.getElementById('master-preview-section').classList.add('hidden');
    document.getElementById('file-master-catalog').value = '';
    currentImportData = null;
});

document.getElementById('btn-confirm-master-import').addEventListener('click', () => {
    if(!currentImportData) return;
    if(currentImportData.error > 0) {
        if(!confirm(`Hay ${currentImportData.error} filas con errores bloqueantes. Éstas no se importarán. ¿Continuar?`)) return;
    }

    const policy = document.getElementById('master-import-policy').value;
    if(policy === 'replace_all') {
        if(!confirm("⚠️ PELIGRO: Has elegido REEMPLAZAR TODA LA BASE ACTUAL. Todos los materiales existentes desaparecerán si no están en este archivo. ¿Confirmar 100%?")) return;
    }

    let existingMaterials = policy === 'replace_all' ? [] : StorageAdapter.getMaterials();
    
    let added = 0;
    let updated = 0;
    let skipped = 0;

    const validItems = currentImportData.items.filter(i => i._errors.length === 0);

    validItems.forEach(importItem => {
        const cleanItem = { ...importItem };
        delete cleanItem._originalRow; delete cleanItem._errors; delete cleanItem._warnings; delete cleanItem._isExisting;

        const idx = existingMaterials.findIndex(m => m.codigo === cleanItem.codigo);

        if(idx >= 0) {
            if(policy === 'skip' || policy === 'new_only') {
                skipped++;
            } else if(policy === 'update') {
                existingMaterials[idx] = cleanItem;
                updated++;
            }
        } else {
            if(policy === 'update' || policy === 'skip' || policy === 'new_only' || policy === 'replace_all') {
                existingMaterials.push(cleanItem);
                added++;
            }
        }
    });

    StorageAdapter.saveMaterials(existingMaterials);

    const log = {
        fecha: formatDate(new Date()),
        hora: formatTime(new Date()),
        nombreArchivo: currentImportData.fileName,
        totalFilas: currentImportData.total,
        importados: added,
        actualizados: updated,
        omitidos: skipped,
        errores: currentImportData.error,
        politica: policy,
        usuario: 'admin'
    };
    const iLogs = StorageAdapter.getImportLogs();
    iLogs.push(log);
    StorageAdapter.saveImportLogs(iLogs);

    alert(`Importación completada.\nNuevos: ${added}\nActualizados: ${updated}\nOmitidos: ${skipped}\nErrores: ${currentImportData.error}`);
    
    if(confirm("Importación completada con éxito. Es altamente recomendable que exportes un respaldo JSON ahora mismo para no perder esta carga. ¿Exportar ahora?")) {
        document.getElementById('btn-export-backup').click();
    }

    document.getElementById('master-preview-section').classList.add('hidden');
    document.getElementById('file-master-catalog').value = '';
    currentImportData = null;
    
    refreshAdminViews();
});

function renderMasterHistory() {
    const logs = StorageAdapter.getImportLogs();
    const tbody = document.querySelector('#master-history-table tbody');
    tbody.innerHTML = '';
    
    logs.slice().reverse().forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${l.fecha}</td>
            <td>${l.hora}</td>
            <td>${l.nombreArchivo}</td>
            <td>${l.totalFilas}</td>
            <td><span class="badge badge-success">${l.importados}</span></td>
            <td><span class="badge badge-primary">${l.actualizados}</span></td>
            <td>${l.omitidos}</td>
            <td>${l.errores > 0 ? `<span class="badge badge-danger">${l.errores}</span>` : '0'}</td>
            <td>${l.politica}</td>
            <td>${l.usuario}</td>
        `;
        tbody.appendChild(tr);
    });
}

function parseLocalDate(dateText, timeText = '00:00') {
    if (!dateText) return null;
    const d = new Date(`${dateText}T${timeText || '00:00'}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getReportRange() {
    const period = document.getElementById('report-period')?.value || '7d';
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (period === 'today') {
        start.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else if (period === 'custom') {
        const customStart = document.getElementById('report-start')?.value;
        const customEnd = document.getElementById('report-end')?.value;
        const s = customStart ? parseLocalDate(customStart) : start;
        const e = customEnd ? parseLocalDate(customEnd, '23:59') : end;
        return { label: `${customStart || 'inicio'} a ${customEnd || 'hoy'}`, start: s || start, end: e || end, period };
    }

    const labels = { today: 'Hoy', '7d': 'Ultimos 7 dias', '30d': 'Ultimos 30 dias', month: 'Mes actual' };
    return { label: labels[period] || 'Periodo', start, end, period };
}

function isInsideRange(date, range) {
    return date && date >= range.start && date <= range.end;
}

function getReportLogs(range = getReportRange()) {
    return StorageAdapter.getSearchLogs().filter(log => isInsideRange(parseLocalDate(log.fecha, log.hora), range));
}

function countBy(items, keyGetter) {
    const grouped = {};
    items.forEach(item => {
        const key = keyGetter(item);
        if (!key) return;
        grouped[key] = grouped[key] || { key, count: 0, item };
        grouped[key].count++;
    });
    return Object.values(grouped).sort((a, b) => b.count - a.count);
}

function getIncompleteCount(material) {
    const m = normalizeMaterial(material);
    return [
        !m.descripcion,
        !m.categoria,
        !m.ubicacion,
        m.stock === '' || m.stock === null,
        m.costoPromedio === '' || m.costoPromedio === null,
        !m.validado,
        getPhotoState(m) !== 'Con foto'
    ].filter(Boolean).length;
}

function buildReportData(range = getReportRange()) {
    const materials = StorageAdapter.getMaterials().map(normalizeMaterial);
    const logs = getReportLogs(range);
    const tickets = StorageAdapter.getTickets();
    const changes = StorageAdapter.getChangeLogs();
    const imports = StorageAdapter.getImportLogs();
    const settings = StorageAdapter.getSettings();
    const found = logs.filter(l => l.resultadoEncontrado);
    const missing = logs.filter(l => !l.resultadoEncontrado);
    const successRate = logs.length ? Math.round((found.length / logs.length) * 100) : 0;
    const costOutdated = materials.filter(isCostOutdated);
    const criticalNoStock = materials.filter(m => m.esCritico && (m.stock === '' || m.stock === null || Number(m.stock) <= 0));
    const avgQuality = materials.length ? Math.round(materials.reduce((sum, m) => sum + Number(m.calidadDato || 0), 0) / materials.length) : 0;
    const minutesSaved = found.length * Number(settings.minutosAhorroPorConsulta || 2);
    const topMissingSearches = countBy(missing, l => normalizeText(l.terminoBuscado)).map(g => ({ label: g.item.terminoBuscado, count: g.count })).slice(0, 10);
    const topMaterials = countBy(found, l => l.codigoResultado || l.nombreResultado).map(g => ({ label: `${g.item.codigoResultado || ''} ${g.item.nombreResultado || ''}`.trim(), count: g.count, codigo: g.item.codigoResultado })).slice(0, 10);
    const ticketsByState = countBy(tickets, t => t.estado || 'Abierto').map(g => ({ label: g.key, count: g.count })).slice(0, 10);
    const editsByMaterial = countBy(changes, c => c.codigo).map(g => ({ label: g.key, count: g.count, codigo: g.key })).slice(0, 10);
    const incompleteByCategory = countBy(materials.filter(m => getIncompleteCount(m) > 0), m => m.categoria || 'Sin categoria')
        .map(g => ({ label: g.key, count: materials.filter(m => (m.categoria || 'Sin categoria') === g.key).reduce((sum, m) => sum + getIncompleteCount(m), 0) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const searchesByWeekday = weekDays.map((label, index) => ({
        label,
        count: logs.filter(log => parseLocalDate(log.fecha, log.hora)?.getDay() === index).length
    }));

    return {
        range,
        materials,
        logs,
        found,
        missing,
        tickets,
        changes,
        imports,
        settings,
        metrics: {
            totalSearches: logs.length,
            foundSearches: found.length,
            missingSearches: missing.length,
            successRate,
            materialCount: materials.length,
            validatedCount: materials.filter(m => m.validado).length,
            withoutPhoto: materials.filter(m => getPhotoState(m) !== 'Con foto').length,
            withoutLocation: materials.filter(m => !m.ubicacion).length,
            withoutCost: materials.filter(m => m.costoPromedio === '' || m.costoPromedio === null).length,
            costOutdated: costOutdated.length,
            criticalNoStock: criticalNoStock.length,
            ticketsOpen: tickets.filter(t => t.estado !== 'Cerrado').length,
            ticketsResolved: tickets.filter(t => t.estado === 'Cerrado').length,
            changesCount: changes.length,
            importsCount: imports.length,
            avgQuality,
            minutesSaved,
            hoursSaved: Math.round((minutesSaved / 60) * 10) / 10
        },
        tops: {
            topMissingSearches,
            topMaterials,
            withoutPhoto: materials.filter(m => getPhotoState(m) !== 'Con foto').slice(0, 10).map(m => ({ label: `${m.codigo} ${m.nombre}`, codigo: m.codigo })),
            withoutLocation: materials.filter(m => !m.ubicacion).slice(0, 10).map(m => ({ label: `${m.codigo} ${m.nombre}`, codigo: m.codigo })),
            withoutCost: materials.filter(m => m.costoPromedio === '' || m.costoPromedio === null).slice(0, 10).map(m => ({ label: `${m.codigo} ${m.nombre}`, codigo: m.codigo })),
            criticalNoStock: criticalNoStock.slice(0, 10).map(m => ({ label: `${m.codigo} ${m.nombre}`, codigo: m.codigo })),
            costOutdated: costOutdated.slice(0, 10).map(m => ({ label: `${m.codigo} ${m.nombre}`, codigo: m.codigo })),
            incompleteByCategory,
            openTickets: tickets.filter(t => t.estado !== 'Cerrado').slice(0, 10).map(t => ({ label: `${t.id} ${t.termino || t.codigo || ''}`, count: t.prioridad || '' })),
            editsByMaterial
        },
        charts: {
            searchesByWeekday,
            resultSplit: [{ label: 'Con resultado', count: found.length }, { label: 'Sin resultado', count: missing.length }],
            topMaterials,
            topMissingSearches,
            quality: [
                { label: 'Validados', count: materials.filter(m => m.validado).length },
                { label: 'Con ubicacion', count: materials.filter(m => m.ubicacion).length },
                { label: 'Con costo', count: materials.filter(m => m.costoPromedio !== '' && m.costoPromedio !== null).length },
                { label: 'Calidad >=75%', count: materials.filter(m => Number(m.calidadDato || 0) >= 75).length }
            ],
            ticketsByState
        }
    };
}

function renderBarChart(title, rows, emptyText = 'Sin datos') {
    const max = Math.max(1, ...rows.map(r => Number(r.count || 0)));
    const body = rows.length && rows.some(r => r.count)
        ? rows.map(r => `
            <div class="report-bar-row">
                <span title="${escapeAttr(r.label)}">${escapeHtml(r.label)}</span>
                <div class="report-bar-track"><div class="report-bar-fill" style="width:${Math.round((Number(r.count || 0) / max) * 100)}%"></div></div>
                <strong>${escapeHtml(r.count)}</strong>
            </div>
        `).join('')
        : `<div class="empty-mini">${escapeHtml(emptyText)}</div>`;
    return `<div class="report-card"><h3>${escapeHtml(title)}</h3>${body}</div>`;
}

function renderProblemTable(title, rows, actionType) {
    const body = rows.length
        ? rows.map(row => `
            <tr>
                <td>${escapeHtml(row.label)}</td>
                <td>${escapeHtml(row.count ?? '')}</td>
                <td>${row.codigo ? `<button class="action-btn report-open-material" data-codigo="${escapeAttr(row.codigo)}">Ver material</button>` : actionType === 'create' ? `<button class="action-btn report-create-material" data-term="${escapeAttr(row.label)}">Crear material</button>` : '-'}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" class="text-muted">Sin datos</td></tr>';
    return `
        <div class="report-card">
            <h3>${escapeHtml(title)}</h3>
            <div class="table-responsive compact-table">
                <table><thead><tr><th>Item</th><th>Dato</th><th>Accion</th></tr></thead><tbody>${body}</tbody></table>
            </div>
        </div>
    `;
}

function buildRecommendations(data) {
    const r = [];
    const m = data.metrics;
    if (m.totalSearches === 0) r.push('Sin historial suficiente: use la app unos dias para medir valor real.');
    if (m.missingSearches >= 5 || (m.totalSearches && m.successRate < 70)) r.push('Hay muchas busquedas sin resultado. Revise Base Maestra y pendientes.');
    if (m.criticalNoStock > 0) r.push('Existen materiales criticos sin stock. Revisar prioridad operativa.');
    if (m.withoutCost > 0) r.push('Hay materiales sin costo promedio. Completar costos mejora las consultas de bodega.');
    if (m.avgQuality > 0 && m.avgQuality < 60) r.push('El catalogo tiene baja calidad promedio. Priorizar ubicacion, costo y validacion.');
    if (m.withoutPhoto > 10) r.push('Hay muchos materiales sin foto, pero esto no bloquea la operacion.');
    const diag = buildDiagnosticsData(data);
    if (diag.backupRecommended) r.push('Se recomienda exportar respaldo.');
    if (!r.length) r.push('No hay alertas relevantes para el periodo seleccionado.');
    return r;
}

function renderReports() {
    const container = document.getElementById('reports-stats-container');
    if (!container) return;
    const settings = StorageAdapter.getSettings();
    const minutesInput = document.getElementById('setting-minutes-saved');
    if (minutesInput && String(minutesInput.value || '') !== String(settings.minutosAhorroPorConsulta || 2)) {
        minutesInput.value = settings.minutosAhorroPorConsulta || 2;
    }
    document.querySelectorAll('.report-custom-range').forEach(el => el.classList.toggle('hidden', document.getElementById('report-period')?.value !== 'custom'));
    const data = buildReportData();
    const m = data.metrics;
    document.getElementById('reports-empty')?.classList.toggle('hidden', data.logs.length > 0 || data.materials.length > 0);
    container.innerHTML = [
        ['Busquedas', m.totalSearches],
        ['Con resultado', m.foundSearches],
        ['Sin resultado', m.missingSearches],
        ['Exito', `${m.successRate}%`],
        ['Materiales', m.materialCount],
        ['Validados', m.validatedCount],
        ['Sin foto', m.withoutPhoto],
        ['Sin ubicacion', m.withoutLocation],
        ['Sin costo', m.withoutCost],
        ['Costo vencido', m.costOutdated],
        ['Criticos sin stock', m.criticalNoStock],
        ['Tickets abiertos', m.ticketsOpen],
        ['Tickets resueltos', m.ticketsResolved],
        ['Cambios', m.changesCount],
        ['Importaciones', m.importsCount],
        ['Calidad promedio', `${m.avgQuality}%`],
        ['Ahorro estimado', `${m.hoursSaved} h`]
    ].map(([label, value]) => `<div class="stat-card"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`).join('');
    document.getElementById('reports-charts-container').innerHTML = [
        renderBarChart('Busquedas por dia de semana', data.charts.searchesByWeekday),
        renderBarChart('Resultado vs sin resultado', data.charts.resultSplit),
        renderBarChart('Top materiales consultados', data.charts.topMaterials),
        renderBarChart('Top busquedas sin resultado', data.charts.topMissingSearches),
        renderBarChart('Avance calidad de datos', data.charts.quality),
        renderBarChart('Tickets por estado', data.charts.ticketsByState)
    ].join('');
    document.getElementById('reports-problems-container').innerHTML = [
        renderProblemTable('Top busquedas sin resultado', data.tops.topMissingSearches, 'create'),
        renderProblemTable('Materiales sin foto', data.tops.withoutPhoto),
        renderProblemTable('Materiales sin ubicacion', data.tops.withoutLocation),
        renderProblemTable('Materiales sin costo promedio', data.tops.withoutCost),
        renderProblemTable('Materiales criticos sin stock', data.tops.criticalNoStock),
        renderProblemTable('Materiales con costo vencido', data.tops.costOutdated),
        renderProblemTable('Categorias con mas datos incompletos', data.tops.incompleteByCategory),
        renderProblemTable('Tickets abiertos', data.tops.openTickets),
        renderProblemTable('Materiales mas editados', data.tops.editsByMaterial)
    ].join('');
    document.getElementById('reports-recommendations').innerHTML = buildRecommendations(data).map(text => `<div class="recommendation-item">${escapeHtml(text)}</div>`).join('');
}

function buildDiagnosticsData(reportData = buildReportData()) {
    const settings = StorageAdapter.getSettings();
    const bytes = getLocalStorageUsageBytes();
    const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
    const lastImport = StorageAdapter.getImportLogs().slice().reverse()[0] || null;
    const lastBackup = settings.ultimoRespaldo ? new Date(settings.ultimoRespaldo) : null;
    const daysSinceBackup = lastBackup ? Math.floor((Date.now() - lastBackup.getTime()) / 86400000) : null;
    const changesSinceBackup = Math.max(0, StorageAdapter.getChangeLogs().length - Number(settings.cambiosUltimoRespaldo || 0));
    const externalResources = Array.from(document.querySelectorAll('[src],[href]'))
        .map(el => el.getAttribute('src') || el.getAttribute('href'))
        .filter(value => /^https?:\/\//i.test(value || ''));
    const photoBase64Count = reportData.materials.filter(m => String(m.fotoPrincipal || m.foto || '').startsWith('data:image/')).length;
    const warnings = [];
    if (mb > 3) warnings.push('localStorage alto: revise respaldos o servidor interno.');
    if (photoBase64Count > 10) warnings.push('Muchas fotos guardadas localmente pueden llenar el navegador.');
    if (reportData.materials.length === 0) warnings.push('Base sin materiales.');
    if (reportData.metrics.missingSearches >= 5) warnings.push('Muchas busquedas sin resultado.');
    if (reportData.metrics.costOutdated > 0) warnings.push('Hay costos vencidos.');
    if (reportData.metrics.criticalNoStock > 0) warnings.push('Hay materiales criticos sin stock.');
    if (reportData.metrics.avgQuality > 0 && reportData.metrics.avgQuality < 60) warnings.push('Calidad promedio baja.');
    if (!lastBackup || daysSinceBackup > 7 || changesSinceBackup > 50) warnings.push('Respaldo vencido o con muchos cambios pendientes.');
    if (externalResources.length > 0) warnings.push('Hay recursos externos que podrian fallar sin internet.');
    const backupRecommended = !lastBackup || daysSinceBackup > 7 || changesSinceBackup > 50;
    return {
        version: 'Bodega360 HTML Local v3-reportes',
        generatedAt: new Date().toISOString(),
        storageAdapter: 'localStorage',
        materials: reportData.materials.length,
        searches: StorageAdapter.getSearchLogs().length,
        tickets: StorageAdapter.getTickets().length,
        changes: StorageAdapter.getChangeLogs().length,
        imports: StorageAdapter.getImportLogs().length,
        localStorageBytes: bytes,
        localStorageMB: mb,
        lastImport,
        lastBackup: settings.ultimoRespaldo || null,
        changesSinceBackup,
        daysSinceBackup,
        externalResources,
        photoBase64Count,
        warnings,
        backupRecommended,
        reportMetrics: reportData.metrics
    };
}

function renderDiagnostics() {
    const container = document.getElementById('diagnostics-stats-container');
    if (!container) return;
    const data = buildDiagnosticsData();
    document.getElementById('backup-reminder')?.classList.toggle('hidden', !data.backupRecommended);
    container.innerHTML = [
        ['Version', data.version],
        ['StorageAdapter', data.storageAdapter],
        ['Materiales', data.materials],
        ['Busquedas', data.searches],
        ['Tickets', data.tickets],
        ['Cambios', data.changes],
        ['Importaciones', data.imports],
        ['localStorage', `${data.localStorageMB} MB`],
        ['Ultima importacion', data.lastImport ? `${data.lastImport.fecha} ${data.lastImport.hora}` : 'Sin importaciones'],
        ['Ultimo respaldo', data.lastBackup ? new Date(data.lastBackup).toLocaleString('es-CL') : 'Sin respaldo registrado'],
        ['Cambios desde respaldo', data.changesSinceBackup],
        ['Dias desde respaldo', data.daysSinceBackup ?? 'Sin respaldo'],
        ['Recursos externos', data.externalResources.length],
        ['Fotos base64 locales', data.photoBase64Count]
    ].map(([label, value]) => `<div class="stat-card"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`).join('');
    document.getElementById('diagnostics-warnings').innerHTML = data.warnings.length
        ? data.warnings.map(w => `<div class="recommendation-item warning">${escapeHtml(w)}</div>`).join('')
        : '<div class="recommendation-item">Sin advertencias relevantes.</div>';
}

function exportRowsToCsv(rows, fileName) {
    const csv = rows.map(row => csvLine(row)).join('');
    downloadFile(csv, fileName, 'text/csv');
}

function exportReportSearchesCsv() {
    const logs = getReportLogs();
    exportRowsToCsv([
        ['Fecha', 'Hora', 'Persona/RUT', 'Termino', 'Resultado', 'Codigo', 'Nombre'],
        ...logs.map(l => [l.fecha, l.hora, l.personaConsulta || '', l.terminoBuscado || '', l.resultadoEncontrado ? 'Encontrado' : 'Sin resultado', l.codigoResultado || '', l.nombreResultado || ''])
    ], `bodega360-busquedas-periodo-${Date.now()}.csv`);
}

function exportReportMissingCsv() {
    const data = buildReportData();
    exportRowsToCsv([
        ['Termino', 'Veces'],
        ...data.tops.topMissingSearches.map(r => [r.label, r.count])
    ], `bodega360-top-sin-resultado-${Date.now()}.csv`);
}

function exportReportIncompleteCsv() {
    const data = buildReportData();
    const rows = data.materials.filter(m => getIncompleteCount(m) > 0).map(m => [
        m.codigo, m.nombre, m.categoria, m.ubicacion, m.costoPromedio, getPhotoState(m), m.validado ? 'Si' : 'No', getIncompleteCount(m)
    ]);
    exportRowsToCsv([
        ['Codigo', 'Nombre', 'Categoria', 'Ubicacion', 'Costo promedio', 'Foto', 'Validado', 'Campos incompletos'],
        ...rows
    ], `bodega360-datos-incompletos-${Date.now()}.csv`);
}

function exportReportCriticalCsv() {
    const data = buildReportData();
    exportRowsToCsv([
        ['Codigo', 'Nombre', 'Stock', 'Stock minimo', 'Ubicacion'],
        ...data.materials.filter(m => m.esCritico && (m.stock === '' || m.stock === null || Number(m.stock) <= 0)).map(m => [m.codigo, m.nombre, m.stock, m.stockMinimo, m.ubicacion])
    ], `bodega360-criticos-sin-stock-${Date.now()}.csv`);
}

function exportReportTicketsCsv() {
    const tickets = StorageAdapter.getTickets();
    exportRowsToCsv([
        ['ID', 'Fecha', 'Hora', 'Tipo', 'Estado', 'Prioridad', 'Persona', 'Termino', 'Codigo', 'Comentario'],
        ...tickets.map(t => [t.id, t.fecha, t.hora, t.tipo, t.estado, t.prioridad, t.persona, t.termino, t.codigo, t.comentario])
    ], `bodega360-tickets-${Date.now()}.csv`);
}

function exportDiagnosticsCsv() {
    const d = buildDiagnosticsData();
    exportRowsToCsv([
        ['Metrica', 'Valor'],
        ['Version', d.version],
        ['Fecha', d.generatedAt],
        ['StorageAdapter', d.storageAdapter],
        ['Materiales', d.materials],
        ['Busquedas', d.searches],
        ['Tickets', d.tickets],
        ['Cambios', d.changes],
        ['Importaciones', d.imports],
        ['localStorage MB', d.localStorageMB],
        ['Cambios desde respaldo', d.changesSinceBackup],
        ['Dias desde respaldo', d.daysSinceBackup ?? 'Sin respaldo'],
        ['Advertencias', d.warnings.join('; ')]
    ], `bodega360-diagnostico-${Date.now()}.csv`);
}

function exportExecutiveReport() {
    const data = buildReportData();
    const m = data.metrics;
    const recommendations = buildRecommendations(data);
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Ejecutivo Bodega360</title>
<style>
body{font-family:Arial,sans-serif;color:#1E293B;margin:32px;line-height:1.45}h1{color:#0033A0;margin-bottom:4px}.meta{color:#64748B;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card{border:1px solid #E2E8F0;border-radius:8px;padding:12px}.value{font-size:24px;font-weight:700;color:#0033A0}.label{font-size:12px;color:#64748B;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border-bottom:1px solid #E2E8F0;text-align:left;padding:8px;font-size:13px}th{background:#F8FAFC;color:#64748B}.section{break-inside:avoid}ul{padding-left:20px}@media print{button{display:none}body{margin:18mm}.grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<button onclick="window.print()">Imprimir</button>
<h1>Reporte Ejecutivo Bodega360</h1>
<div class="meta">Periodo: ${escapeHtml(data.range.label)} | Generado: ${new Date().toLocaleString('es-CL')}</div>
<div class="grid">
${[
    ['Busquedas', m.totalSearches],
    ['Con resultado', m.foundSearches],
    ['Sin resultado', m.missingSearches],
    ['Exito', `${m.successRate}%`],
    ['Materiales', m.materialCount],
    ['Calidad catalogo', `${m.avgQuality}%`],
    ['Minutos ahorrados', m.minutesSaved],
    ['Horas ahorradas', m.hoursSaved],
    ['Criticos sin stock', m.criticalNoStock],
    ['Costo vencido', m.costOutdated],
    ['Tickets abiertos', m.ticketsOpen],
    ['Tickets resueltos', m.ticketsResolved]
].map(([label, value]) => `<div class="card"><div class="value">${escapeHtml(value)}</div><div class="label">${escapeHtml(label)}</div></div>`).join('')}
</div>
<div class="section"><h2>Top 10 busquedas sin resultado</h2>${executiveTable(data.tops.topMissingSearches, ['Termino', 'Veces'])}</div>
<div class="section"><h2>Top 10 materiales mas consultados</h2>${executiveTable(data.tops.topMaterials, ['Material', 'Veces'])}</div>
<div class="section"><h2>Materiales criticos sin stock</h2>${executiveTable(data.tops.criticalNoStock, ['Material', ''])}</div>
<div class="section"><h2>Materiales con costo vencido</h2>${executiveTable(data.tops.costOutdated, ['Material', ''])}</div>
<div class="section"><h2>Recomendaciones</h2><ul>${recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>
<p class="meta">El tiempo ahorrado se calcula con busquedas con resultado x ${escapeHtml(data.settings.minutosAhorroPorConsulta || 2)} minutos por consulta. No se inventan datos: si no hay historial, las metricas quedan en cero.</p>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
    } else {
        downloadFile(html, `bodega360-reporte-ejecutivo-${Date.now()}.html`, 'text/html');
    }
}

function executiveTable(rows, headers) {
    if (!rows.length) return '<p class="meta">Sin datos suficientes.</p>';
    return `<table><thead><tr><th>${escapeHtml(headers[0])}</th><th>${escapeHtml(headers[1])}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.count ?? '')}</td></tr>`).join('')}</tbody></table>`;
}

document.getElementById('report-period')?.addEventListener('change', renderReports);
document.getElementById('report-start')?.addEventListener('change', renderReports);
document.getElementById('report-end')?.addEventListener('change', renderReports);
document.getElementById('setting-minutes-saved')?.addEventListener('change', (e) => {
    const settings = StorageAdapter.getSettings();
    settings.minutosAhorroPorConsulta = Math.max(1, Number(e.target.value || 2));
    StorageAdapter.saveSettings(settings);
    renderReports();
});
document.getElementById('btn-export-executive-report')?.addEventListener('click', exportExecutiveReport);
document.getElementById('btn-export-report-searches-csv')?.addEventListener('click', exportReportSearchesCsv);
document.getElementById('btn-export-report-missing-csv')?.addEventListener('click', exportReportMissingCsv);
document.getElementById('btn-export-report-incomplete-csv')?.addEventListener('click', exportReportIncompleteCsv);
document.getElementById('btn-export-report-critical-csv')?.addEventListener('click', exportReportCriticalCsv);
document.getElementById('btn-export-report-tickets-csv')?.addEventListener('click', exportReportTicketsCsv);
document.getElementById('btn-export-diagnostics-json')?.addEventListener('click', () => {
    downloadFile(JSON.stringify(buildDiagnosticsData(), null, 2), `bodega360-diagnostico-${Date.now()}.json`, 'application/json');
});
document.getElementById('btn-export-diagnostics-csv')?.addEventListener('click', exportDiagnosticsCsv);
document.getElementById('btn-backup-now')?.addEventListener('click', () => document.getElementById('btn-export-backup')?.click());
document.getElementById('reports-problems-container')?.addEventListener('click', (e) => {
    const open = e.target.closest('.report-open-material');
    const create = e.target.closest('.report-create-material');
    if (open) openDetailModal(open.dataset.codigo);
    if (create) createFromSearch(create.dataset.term);
});

document.getElementById('mat-foto-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handlePhotoFileSelection(file, (compressed) => {
        document.getElementById('mat-foto').value = compressed.dataUrl;
        document.getElementById('mat-foto-preview').src = compressed.dataUrl;
        document.getElementById('mat-foto-size').textContent = `Original ${Math.round(compressed.originalBytes / 1024)} KB -> comprimida ${Math.round(compressed.compressedBytes / 1024)} KB (${compressed.mime})`;
        document.getElementById('mat-foto-warning').textContent = 'Imagen comprimida guardada en localStorage solo para prototipo. En servidor interno usar ruta central.';
        document.getElementById('mat-foto-preview-container').classList.remove('hidden');
    }).finally(() => { e.target.value = ''; });
});

document.getElementById('btn-remove-photo')?.addEventListener('click', () => {
    document.getElementById('mat-foto-file').value = '';
    document.getElementById('mat-foto').value = '';
    document.getElementById('mat-foto-preview').removeAttribute('src');
    document.getElementById('mat-foto-preview-container').classList.add('hidden');
});

document.getElementById('mat-foto')?.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    if (!value) {
        document.getElementById('mat-foto-preview-container').classList.add('hidden');
        return;
    }
    document.getElementById('mat-foto-preview').src = value;
    document.getElementById('mat-foto-size').textContent = 'URL o imagen embebida';
    document.getElementById('mat-foto-preview-container').classList.remove('hidden');
});

document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('bodega360_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

document.getElementById('btn-toggle-consulta')?.addEventListener('click', () => {
    document.body.classList.toggle('consulta-mode');
    showToast(document.body.classList.contains('consulta-mode') ? 'Modo consulta ampliado' : 'Modo consulta normal');
});

document.getElementById('btn-import-data')?.addEventListener('click', () => {
    const input = document.getElementById('file-import-data');
    if (!input.files.length) return alert('Selecciona un archivo JSON o CSV.');
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const raw = file.name.endsWith('.csv') ? parseCSV(ev.target.result) : JSON.parse(ev.target.result);
            if (!Array.isArray(raw)) throw new Error('El archivo debe contener un arreglo de materiales.');
            const mode = document.getElementById('import-mode').value;
            const materials = StorageAdapter.getMaterials();
            let added = 0;
            let updated = 0;
            raw.map(normalizeMaterial).forEach(item => {
                if (!item.codigo || !item.nombre) return;
                const idx = materials.findIndex(m => String(m.codigo) === String(item.codigo));
                if (idx >= 0 && mode === 'update') {
                    materials[idx] = item;
                    updated++;
                } else if (idx < 0) {
                    materials.push(item);
                    added++;
                }
            });
            StorageAdapter.saveMaterials(materials);
            alert(`Importacion legacy completada. Nuevos: ${added}. Actualizados: ${updated}.`);
            input.value = '';
            refreshAdminViews();
            checkEmptyDBWarning();
        } catch (err) {
            alert(`Error de importacion: ${err.message}`);
        }
    };
    reader.readAsText(file);
});

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('btn-download-csv-template').addEventListener('click', () => {
    const csv = `codigo,codigoBarra,codigoAlternativo,nombre,descripcion,categoria,marca,modelo,unidadMedida,stock,stockMinimo,costoPromedio,fechaCostoPromedio,origenCosto,moneda,ubicacion,equipoAsociado,aliasBusqueda,estado,estadoRevision,observaciones,fotoPrincipal,fotosAdicionales,validado,esCritico\n001,780000000001,,Tornillo de prueba,Tornillo hex,Ferreteria,,,UN,100,10,50,2026-06-03,Excel,CLP,Estante 1,Equipo A,"perno,tornillo hex",Activo,Validado,,assets/fotos/001.webp,,true,false`;
    downloadFile(csv, "plantilla-bodega360.csv", "text/csv");
});

document.getElementById('btn-download-json-template').addEventListener('click', () => {
    const json = [
        { codigo: "001", codigoBarra: "780000000001", nombre: "Material Ejemplo 1", categoria: "Cat A", stock: 10, stockMinimo: 2, costoPromedio: 1500, fechaCostoPromedio: "2026-06-03", origenCosto: "Excel", moneda: "CLP", ubicacion: "Estante 1", aliasBusqueda: "ejemplo, prueba", fotoPrincipal: "assets/fotos/001.webp", fotosAdicionales: [], validado: true, esCritico: false },
        { codigo: "002", nombre: "Material Ejemplo 2", categoria: "Cat B", stock: 0, costoPromedio: 0, moneda: "CLP", validado: false, esCritico: true }
    ];
    downloadFile(JSON.stringify(json, null, 2), "plantilla-bodega360.json", "application/json");
});

// Init
if (localStorage.getItem('bodega360_theme') === 'dark') {
    document.body.classList.add('dark-mode');
}
checkEmptyDBWarning();
refreshAdminViews();
