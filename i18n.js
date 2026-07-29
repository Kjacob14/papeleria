// i18n.js
const I18N_DEFAULT_LANG = 'es';
let currentLang = localStorage.getItem('lang') || I18N_DEFAULT_LANG;
let translations = {};

// Cargar el JSON del idioma
async function loadTranslations(lang) {
  try {
    const res = await fetch(`./locales/${lang}.json`);
    if (!res.ok) throw new Error('No se pudo cargar el diccionario');
    translations = await res.json();
    currentLang = lang;
    localStorage.setItem('lang', lang);
    updateStaticDOM();
    
    // Avisar a app.js y admin.js que deben volver a renderizar sus componentes
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
  } catch (error) {
    console.error("Error i18n:", error);
  }
}

// Navegar por el objeto JSON usando la llave (ej: "nav.home")
function t(key) {
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== 'undefined') ? obj[k] : key, translations);
}

// Actualizar las etiquetas estáticas del HTML
function updateStaticDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
}

// Evento disparado desde el selector de idioma en el HTML
function changeLanguage(event) {
  loadTranslations(event.target.value);
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  const langSelector = document.getElementById('langSelector');
  if (langSelector) langSelector.value = currentLang;
  loadTranslations(currentLang);
});