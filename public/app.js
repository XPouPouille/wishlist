const grid = document.getElementById('grid');
const modal = document.getElementById('modal');
const inputUrl = document.getElementById('inputUrl');
const inputTitle = document.getElementById('inputTitle');
const previewZone = document.getElementById('previewZone');
const previewImg = document.getElementById('previewImg');
const previewTitle = document.getElementById('previewTitle');
const loadingMsg = document.getElementById('loadingMsg');
const confirmBtn = document.getElementById('confirmBtn');
const viewToggle = document.getElementById('viewToggle');
const viewLabel = document.getElementById('viewLabel');
const viewIcon = document.getElementById('viewIcon');

let items = [];
let showingReserved = false;
let fetchTimeout = null;
let pendingOg = null;

async function loadItems() {
  const res = await fetch('/api/wishlist');
  items = await res.json();
  render();
}

function render() {
  grid.innerHTML = '';
  const visible = showingReserved ? items.filter(i => i.toggled) : items;

  if (visible.length === 0 && showingReserved) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span class="emoji">🎁</span><p>Aucun article réservé pour l\'instant.</p>';
    grid.appendChild(empty);
  } else {
    visible.forEach(item => grid.appendChild(createCard(item)));
  }

  if (!showingReserved) grid.appendChild(createAddCard());
}

function createCard(item) {
  const card = document.createElement('div');
  card.className = 'card' + (item.toggled ? ' toggled' : '');
  card.dataset.id = item.id;

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-img-wrap';

  if (item.image) {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = item.image;
    img.alt = item.title || '';
    img.onerror = () => { imgWrap.innerHTML = '<div class="card-img-placeholder">🛒</div>'; };
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = '<div class="card-img-placeholder">🛒</div>';
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = item.title || new URL(item.url).hostname;

  const link = document.createElement('a');
  link.className = 'card-link';
  link.href = item.toggled ? '#' : item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = item.url;

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'toggle-wrap';

  const toggleLabel = document.createElement('label');
  toggleLabel.textContent = item.toggled ? 'Réservé' : 'Disponible';
  toggleLabel.htmlFor = `toggle-${item.id}`;

  const toggleLabel2 = document.createElement('label');
  toggleLabel2.className = 'toggle';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `toggle-${item.id}`;
  checkbox.checked = item.toggled;
  checkbox.addEventListener('change', () => toggleItem(item.id, checkbox.checked));

  const slider = document.createElement('span');
  slider.className = 'toggle-slider';

  toggleLabel2.appendChild(checkbox);
  toggleLabel2.appendChild(slider);
  toggleWrap.appendChild(toggleLabel);
  toggleWrap.appendChild(toggleLabel2);

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.title = 'Supprimer';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', () => deleteItem(item.id));

  footer.appendChild(toggleWrap);
  footer.appendChild(delBtn);

  body.appendChild(title);
  body.appendChild(link);
  body.appendChild(footer);

  card.appendChild(imgWrap);
  card.appendChild(body);
  return card;
}

function createAddCard() {
  const card = document.createElement('div');
  card.className = 'card card-add';
  card.innerHTML = `<div class="card-add-inner"><span class="plus">+</span><span>Ajouter un article</span></div>`;
  card.addEventListener('click', openModal);
  return card;
}

async function toggleItem(id, toggled) {
  await fetch(`/api/wishlist/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toggled })
  });
  const item = items.find(i => i.id === id);
  if (item) item.toggled = toggled;
  render();
}

async function deleteItem(id) {
  await fetch(`/api/wishlist/${id}`, { method: 'DELETE' });
  items = items.filter(i => i.id !== id);
  render();
}

function openModal() {
  modal.classList.remove('hidden');
  inputUrl.value = '';
  inputTitle.value = '';
  pendingOg = null;
  previewZone.classList.add('hidden');
  loadingMsg.classList.add('hidden');
  confirmBtn.disabled = true;
  const errMsg = document.getElementById('addError');
  if (errMsg) errMsg.classList.add('hidden');
  inputUrl.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  clearTimeout(fetchTimeout);
}

document.getElementById('cancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

inputUrl.addEventListener('input', () => {
  clearTimeout(fetchTimeout);
  const val = inputUrl.value.trim();
  confirmBtn.disabled = !val;
  if (!val) {
    previewZone.classList.add('hidden');
    loadingMsg.classList.add('hidden');
    return;
  }
  try { new URL(val); } catch { return; }
  loadingMsg.classList.remove('hidden');
  previewZone.classList.add('hidden');
  fetchTimeout = setTimeout(() => fetchOg(val), 800);
});

async function fetchOg(url) {
  try {
    const res = await fetch(`/api/og-image?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    pendingOg = data;
    loadingMsg.classList.add('hidden');
    if (data.image || data.title) {
      previewImg.src = data.image || '';
      previewImg.style.display = data.image ? '' : 'none';
      previewTitle.textContent = data.title || '';
      previewZone.classList.remove('hidden');
      if (data.title && !inputTitle.value) inputTitle.value = data.title;
    }
  } catch {
    loadingMsg.classList.add('hidden');
  }
}

confirmBtn.addEventListener('click', async () => {
  const url = inputUrl.value.trim();
  if (!url) return;

  let hostname = url;
  try { hostname = new URL(url).hostname; } catch {}
  const title = inputTitle.value.trim() || pendingOg?.title || hostname;
  const image = pendingOg?.image || null;

  confirmBtn.disabled = true;
  confirmBtn.textContent = '⏳ Ajout…';

  try {
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, image })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const item = await res.json();
    items.push(item);
    closeModal();
    render();
  } catch (err) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Ajouter';
    const errMsg = document.getElementById('addError');
    if (errMsg) { errMsg.textContent = '⚠️ Erreur : ' + err.message; errMsg.classList.remove('hidden'); }
  }
  confirmBtn.textContent = 'Ajouter';
});

viewToggle.addEventListener('click', () => {
  showingReserved = !showingReserved;
  viewToggle.classList.toggle('active', showingReserved);
  viewLabel.textContent = showingReserved ? 'Voir tout' : 'Voir les réservés';
  viewIcon.textContent = showingReserved ? '📋' : '🎁';
  render();
});

loadItems();
