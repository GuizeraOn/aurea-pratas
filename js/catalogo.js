// ============================================================
//  AUREA PRATAS — js/catalogo.js
// ============================================================

let todasPecas = []
let carrinho   = []   // [{ ...peca, quantidade: N }]
let catAtiva   = 'todos'

const CATEGORIAS = { aneis:'Anéis', colares:'Colares', brincos:'Brincos', pulseiras:'Pulseiras' }
const SETE_DIAS  = 7 * 24 * 60 * 60 * 1000

// ── Elementos ────────────────────────────────────────────────
const grid         = document.getElementById('catalogGrid')
const cartCountEl  = document.getElementById('cartCount')
const cartDrawer   = document.getElementById('cartDrawer')
const cartOverlay  = document.getElementById('cartOverlay')
const cartItemsEl  = document.getElementById('cartItems')
const cartFooterEl = document.getElementById('cartFooter')
const cartTotalEl  = document.getElementById('cartTotal')
const toastEl      = document.getElementById('toast')

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  carregarPecas()
  document.getElementById('cartOpenBtn').addEventListener('click', abrirCarrinho)
  document.getElementById('cartCloseBtn').addEventListener('click', fecharCarrinho)
  document.getElementById('cartOverlay').addEventListener('click', fecharCarrinho)
  document.getElementById('whatsappBtn').addEventListener('click', finalizarWhatsapp)
  document.getElementById('filtersContainer').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn')
    if (!btn) return
    document.querySelectorAll('#filtersContainer .filter-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    catAtiva = btn.dataset.cat
    renderGrid()
  })
})

// ── Carregar ──────────────────────────────────────────────────
async function carregarPecas() {
  try {
    const { data, error } = await db.from('pecas').select('*').eq('visivel', true).or('estoque.gt.0,estoque.is.null').order('created_at', { ascending: false })
    if (error) throw error
    todasPecas = data || []
    renderGrid()
  } catch {
    grid.innerHTML = `<div class="empty-state"><p>Erro ao carregar o catálogo. Tente recarregar a página.</p></div>`
  }
}

// ── Grid ──────────────────────────────────────────────────────
function renderGrid() {
  const filtradas = catAtiva === 'todos' ? todasPecas : todasPecas.filter(p => p.categoria === catAtiva)
  if (filtradas.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>Nenhuma peça nessa categoria.</p></div>`
    return
  }
  grid.innerHTML = filtradas.map(p => cardHTML(p)).join('')
}

// ── Card HTML ─────────────────────────────────────────────────
function cardHTML(peca) {
  const noCarrinho = carrinho.some(c => c.id === peca.id)
  const catLabel   = CATEGORIAS[peca.categoria] || peca.categoria
  const isNova     = (Date.now() - new Date(peca.created_at).getTime()) < SETE_DIAS
  const esgotada   = peca.estoque != null && peca.estoque === 0
  const poucasUn   = peca.estoque != null && peca.estoque > 0 && peca.estoque <= 3

  // Fotos disponíveis
  const fotos = [peca.foto_path, peca.foto_2, peca.foto_3, peca.foto_4]
    .filter(Boolean)
    .map(p => fotoPublica(p))
  const fotoAtual = fotos[0] || 'https://placehold.co/400x400/e8e8e4/888?text=Foto'

  const dotsHTML = fotos.length > 1
    ? `<div class="card-dots">${fotos.map((_,i) => `<div class="card-dot ${i===0?'active':''}" data-i="${i}"></div>`).join('')}</div>`
    : ''

  const carouselBtns = fotos.length > 1
    ? `<button class="card-carousel-btn prev" onclick="carouselCard(event,'${peca.id}',-1)">‹</button>
       <button class="card-carousel-btn next" onclick="carouselCard(event,'${peca.id}',1)">›</button>`
    : ''

  return `
    <article class="product-card" data-id="${peca.id}" data-foto-idx="0" data-fotos='${JSON.stringify(fotos)}'>
      <div class="card-img-wrap" onclick="abrirModal('${peca.id}')">
        <img id="card-img-${peca.id}" src="${fotoAtual}" alt="${peca.nome}" loading="lazy"
          onerror="this.src='https://placehold.co/400x400/e8e8e4/888?text=Foto'" />
        <span class="card-badge">${catLabel}</span>
        ${isNova ? '<span class="badge-new">✦ Novo</span>' : ''}
        ${poucasUn ? '<div class="badge-low">⚠️ Últimas unidades!</div>' : ''}
        ${esgotada ? '<div class="badge-out">Esgotada</div>' : ''}
        ${carouselBtns}
        ${dotsHTML}
        ${!esgotada ? `
        <button class="card-add-btn ${noCarrinho?'added':''}"
          onclick="toggleCarrinho(event,'${peca.id}')"
          title="${noCarrinho?'Remover da lista':'Adicionar à lista'}">
          ${noCarrinho ? iconeCheck() : iconePlus()}
        </button>` : ''}
      </div>
      <div class="card-info" onclick="abrirModal('${peca.id}')" style="cursor:pointer">
        <div class="card-name">${peca.nome}</div>
        <div class="card-price">${formatarPreco(peca.preco)}</div>
      </div>
    </article>`
}

// ── Carrossel no card ─────────────────────────────────────────
function carouselCard(e, id, dir) {
  e.stopPropagation()
  const card  = document.querySelector(`[data-id="${id}"]`)
  const fotos = JSON.parse(card.dataset.fotos)
  let idx     = parseInt(card.dataset.fotoIdx) + dir
  if (idx < 0) idx = fotos.length - 1
  if (idx >= fotos.length) idx = 0
  card.dataset.fotoIdx = idx
  document.getElementById(`card-img-${id}`).src = fotos[idx]
  card.querySelectorAll('.card-dot').forEach((d, i) => d.classList.toggle('active', i === idx))
}

// ── Modal de detalhe ──────────────────────────────────────────
function abrirModal(id) {
  const peca = todasPecas.find(p => p.id === id)
  if (!peca) return

  const fotos = [peca.foto_path, peca.foto_2, peca.foto_3, peca.foto_4]
    .filter(Boolean).map(p => fotoPublica(p))
  if (!fotos.length) fotos.push('https://placehold.co/600x600/e8e8e4/888?text=Foto')

  let fotoIdx = 0
  const noCarrinho = carrinho.some(c => c.id === peca.id)
  const esgotada   = peca.estoque != null && peca.estoque === 0
  const catLabel   = CATEGORIAS[peca.categoria] || peca.categoria

  const estoqueHTML = peca.estoque == null ? ''
    : peca.estoque === 0 ? `<div class="modal-estoque low">❌ Esgotada</div>`
    : peca.estoque <= 3  ? `<div class="modal-estoque low">⚠️ Últimas ${peca.estoque} unidades!</div>`
    : `<div class="modal-estoque ok">✅ Em estoque (${peca.estoque} un.)</div>`

  const thumbsHTML = fotos.length > 1
    ? fotos.map((f,i) => `<img class="modal-thumb ${i===0?'active':''}" src="${f}" data-i="${i}" onclick="trocarFotoModal(${i})" />`).join('')
    : ''

  const navHTML = fotos.length > 1
    ? `<div class="modal-gallery-nav">
        <button class="modal-nav-btn" onclick="navModal(-1)">‹</button>
        <button class="modal-nav-btn" onclick="navModal(1)">›</button>
       </div>
       <div class="modal-thumbs">${thumbsHTML}</div>`
    : ''

  const imagensHTML = fotos.map(f => `<img src="${f}" alt="${peca.nome}" loading="lazy" />`).join('')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'pecaModal'
  overlay.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" onclick="fecharModal()">✕</button>
      <div class="modal-inner">
        <div class="modal-gallery">
          <div class="modal-gallery-scroll" id="modalGalleryScroll" onscroll="atualizarPontoModal()">
            ${imagensHTML}
          </div>
          ${navHTML}
        </div>
        <div class="modal-info">
          <div class="modal-badge">${catLabel}</div>
          <div class="modal-name">${peca.nome}</div>
          <div class="modal-price">${formatarPreco(peca.preco)}</div>
          <div class="modal-divider"></div>
          <div class="modal-desc">${peca.descricao || 'Peça em prata 925, acabamento polido de alta qualidade.'}</div>
          ${estoqueHTML}
          ${!esgotada ? `
          <button class="modal-add-btn ${noCarrinho?'added':''}" id="modalAddBtn" onclick="toggleCarrinhoModal('${peca.id}')">
            ${noCarrinho ? '✓ Na sua lista' : '+ Adicionar à lista'}
          </button>` : `<div style="margin-top:24px;text-align:center;color:var(--red);font-weight:600">Peça esgotada</div>`}
        </div>
      </div>
    </div>`

  // Navegação interna do modal
  overlay._fotos  = fotos
  overlay._fotoIdx = 0

  overlay.addEventListener('click', e => { if (e.target === overlay) fecharModal() })
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  document.body.style.overflow = 'hidden'

  // Teclado
  overlay._keyHandler = e => {
    if (e.key === 'Escape') fecharModal()
    if (e.key === 'ArrowRight') navModal(1)
    if (e.key === 'ArrowLeft')  navModal(-1)
  }
  document.addEventListener('keydown', overlay._keyHandler)
}

function navModal(dir) {
  const overlay = document.getElementById('pecaModal')
  if (!overlay) return
  let idx = overlay._fotoIdx + dir
  if (idx < 0) idx = overlay._fotos.length - 1
  if (idx >= overlay._fotos.length) idx = 0
  trocarFotoModal(idx)
}

function trocarFotoModal(idx) {
  const overlay = document.getElementById('pecaModal')
  const scroll = document.getElementById('modalGalleryScroll')
  if (!overlay || !scroll) return
  overlay._fotoIdx = idx
  scroll.scrollTo({ left: scroll.clientWidth * idx, behavior: 'smooth' })
  overlay.querySelectorAll('.modal-thumb').forEach((t,i) => t.classList.toggle('active', i === idx))
}

function atualizarPontoModal() {
  const overlay = document.getElementById('pecaModal')
  const scroll = document.getElementById('modalGalleryScroll')
  if (!overlay || !scroll) return
  const idx = Math.round(scroll.scrollLeft / scroll.clientWidth)
  if (idx !== overlay._fotoIdx) {
    overlay._fotoIdx = idx
    overlay.querySelectorAll('.modal-thumb').forEach((t,i) => t.classList.toggle('active', i === idx))
  }
}

function fecharModal() {
  const overlay = document.getElementById('pecaModal')
  if (!overlay) return
  document.removeEventListener('keydown', overlay._keyHandler)
  overlay.classList.remove('open')
  setTimeout(() => { overlay.remove(); document.body.style.overflow = '' }, 300)
}

function toggleCarrinhoModal(id) {
  toggleCarrinho(null, id)
  const btn = document.getElementById('modalAddBtn')
  if (btn) {
    const noCarrinho = carrinho.some(c => c.id === id)
    btn.textContent = noCarrinho ? '✓ Na sua lista' : '+ Adicionar à lista'
    btn.classList.toggle('added', noCarrinho)
  }
}

// ── Carrinho ──────────────────────────────────────────────────
function toggleCarrinho(e, id) {
  if (e) e.stopPropagation()
  const peca = todasPecas.find(p => p.id === id)
  if (!peca) return

  const idx = carrinho.findIndex(c => c.id === id)
  if (idx === -1) {
    carrinho.push({ ...peca, quantidade: 1 })
    showToast(`"${peca.nome}" adicionado ✓`, 'success')
    registrarEvento(id, 'adicionou')
  } else {
    carrinho.splice(idx, 1)
    showToast(`"${peca.nome}" removido`)
    registrarEvento(id, 'removeu')
  }

  atualizarContadorCarrinho()
  renderGrid()
  renderCarrinho()
}

function alterarQuantidade(id, delta) {
  const item = carrinho.find(c => c.id === id)
  if (!item) return
  item.quantidade = Math.max(1, item.quantidade + delta)
  renderCarrinho()
}

function atualizarContadorCarrinho() {
  const n = carrinho.reduce((s, c) => s + c.quantidade, 0)
  cartCountEl.textContent = n
  cartCountEl.classList.toggle('hidden', n === 0)
}

function renderCarrinho() {
  if (carrinho.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty-msg">
        <svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        <p>Sua lista está vazia.<br>Adicione peças que você gostou!</p>
      </div>`
    cartFooterEl.style.display = 'none'
    return
  }

  cartItemsEl.innerHTML = carrinho.map(peca => `
    <div class="cart-item">
      <img class="cart-item-img" src="${fotoPublica(peca.foto_path)}" alt="${peca.nome}"
        onerror="this.src='https://placehold.co/64x64/e8e8e4/888?text=?'" />
      <div class="cart-item-info">
        <div class="cart-item-name">${peca.nome}</div>
        <div class="cart-item-price">${formatarPreco(peca.preco)} × ${peca.quantidade} = ${formatarPreco(peca.preco * peca.quantidade)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="alterarQuantidade('${peca.id}',-1)">−</button>
          <span class="qty-value">${peca.quantidade}</span>
          <button class="qty-btn" onclick="alterarQuantidade('${peca.id}',1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="toggleCarrinho(null,'${peca.id}')" title="Remover">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`).join('')

  const total = carrinho.reduce((s, p) => s + p.preco * p.quantidade, 0)
  cartTotalEl.textContent  = formatarPreco(total)
  cartFooterEl.style.display = 'block'
  atualizarContadorCarrinho()
}

function abrirCarrinho()  { renderCarrinho(); cartDrawer.classList.add('open'); cartOverlay.classList.add('open'); document.body.style.overflow = 'hidden' }
function fecharCarrinho() { cartDrawer.classList.remove('open'); cartOverlay.classList.remove('open'); document.body.style.overflow = '' }

// ── WhatsApp ──────────────────────────────────────────────────
function finalizarWhatsapp() {
  if (!carrinho.length) return
  const linhas = carrinho.map(p =>
    p.quantidade > 1
      ? `• ${p.nome} × ${p.quantidade} — ${formatarPreco(p.preco * p.quantidade)}`
      : `• ${p.nome} — ${formatarPreco(p.preco)}`
  )
  const total = carrinho.reduce((s, p) => s + p.preco * p.quantidade, 0)
  const msg = ['Olá! Vi o catálogo e adorei essas peças 😍','', ...linhas,'',`*Total estimado: ${formatarPreco(total)}*`,'','Estão disponíveis? 🙏'].join('\n')
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
}

// ── Tracking ──────────────────────────────────────────────────
function registrarEvento(pecaId, acao) {
  db.from('eventos_carrinho').insert([{ peca_id: pecaId, acao }]).then(({ error }) => {
    if (error) console.warn('Tracking error:', error)
  })
}

// ── Helpers ───────────────────────────────────────────────────
function fotoPublica(path) {
  if (!path) return 'https://placehold.co/400x400/e8e8e4/888?text=Foto'
  if (path.startsWith('http')) return path
  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

function showToast(msg, tipo = '') {
  toastEl.textContent = msg
  toastEl.className   = `toast ${tipo} show`
  setTimeout(() => toastEl.classList.remove('show'), 2800)
}

function iconePlus() { return `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` }
function iconeCheck() { return `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` }