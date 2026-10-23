// Marcador para sacar tu armario de Fragrantica. Fragrantica no lo exporta y la lista llega cifrada,
// así que se ejecuta en tu navegador, en tu perfil: abre la pestaña Armario, lee los enlaces de cada
// sección y los deja en el formato de Ajustes → Importar ("enlace;estado", uno por línea).

// Tiene que ser autónoma (no puede usar nada de fuera): se convierte en texto para el marcador
function wardrobeScript() {
  const run = async () => {
    const tab = [...document.querySelectorAll('[role=tab], button')]
      .find((t) => /^(armario|wardrobe)\s*\d*$/i.test(t.innerText.trim()));
    if (!tab) return alert('Abre tu perfil de Fragrantica (fragrantica.es/@tu-usuario) y vuelve a pulsar el marcador.');
    tab.click();
    await new Promise((r) => setTimeout(r, 2500));

    // "Fragancias que tengo…", "…he tenido anteriormente", "…quiero tener…", "Quiero probarla"
    const statusOf = (h) => {
      const t = h.toLowerCase();
      if (/he tenido|\bhad\b/.test(t)) return 'tuve';
      if (/tengo|\bhave\b/.test(t)) return 'tengo';
      return 'quiero';
    };
    const rank = { tengo: 3, tuve: 2, quiero: 1 }; // si está en dos secciones, gana la primera
    const found = new Map();
    const panels = [...document.querySelectorAll('[role=tabpanel]')].filter((p) => p.offsetParent && p.querySelector('h4'));
    for (const panel of panels) {
      let status = null;
      for (const el of panel.querySelectorAll('h4, a[href*="/perfume/"]')) {
        if (el.tagName === 'H4') { status = statusOf(el.innerText); continue; }
        if (!status) continue;
        const url = el.href.split(/[?#]/)[0];
        if (!found.has(url) || rank[status] > rank[found.get(url)]) found.set(url, status);
      }
    }
    if (!found.size) return alert('No encuentro perfumes en tu armario. Espera a que cargue la página y vuelve a pulsar el marcador.');

    const text = [...found].map(([url, status]) => `${url};${status}`).join('\n');
    document.getElementById('perfumario-armario')?.remove();
    const box = document.createElement('div');
    box.id = 'perfumario-armario';
    box.style.cssText = 'position:fixed;inset:16px;z-index:2147483647;background:#fff;color:#111;border-radius:12px;'
      + 'box-shadow:0 8px 40px rgba(0,0,0,.4);padding:16px;display:flex;flex-direction:column;gap:10px;font:15px system-ui';
    box.innerHTML = `<b>${found.size} perfumes. Cópialos y pégalos en Ajustes → Importar.</b>`
      + '<textarea readonly style="flex:1;font:12px monospace;color:#111;background:#f4f4f4"></textarea>'
      + '<div style="display:flex;gap:8px"><button style="flex:1;padding:12px;font-size:16px">Copiar</button>'
      + '<button style="padding:12px;font-size:16px">Cerrar</button></div>';
    const [area] = box.getElementsByTagName('textarea');
    const [copy, close] = box.getElementsByTagName('button');
    area.value = text;
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(text); } catch { area.select(); document.execCommand('copy'); }
      copy.textContent = 'Copiado ✓';
    };
    close.onclick = () => box.remove();
    document.body.appendChild(box);
  };
  run();
}

export const WARDROBE_BOOKMARKLET = `javascript:${encodeURIComponent(`(${wardrobeScript})()`)}`;
