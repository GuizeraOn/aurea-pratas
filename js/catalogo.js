// ============================================================
//  ÁUREAS PRATA — js/catalogo.js
//  Lógica do catálogo público
// ============================================================

// ── Estado ──────────────────────────────────────────────────
let todasPecas  = []   // todos os produtos carregados
let carrinho    = []   // itens selecionados
let catAtiva    = 'todos'

const CATEGORIAS = {
  aneis:     'Anéis',
  colares:   'Colares',
  brincos:   'Brincos',
  pulseiras: 'Pulseiras',
}

// ── Elementos ───────────────────────────────────────────────
const grid          = document.getElementById('catalogGrid')
const cartCountEl   = document.getElementById('cartCount')
const cartDrawer    = document.getElementById('cartDrawer')
const cartOverlay   = document.getElementById('cartOverlay')
const cartItemsEl   = document.getElementById('cartItems')
const cartFooterEl  = document.getElementById('cartFooter')
const cartTotalEl   = document.getElementById('cartTotal')
const toastEl       = document.getElementById('toast')

// ── Inicialização ────────────────────────────────────────────
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

  // Eventos do modal
  document.getElementById('modalClose').addEventListener('click', fecharModal)
  document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target.id === 'productModal') fecharModal()
  })
})

// ── Carregar produtos do Supabase ────────────────────────────
async function carregarPecas() {
  try {
    const { data, error } = await db
      .from('pecas')
      .select('*')
      .eq('visivel', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    todasPecas = data || []
    renderGrid()
  } catch (err) {
    console.error('Erro ao carregar peças:', err)
    grid.innerHTML = `
      <div class="empty-state">
        <p>Erro ao carregar o catálogo. Tente recarregar a página.</p>
      </div>`
  }
}

// ── Renderizar grid ──────────────────────────────────────────
function renderGrid() {
  const filtradas = catAtiva === 'todos'
    ? todasPecas
    : todasPecas.filter(p => p.categoria === catAtiva)

  if (filtradas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma peça encontrada nessa categoria.</p>
      </div>`
    return
  }

  grid.innerHTML = filtradas.map(peca => cardHTML(peca)).join('')
}

// ── HTML de um card de produto ───────────────────────────────
function cardHTML(peca) {
  const noCarrinho = carrinho.some(c => c.id === peca.id)

  const fotos = []
  if (peca.foto_path) fotos.push(fotoPublica(peca.foto_path))
  if (peca.foto_2) fotos.push(fotoPublica(peca.foto_2))
  if (peca.foto_3) fotos.push(fotoPublica(peca.foto_3))
  if (peca.foto_4) fotos.push(fotoPublica(peca.foto_4))
  if (fotos.length === 0) fotos.push('https://placehold.co/400x400/e8e8e4/888?text=Foto')

  const catLabel   = CATEGORIAS[peca.categoria] || peca.categoria
  const diasDesdeCriacao = (Date.now() - new Date(peca.created_at).getTime()) / (1000 * 60 * 60 * 24)
  const isNovidade = diasDesdeCriacao < 7
  
  const isEsgotada = peca.estoque === 0
  const isUltimas = peca.estoque !== null && peca.estoque <= 3 && peca.estoque > 0

  let btnHTML = ''
  if (isEsgotada) {
    btnHTML = `<div class="badge-esgotada">Esgotada</div>`
  } else {
    btnHTML = `<button
      class="card-add-btn ${noCarrinho ? 'added' : ''}"
      onclick="toggleCarrinho(event, '${peca.id}')"
      aria-label="${noCarrinho ? 'Remover da lista' : 'Adicionar à lista'}"
      title="${noCarrinho ? 'Remover da lista' : 'Adicionar à lista'}"
    >
      ${noCarrinho ? iconeCheck() : iconePlus()}
    </button>`
  }

  const fotosStr = encodeURIComponent(JSON.stringify(fotos))
  let navCarouselHTML = ''
  if (fotos.length > 1) {
    navCarouselHTML = `
      <div class="card-nav prev" onclick="trocarFoto(event, '${peca.id}', -1)">&#8249;</div>
      <div class="card-nav next" onclick="trocarFoto(event, '${peca.id}', 1)">&#8250;</div>
    `
  }

  return `
    <article class="product-card" data-id="${peca.id}" onclick="abrirModal('${peca.id}')">
      <div class="card-img-wrap" data-fotos="${fotosStr}" data-foto-ativa="0">
        <img
          id="img-${peca.id}"
          src="${fotos[0]}"
          alt="${peca.nome}"
          loading="lazy"
        />
        <div class="card-badges" style="position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; z-index: 2;">
          <span class="card-badge" style="position: static; margin: 0;">${catLabel}</span>
          ${isNovidade ? '<span class="card-badge badge-novidade" style="position: static; margin: 0;">Novidade</span>' : ''}
          ${isUltimas ? '<span class="card-badge badge-ultimas" style="position: static; margin: 0;">Últimas</span>' : ''}
        </div>
        ${navCarouselHTML}
        ${btnHTML}
      </div>
      <div class="card-info">
        <div class="card-name">${peca.nome}</div>
        <div class="card-price">${formatarPreco(peca.preco)}</div>
      </div>
    </article>`
}

function trocarFoto(e, pecaId, dir) {
  e.stopPropagation()
  const wrap = document.querySelector(`.product-card[data-id="${pecaId}"] .card-img-wrap`)
  if (!wrap) return
  const fotos = JSON.parse(decodeURIComponent(wrap.dataset.fotos))
  let idx = parseInt(wrap.dataset.fotoAtiva, 10)
  idx += dir
  if (idx < 0) idx = fotos.length - 1
  if (idx >= fotos.length) idx = 0
  wrap.dataset.fotoAtiva = idx
  const img = document.getElementById(`img-${pecaId}`)
  img.style.opacity = '0.5'
  setTimeout(() => {
    img.src = fotos[idx]
    img.style.opacity = '1'
  }, 100)
}

// ── Carrinho ─────────────────────────────────────────────────
function toggleCarrinho(e, id) {
  if (e && e.stopPropagation) e.stopPropagation()
  
  const peca = todasPecas.find(p => p.id === id)
  if (!peca) return

  const idx = carrinho.findIndex(c => c.id === id)
  if (idx === -1) {
    if (peca.estoque === 0) return showToast('Peça esgotada!', 'error')
    carrinho.push({ ...peca, quantidade: 1 })
    showToast(`"${peca.nome}" adicionado à lista ✓`, 'success')
    db.from('eventos_carrinho').insert([{ peca_id: peca.id, acao: 'adicionou' }]).then()
  } else {
    carrinho.splice(idx, 1)
    showToast(`"${peca.nome}" removido da lista`)
    db.from('eventos_carrinho').insert([{ peca_id: peca.id, acao: 'removeu' }]).then()
  }

  atualizarContadorCarrinho()
  renderGrid()         // atualiza ícone no card
  renderCarrinho()     // atualiza drawer
}

function mudarQtd(id, delta) {
  const item = carrinho.find(c => c.id === id)
  if (!item) return
  item.quantidade += delta
  if (item.quantidade < 1) item.quantidade = 1
  if (item.estoque !== null && item.quantidade > item.estoque) {
     item.quantidade = item.estoque
     showToast('Quantidade máxima em estoque atingida', 'error')
  }
  renderCarrinho()
  renderGrid()
}

function atualizarContadorCarrinho() {
  const n = carrinho.length
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
      <img
        class="cart-item-img"
        src="${fotoPublica(peca.foto_path)}"
        alt="${peca.nome}"
        onerror="this.src='https://placehold.co/64x64/e8e8e4/888?text=?'"
      />
      <div class="cart-item-info">
        <div class="cart-item-name">${peca.nome}</div>
        <div class="cart-item-price">${formatarPreco(peca.preco)}</div>
        <div class="cart-item-qty">
           <button class="qty-btn" onclick="mudarQtd('${peca.id}', -1)">-</button>
           <span class="qty-val">${peca.quantidade}</span>
           <button class="qty-btn" onclick="mudarQtd('${peca.id}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="toggleCarrinho(event, '${peca.id}')" title="Remover">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`).join('')

  const total = carrinho.reduce((s, p) => s + (Number(p.preco) * p.quantidade), 0)
  cartTotalEl.textContent = formatarPreco(total)
  cartFooterEl.style.display = 'block'
}

function abrirCarrinho() {
  renderCarrinho()
  cartDrawer.classList.add('open')
  cartOverlay.classList.add('open')
  document.body.style.overflow = 'hidden'
}

function fecharCarrinho() {
  cartDrawer.classList.remove('open')
  cartOverlay.classList.remove('open')
  document.body.style.overflow = ''
}

// ── Finalizar pedido no WhatsApp ─────────────────────────────
function finalizarWhatsapp() {
  if (carrinho.length === 0) return

  const linhas = carrinho.map(p => `• ${p.nome} × ${p.quantidade} — ${formatarPreco(p.preco * p.quantidade)}`)
  const total  = carrinho.reduce((s, p) => s + (Number(p.preco) * p.quantidade), 0)

  const msg = [
    'Olá! Vi o catálogo e adorei essas peças 😍',
    '',
    ...linhas,
    '',
    `*Total estimado: ${formatarPreco(total)}*`,
    '',
    'Estão disponíveis? 🙏'
  ].join('\n')

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
  window.open(url, '_blank')
}

// ── Modal de Produto ─────────────────────────────────────────
let modalFotosAtual = []
let modalFotoIdx = 0

function abrirModal(id) {
  const peca = todasPecas.find(p => p.id === id)
  if (!peca) return
  
  modalFotosAtual = []
  if (peca.foto_path) modalFotosAtual.push(fotoPublica(peca.foto_path))
  if (peca.foto_2) modalFotosAtual.push(fotoPublica(peca.foto_2))
  if (peca.foto_3) modalFotosAtual.push(fotoPublica(peca.foto_3))
  if (peca.foto_4) modalFotosAtual.push(fotoPublica(peca.foto_4))
  if (modalFotosAtual.length === 0) modalFotosAtual.push('https://placehold.co/400x400/e8e8e4/888?text=Foto')

  modalFotoIdx = 0
  
  document.getElementById('modalCat').textContent = CATEGORIAS[peca.categoria] || peca.categoria
  document.getElementById('modalName').textContent = peca.nome
  document.getElementById('modalPrice').textContent = formatarPreco(peca.preco)
  
  let descHtml = peca.descricao || ''
  if (peca.estoque !== null) {
    descHtml += `\n\nEstoque disponível: ${peca.estoque}`
  }
  document.getElementById('modalDesc').textContent = descHtml

  renderizarModalGaleria()

  const modal = document.getElementById('productModal')
  modal.classList.add('open')
  document.body.style.overflow = 'hidden'
  
  document.addEventListener('keydown', handleModalKeys)
}

function renderizarModalGaleria() {
  const galeria = document.getElementById('modalGallery')
  let imgStr = modalFotosAtual.map((f, i) => `<img src="${f}" class="${i===modalFotoIdx?'active':''}" />`).join('')
  
  if (modalFotosAtual.length > 1) {
    imgStr += `
      <div class="modal-nav prev" onclick="trocarFotoModal(-1, event)">&#8249;</div>
      <div class="modal-nav next" onclick="trocarFotoModal(1, event)">&#8250;</div>
    `
  }
  galeria.innerHTML = imgStr
}

function trocarFotoModal(dir, e) {
  if (e) e.stopPropagation()
  modalFotoIdx += dir
  if (modalFotoIdx < 0) modalFotoIdx = modalFotosAtual.length - 1
  if (modalFotoIdx >= modalFotosAtual.length) modalFotoIdx = 0
  renderizarModalGaleria()
}

function fecharModal() {
  document.getElementById('productModal').classList.remove('open')
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleModalKeys)
}

function handleModalKeys(e) {
  if (e.key === 'Escape') fecharModal()
  if (e.key === 'ArrowLeft') trocarFotoModal(-1)
  if (e.key === 'ArrowRight') trocarFotoModal(1)
}

// ── Helpers ──────────────────────────────────────────────────
function fotoPublica(path) {
  if (!path) return 'https://placehold.co/400x400/e8e8e4/888?text=Foto'
  // Se já for URL completa (http...), usa direto
  if (path.startsWith('http')) return path
  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function showToast(msg, tipo = '') {
  toastEl.textContent = msg
  toastEl.className   = `toast ${tipo} show`
  setTimeout(() => toastEl.classList.remove('show'), 2800)
}

function iconePlus() {
  return `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
}

function iconeCheck() {
  return `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
}