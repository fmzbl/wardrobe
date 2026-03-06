import './style.css';
import {
  type Category,
  type ClothingItem,
  type Outfit,
  type SavedOutfit,
  CATEGORIES,
  CATEGORY_LABELS,
  EMPTY_OUTFIT,
} from './types';
import { getItems, addItem, removeItem, getOutfit, saveOutfit, getSavedOutfits, addSavedOutfit, removeSavedOutfit } from './store';
import { stripBackground } from './bgRemoval';

// ─── State ──────────────────────────────────────────────────────
interface State {
  items: ClothingItem[];
  outfit: Outfit;
  activeCategory: Category;
  modalOpen: boolean;
  uploading: boolean;
  uploadProgress: number;
  pendingFile: File | null;
  pendingPreviewUrl: string | null;
  savedOutfits: SavedOutfit[];
  savingOutfit: boolean;
}

const state: State = {
  items: [],
  outfit: { ...EMPTY_OUTFIT },
  activeCategory: 'head',
  modalOpen: false,
  uploading: false,
  uploadProgress: 0,
  pendingFile: null,
  pendingPreviewUrl: null,
  savedOutfits: [],
  savingOutfit: false,
};


// ─── Render ──────────────────────────────────────────────────────
function render() {
  const root = document.getElementById('app')!;
  root.innerHTML = html();
  bind();
}

function html(): string {
  const totalItems = state.items.length;
  const catItems = state.items.filter((i) => i.category === state.activeCategory);

  return `
<header>
  <span class="logo">Wardrobe</span>
  <span class="header-count">${totalItems} piece${totalItems !== 1 ? 's' : ''}</span>
  <div class="header-actions">
    <button id="btn-import" class="btn-ghost-sm">Import</button>
    <button id="btn-export" class="btn-ghost-sm">Export</button>
  </div>
</header>
<input type="file" id="import-input" accept=".json" style="display:none" />

<main>
  <!-- LEFT: human model -->
  <aside class="model-panel">
    <p class="model-label">Outfit</p>
    <div class="model-wrap">
      ${outfitOverlays()}
    </div>
    ${outfitActionsHTML()}
    ${savedOutfitsHTML()}
  </aside>

  <!-- RIGHT: inventory -->
  <section class="inventory-panel">
    <div class="category-tabs">
      ${CATEGORIES.map(
        (cat) => `
        <button class="cat-tab${cat === state.activeCategory ? ' active' : ''}" data-cat="${cat}">
          ${CATEGORY_LABELS[cat]}
        </button>`
      ).join('')}
    </div>

    <div class="inventory-grid-wrap">
      <div class="inventory-grid">
        ${catItems.map(itemCard).join('')}
        <button class="add-card" id="btn-add">
          <span class="add-icon">+</span>
          <span>Add</span>
        </button>
        ${catItems.length === 0 ? '<p class="empty-state">No items yet</p>' : ''}
      </div>
    </div>
  </section>
</main>

${modalHTML()}
`;
}

function outfitActionsHTML(): string {
  if (state.savingOutfit) {
    return `
<div class="outfit-save-form">
  <input type="text" id="outfit-name-input" placeholder="Outfit name" maxlength="60" />
  <div class="outfit-save-btns">
    <button id="btn-outfit-cancel" class="btn-ghost-sm">Cancel</button>
    <button id="btn-outfit-confirm" class="btn-outline-sm">Save</button>
  </div>
</div>`;
  }
  return `
<div class="outfit-actions">
  <button id="btn-save-outfit" class="btn-outline-sm">Save outfit</button>
  <button id="btn-download-outfit" class="btn-ghost-sm" title="Download outfit image">↓ Download</button>
</div>`;
}

function savedOutfitsHTML(): string {
  if (state.savedOutfits.length === 0) return '';
  const rows = state.savedOutfits
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(
      (o) => `
<div class="saved-row">
  <span class="saved-name">${o.name}</span>
  <div class="saved-row-btns">
    <button class="btn-load" data-load-id="${o.id}">Wear</button>
    <button class="btn-download-saved" data-download-saved="${o.id}" title="Download outfit image">↓</button>
    <button class="btn-delete-saved" data-delete-saved="${o.id}">×</button>
  </div>
</div>`
    )
    .join('');
  return `<div class="saved-outfits"><p class="saved-label">Saved</p>${rows}</div>`;
}

function outfitOverlays(): string {
  return CATEGORIES.map((cat) => {
    const itemId = state.outfit[cat];
    const item = itemId ? state.items.find((i) => i.id === itemId) : null;
    if (cat === 'shoes' && item) {
      return `<div class="outfit-overlay overlay-shoes">
        <div class="shoes-pair">
          <img src="${item.imageData}" alt="${item.name}" />
          <img src="${item.imageData}" alt="${item.name}" class="shoe-mirror" />
        </div>
      </div>`;
    }
    return `<div class="outfit-overlay overlay-${cat}">
      ${item ? `<img src="${item.imageData}" alt="${item.name}" />` : ''}
    </div>`;
  }).join('');
}

function itemCard(item: ClothingItem): string {
  const worn = state.outfit[item.category] === item.id;
  return `
<div class="item-card${worn ? ' worn' : ''}" data-id="${item.id}" data-cat="${item.category}">
  ${worn ? '<span class="worn-dot"></span>' : ''}
  <div class="item-thumb">
    <img src="${item.imageData}" alt="${item.name}" loading="lazy" />
  </div>
  <p class="item-name">${item.name}</p>
  <button class="item-delete" data-delete="${item.id}" title="Remove">×</button>
  <button class="item-download" data-download-item="${item.id}" title="Download">↓</button>
</div>`;
}

function modalHTML(): string {
  const catOpts = CATEGORIES.map(
    (c) =>
      `<option value="${c}"${c === state.activeCategory ? ' selected' : ''}>${CATEGORY_LABELS[c]}</option>`
  ).join('');

  return `
<div class="modal-backdrop${state.modalOpen ? '' : ' hidden'}" id="modal-backdrop">
  <div class="modal" role="dialog" aria-modal="true" aria-label="Add clothing item">
    <div class="modal-header">
      <span class="modal-title">Add item</span>
      <button class="modal-close" id="btn-modal-close" aria-label="Close">×</button>
    </div>
    <div class="modal-body">

      <!-- Drop zone / file input -->
      <label class="drop-zone" id="drop-zone">
        ${
          state.pendingPreviewUrl
            ? `<img class="drop-preview" src="${state.pendingPreviewUrl}" alt="preview" />`
            : `<span class="drop-zone-icon">↑</span><span>Click or drop image</span>`
        }
        <input type="file" id="file-input" accept="image/*" />
      </label>

      <!-- Name -->
      <div class="field">
        <label for="name-input">Name</label>
        <input type="text" id="name-input" placeholder="e.g. White tee" maxlength="60" />
      </div>

      <!-- Category -->
      <div class="field">
        <label for="cat-select">Category</label>
        <select id="cat-select">${catOpts}</select>
      </div>

      <!-- Progress bar (shown while uploading) -->
      ${
        state.uploading
          ? `<div class="progress-wrap">
               <p class="progress-label">Removing background… ${state.uploadProgress}%</p>
               <div class="progress-bar-bg">
                 <div class="progress-bar" style="width:${state.uploadProgress}%"></div>
               </div>
             </div>`
          : ''
      }

      <button class="btn-submit" id="btn-save" ${state.uploading || !state.pendingFile ? 'disabled' : ''}>
        ${state.uploading ? 'Processing…' : 'Save item'}
      </button>
    </div>
  </div>
</div>`;
}

// ─── Bind events ─────────────────────────────────────────────────
function bind() {
  // Category tabs
  document.querySelectorAll<HTMLButtonElement>('.cat-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.cat as Category;
      render();
    });
  });

  // Item cards — toggle worn
  document.querySelectorAll<HTMLDivElement>('.item-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.item-delete')) return;
      const { id, cat } = card.dataset as { id: string; cat: Category };
      const current = state.outfit[cat];
      state.outfit = { ...state.outfit, [cat]: current === id ? null : id };
      saveOutfit(state.outfit);
      updateModelOverlays();
      // Update card active states in-place (no full re-render needed)
      refreshCards(cat);
    });
  });

  // Delete buttons
  document.querySelectorAll<HTMLButtonElement>('.item-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete!;
      await removeItem(id);
      // Un-wear if worn
      CATEGORIES.forEach((cat) => {
        if (state.outfit[cat] === id) state.outfit = { ...state.outfit, [cat]: null };
      });
      await saveOutfit(state.outfit);
      state.items = await getItems();
      render();
    });
  });

  // Open modal
  document.getElementById('btn-add')?.addEventListener('click', () => {
    state.modalOpen = true;
    state.pendingFile = null;
    state.pendingPreviewUrl = null;
    render();
  });

  // Close modal
  document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // File input
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) onFileSelected(file);
  });

  // Drag and drop
  const dropZone = document.getElementById('drop-zone');
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) onFileSelected(file);
  });

  // Save clothing item
  document.getElementById('btn-save')?.addEventListener('click', handleSave);

  // Save outfit
  document.getElementById('btn-save-outfit')?.addEventListener('click', () => {
    state.savingOutfit = true;
    render();
    document.getElementById('outfit-name-input')?.focus();
  });

  document.getElementById('btn-outfit-cancel')?.addEventListener('click', () => {
    state.savingOutfit = false;
    render();
  });

  document.getElementById('btn-outfit-confirm')?.addEventListener('click', handleSaveOutfit);

  (document.getElementById('outfit-name-input') as HTMLInputElement | null)?.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') handleSaveOutfit();
      if (e.key === 'Escape') { state.savingOutfit = false; render(); }
    }
  );

  // Load saved outfit
  document.querySelectorAll<HTMLButtonElement>('.btn-load').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.loadId!;
      const saved = state.savedOutfits.find((o) => o.id === id);
      if (!saved) return;
      state.outfit = Object.fromEntries(
        CATEGORIES.map((cat) => [
          cat,
          saved.items[cat] && state.items.some((i) => i.id === saved.items[cat])
            ? saved.items[cat]
            : null,
        ])
      ) as Outfit;
      await saveOutfit(state.outfit);
      updateModelOverlays();
      CATEGORIES.forEach((cat) => refreshCards(cat));
    });
  });

  // Export
  document.getElementById('btn-export')?.addEventListener('click', handleExport);

  // Import
  document.getElementById('btn-import')?.addEventListener('click', () => {
    (document.getElementById('import-input') as HTMLInputElement).click();
  });
  (document.getElementById('import-input') as HTMLInputElement | null)?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleImport(file);
    (e.target as HTMLInputElement).value = '';
  });

  // Download item
  document.querySelectorAll<HTMLButtonElement>('.item-download').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadItem(btn.dataset.downloadItem!);
    });
  });

  // Download current outfit
  document.getElementById('btn-download-outfit')?.addEventListener('click', async () => {
    await downloadOutfit(state.outfit, 'outfit');
  });

  // Download saved outfit
  document.querySelectorAll<HTMLButtonElement>('.btn-download-saved').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.downloadSaved!;
      const saved = state.savedOutfits.find((o) => o.id === id);
      if (!saved) return;
      await downloadOutfit(saved.items, saved.name);
    });
  });

  // Delete saved outfit
  document.querySelectorAll<HTMLButtonElement>('.btn-delete-saved').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteSaved!;
      await removeSavedOutfit(id);
      state.savedOutfits = await getSavedOutfits();
      render();
    });
  });

  // Auto-fill name from filename
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      if (!nameInput.value) {
        nameInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      }
    }
  });
}

function closeModal() {
  if (state.uploading) return;
  state.modalOpen = false;
  state.pendingFile = null;
  state.pendingPreviewUrl = null;
  render();
}

function onFileSelected(file: File) {
  state.pendingFile = file;
  state.pendingPreviewUrl = URL.createObjectURL(file);
  // Re-render just the modal body
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) {
    backdrop.outerHTML = modalHTML();
    // re-bind modal events since we replaced the HTML
    bindModal();
  }
}

function bindModal() {
  document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) onFileSelected(file);
  });

  const dropZone = document.getElementById('drop-zone');
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) onFileSelected(file);
  });

  const nameInput = document.getElementById('name-input') as HTMLInputElement | null;
  fileInput?.addEventListener('change', () => {
    const file = fileInput?.files?.[0];
    if (file && nameInput && !nameInput.value) {
      nameInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }
  });

  document.getElementById('btn-save')?.addEventListener('click', handleSave);
}

async function handleSave() {
  const nameInput = document.getElementById('name-input') as HTMLInputElement;
  const catSelect = document.getElementById('cat-select') as HTMLSelectElement;

  const name = nameInput?.value.trim();
  const category = catSelect?.value as Category;

  if (!state.pendingFile || !name || !category) return;

  state.uploading = true;
  state.uploadProgress = 0;
  renderModalProgress();

  try {
    const imageData = await stripBackground(state.pendingFile, (pct) => {
      state.uploadProgress = pct;
      updateProgressBar(pct);
    });

    const item: ClothingItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      category,
      imageData,
      createdAt: Date.now(),
    };

    await addItem(item);
    state.items = await getItems();
    state.modalOpen = false;
    state.uploading = false;
    state.pendingFile = null;
    state.pendingPreviewUrl = null;
    state.activeCategory = category;
    render();
  } catch (err) {
    console.error('Background removal failed:', err);
    state.uploading = false;
    state.uploadProgress = 0;
    alert('Failed to process image. Please try a different file.');
    render();
  }
}

async function handleSaveOutfit() {
  const nameInput = document.getElementById('outfit-name-input') as HTMLInputElement | null;
  const name = nameInput?.value.trim();
  if (!name) { nameInput?.focus(); return; }

  const saved: SavedOutfit = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    items: { ...state.outfit },
    createdAt: Date.now(),
  };
  await addSavedOutfit(saved);
  state.savedOutfits = await getSavedOutfits();
  state.savingOutfit = false;
  render();
}

function renderModalProgress() {
  const progressWrap = document.querySelector<HTMLDivElement>('.progress-wrap');
  const btn = document.getElementById('btn-save') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  if (btn) btn.textContent = 'Processing…';

  if (!progressWrap) {
    // Inject progress bar before the button
    const body = document.querySelector('.modal-body');
    if (body && btn) {
      const div = document.createElement('div');
      div.className = 'progress-wrap';
      div.innerHTML = `
        <p class="progress-label">Removing background… 0%</p>
        <div class="progress-bar-bg">
          <div class="progress-bar" style="width:0%"></div>
        </div>`;
      body.insertBefore(div, btn);
    }
  }
}

function updateProgressBar(pct: number) {
  const bar = document.querySelector<HTMLDivElement>('.progress-bar');
  const label = document.querySelector<HTMLParagraphElement>('.progress-label');
  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = `Removing background… ${pct}%`;
}

function updateModelOverlays() {
  CATEGORIES.forEach((cat) => {
    const overlay = document.querySelector<HTMLDivElement>(`.overlay-${cat}`);
    if (!overlay) return;
    const itemId = state.outfit[cat];
    const item = itemId ? state.items.find((i) => i.id === itemId) : null;
    if (cat === 'shoes') {
      overlay.innerHTML = item
        ? `<div class="shoes-pair"><img src="${item.imageData}" alt="${item.name}" /><img src="${item.imageData}" alt="${item.name}" class="shoe-mirror" /></div>`
        : '';
    } else {
      overlay.innerHTML = item ? `<img src="${item.imageData}" alt="${item.name}" />` : '';
    }
  });
}

function refreshCards(cat: Category) {
  const wornId = state.outfit[cat];
  document.querySelectorAll<HTMLDivElement>(`.item-card[data-cat="${cat}"]`).forEach((card) => {
    const isWorn = card.dataset.id === wornId;
    card.classList.toggle('worn', isWorn);
    // worn dot
    let dot = card.querySelector<HTMLSpanElement>('.worn-dot');
    if (isWorn && !dot) {
      dot = document.createElement('span');
      dot.className = 'worn-dot';
      card.prepend(dot);
    } else if (!isWorn && dot) {
      dot.remove();
    }
  });
}

// ─── Export / Import ────────────────────────────────────────────
interface WardrobeExport {
  version: number;
  exportedAt: number;
  items: ClothingItem[];
  savedOutfits: SavedOutfit[];
}

async function handleExport() {
  const [items, savedOutfits] = await Promise.all([getItems(), getSavedOutfits()]);
  const payload: WardrobeExport = { version: 1, exportedAt: Date.now(), items, savedOutfits };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wardrobe-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImport(file: File) {
  let payload: WardrobeExport;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    alert('Invalid file — could not parse JSON.');
    return;
  }
  if (payload.version !== 1 || !Array.isArray(payload.items) || !Array.isArray(payload.savedOutfits)) {
    alert('Unrecognised export format.');
    return;
  }

  const existingIds = new Set(state.items.map((i) => i.id));
  const existingSavedIds = new Set(state.savedOutfits.map((o) => o.id));

  let addedItems = 0;
  let addedOutfits = 0;

  for (const item of payload.items) {
    if (!existingIds.has(item.id) && item.id && item.name && item.category && item.imageData) {
      await addItem(item);
      addedItems++;
    }
  }
  for (const outfit of payload.savedOutfits) {
    if (!existingSavedIds.has(outfit.id) && outfit.id && outfit.name && outfit.items) {
      await addSavedOutfit(outfit);
      addedOutfits++;
    }
  }

  [state.items, state.savedOutfits] = await Promise.all([getItems(), getSavedOutfits()]);
  render();
  alert(`Imported ${addedItems} item${addedItems !== 1 ? 's' : ''} and ${addedOutfits} outfit${addedOutfits !== 1 ? 's' : ''}.`);
}

// ─── Download ───────────────────────────────────────────────────
function downloadItem(id: string) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const a = document.createElement('a');
  a.href = item.imageData;
  a.download = `${item.name}.png`;
  a.click();
}

async function downloadOutfit(outfit: Outfit, name: string) {
  const dataUrl = await generateOutfitImage(outfit);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${name}.png`;
  a.click();
}

async function generateOutfitImage(outfit: Outfit): Promise<string> {
  const W = 400, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const zones: Array<{ cat: Category; grow: number }> = [
    { cat: 'head', grow: 18 },
    { cat: 'torso', grow: 42 },
    { cat: 'legs', grow: 38 },
    { cat: 'shoes', grow: 14 },
  ];
  const totalGrow = zones.reduce((s, z) => s + z.grow, 0);

  let y = 0;
  for (const zone of zones) {
    const zoneH = Math.round((zone.grow / totalGrow) * H);
    const itemId = outfit[zone.cat];
    const item = itemId ? state.items.find((i) => i.id === itemId) : null;
    if (item) {
      await drawImageInZone(ctx, item.imageData, W, zoneH, y, zone.cat === 'shoes');
    }
    y += zoneH;
  }

  return canvas.toDataURL('image/png');
}

function drawImageInZone(
  ctx: CanvasRenderingContext2D,
  src: string,
  W: number,
  zoneH: number,
  zoneY: number,
  shoes: boolean
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (shoes) {
        const halfW = W / 2;
        const scale = Math.min(halfW / img.width, zoneH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (halfW - dw) / 2;
        const dy = (zoneH - dh) / 2;
        // Left shoe
        ctx.drawImage(img, dx, zoneY + dy, dw, dh);
        // Right shoe (mirrored)
        ctx.save();
        ctx.translate(W, zoneY);
        ctx.scale(-1, 1);
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      } else {
        const scale = Math.min(W / img.width, zoneH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (W - dw) / 2;
        const dy = (zoneH - dh) / 2;
        ctx.drawImage(img, dx, zoneY + dy, dw, dh);
      }
      resolve();
    };
    img.src = src;
  });
}

// ─── Bootstrap ──────────────────────────────────────────────────
async function init() {
  [state.items, state.outfit, state.savedOutfits] = await Promise.all([
    getItems(),
    getOutfit(),
    getSavedOutfits(),
  ]);
  render();
}

init();
