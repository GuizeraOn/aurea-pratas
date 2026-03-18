// ============================================================
//  AUREA PRATAS — js/catalogo.js
// ============================================================

let todasPecas = []
let todasCategorias = []
let todosTiposVar = []
let todasVariacoes = []
let carrinho   = []   // [{ ...peca, variacoesLabel: 'P | Prata', carrinhoChave: 'id-hash', quantidade: N }]
let catAtiva   = 'todos'
let buscaAtiva = ''

let modalAtivoSelecoes = {}
let modalAtivoVariantesGrupos = 0

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
    const novaCat = btn.dataset.cat
    if (novaCat === catAtiva) return

    catAtiva = novaCat
    
    // Atualizar URL (Routing)
    const catObj = todasCategorias.find(c => c.id === catAtiva)
    const slug   = catObj ? catObj.slug : ''
    const novoPath = slug ? `/${slug}` : '/'
    window.history.pushState({ catId: catAtiva }, '', novoPath)

    document.querySelectorAll('#filtersContainer .filter-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    renderGrid()
  })
  document.getElementById('searchInput').addEventListener('input', e => {
    buscaAtiva = e.target.value.toLowerCase().trim()
    renderGrid()
  })

  // Sincronizar com navegação do navegador
  window.addEventListener('popstate', (e) => {
    sincronizarFiltroPeloUrl()
  })
})

// ── Carregar ──────────────────────────────────────────────────
async function carregarPecas() {
  renderSkeletons()
  try {
    const [resPecas, resCat, resTipos] = await Promise.all([
      db.from('pecas').select('*').eq('visivel', true).or('estoque.gt.0,estoque.is.null').order('created_at', { ascending: false }),
      db.from('categorias').select('*').order('ordem'),
      db.from('tipos_variacao').select('*').order('nome')
    ])
    if (resPecas.error) throw resPecas.error
    todasPecas = resPecas.data || []
    todasCategorias = resCat.data || []
    todosTiposVar = resTipos.data || []

    // Busca variações apenas das peças carregadas
    const { data: varsData, error: varsError } = await db
      .from('variacoes_peca')
      .select('*, tipos_variacao(nome)')
      .in('peca_id', todasPecas.map(p => p.id))
    
    if (varsError) console.warn('Erro ao carregar variações:', varsError)
    todasVariacoes = varsData || []
    
    // Routing: Definir categoria ativa baseada no URL inicial
    sincronizarFiltroPeloUrl(true)

    renderFiltros()
    renderGrid()
  } catch(e) {
    grid.innerHTML = `<div class="empty-state"><p>Erro ao carregar o catálogo. Tente recarregar a página.</p></div>`
  }
}

// ── Routing ───────────────────────────────────────────────────
function sincronizarFiltroPeloUrl(isInit = false) {
  const path = window.location.pathname.replace(/^\/|\/$/g, '') // remove leading/trailing slashes
  
  if (!path) {
    catAtiva = 'todos'
  } else {
    // Busca slug correspondente nas categorias carregadas
    const catEncontrada = todasCategorias.find(c => c.slug === path)
    if (catEncontrada) {
      catAtiva = catEncontrada.id
    } else {
      catAtiva = 'todos'
    }
  }

  // Se não for o init, atualiza a UI (no init o renderFiltros cuidará disso)
  if (!isInit) {
    document.querySelectorAll('#filtersContainer .filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === catAtiva)
    })
    renderGrid()
  }
}

function renderFiltros() {
  const container = document.getElementById('filtersContainer')
  if (!container) return
  container.innerHTML = `<button class="filter-btn ${catAtiva==='todos'?'active':''}" data-cat="todos">Todos</button>` + 
    todasCategorias.map(c => `<button class="filter-btn ${catAtiva===c.id?'active':''}" data-cat="${c.id}">${c.nome}</button>`).join('')
}

// ── Grid ──────────────────────────────────────────────────────
function renderGrid() {
  let filtradas = catAtiva === 'todos' ? todasPecas : todasPecas.filter(p => p.categoria === catAtiva)
  
  if (buscaAtiva) {
    filtradas = filtradas.filter(p => p.nome.toLowerCase().includes(buscaAtiva))
  }

  if (filtradas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>${buscaAtiva ? 'Nenhuma peça encontrada para sua busca.' : 'Nenhuma peça encontrada nesta categoria no momento.'}</p>
        <button class="empty-state-btn" onclick="limparFiltros()">Limpar Tudo e Ver Tudo</button>
      </div>`
    return
  }
  grid.innerHTML = filtradas.map(p => cardHTML(p)).join('')
}

function renderSkeletons() {
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-line" style="width: 70%;"></div>
      <div class="skeleton-line" style="width: 40%;"></div>
    </div>
  `).join('')
}

function limparFiltros() {
  catAtiva = 'todos'
  buscaAtiva = ''
  document.getElementById('searchInput').value = ''
  document.querySelectorAll('#filtersContainer .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === 'todos')
  })
  renderGrid()
}

// ── Card HTML ─────────────────────────────────────────────────
function cardHTML(peca) {
  const noCarrinho = carrinho.some(c => c.id === peca.id)
  const catObj     = todasCategorias.find(c => c.id === peca.categoria)
  const catLabel   = catObj ? catObj.nome : 'Sem Categoria'
  const isNova     = (Date.now() - new Date(peca.created_at).getTime()) < SETE_DIAS
  const esgotada   = peca.estoque != null && peca.estoque === 0
  const poucasUn   = peca.estoque != null && peca.estoque > 0 && peca.estoque <= 3

  const fotos = [peca.foto_path, peca.foto_2, peca.foto_3, peca.foto_4].filter(Boolean).map(p => fotoPublica(p))
  const fotoAtual = fotos[0] || 'https://placehold.co/400x400/e8e8e4/888?text=Foto'

  const varsPeca = todasVariacoes.filter(v => v.peca_id === peca.id)
  const temVariaveis = varsPeca.length > 0

  const dotsHTML = fotos.length > 1 ? `<div class="card-dots">${fotos.map((_,i) => `<div class="card-dot ${i===0?'active':''}" data-i="${i}"></div>`).join('')}</div>` : ''
  const carouselBtns = fotos.length > 1 ? `<button class="card-carousel-btn prev" onclick="carouselCard(event,'${peca.id}',-1)">‹</button><button class="card-carousel-btn next" onclick="carouselCard(event,'${peca.id}',1)">›</button>` : ''

  // Lógica de botões/status na parte inferior
  let statusHTML = ''
  if (esgotada) {
    statusHTML = `<div class="badge-out">Esgotada</div>`
  } else {
    // Se tiver variações, o botão abre o modal (Opções)
    // Se não tiver, adiciona direto (Adicionar)
    const btnTexto = temVariaveis ? '+ Opções' : (noCarrinho ? '✔ Adicionado' : '+ Adicionar')
    const btnAcao  = temVariaveis ? `clickCardAdd(event,'${peca.id}')` : `toggleCarrinhoSimples(event,'${peca.id}')`
    
    statusHTML = `
      ${poucasUn ? '<div class="badge-low">Ultimas unidades!</div>' : ''}
      <button class="card-add-btn ${noCarrinho?'added':''}" onclick="${btnAcao}">${btnTexto}</button>
    `
  }

  return `
    <article class="product-card" data-id="${peca.id}" data-foto-idx="0" data-fotos='${JSON.stringify(fotos)}'>
      <div class="card-img-wrap" onclick="abrirModal('${peca.id}')">
        <img id="card-img-${peca.id}" src="${fotoAtual}" alt="${peca.nome}" loading="lazy" onerror="this.src='https://placehold.co/400x400/e8e8e4/888?text=Foto'" />
        ${carouselBtns}
        ${dotsHTML}
      </div>
      <div class="card-info" style="cursor:pointer">
        <div class="card-badges-row" onclick="abrirModal('${peca.id}')">
          <span class="card-badge">${catLabel}</span>
          ${isNova ? '<span class="badge-new">Novo</span>' : ''}
        </div>
        <div class="card-name" onclick="abrirModal('${peca.id}')">${peca.nome}</div>
        <div class="card-price" onclick="abrirModal('${peca.id}')">${formatarPreco(peca.preco)}</div>
        <div class="card-status-wrap">
          ${statusHTML}
        </div>
      </div>
    </article>`
}

function clickCardAdd(e, id) {
  e.stopPropagation()
  abrirModal(id)
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

  modalAtivoSelecoes = {}
  
  const fotos = [peca.foto_path, peca.foto_2, peca.foto_3, peca.foto_4].filter(Boolean).map(p => fotoPublica(p))
  if (!fotos.length) fotos.push('https://placehold.co/600x600/e8e8e4/888?text=Foto')

  const esgotada   = peca.estoque != null && peca.estoque === 0
  const catObj     = todasCategorias.find(c => c.id === peca.categoria)
  const catLabel   = catObj ? catObj.nome : 'Sem Categoria'

  const estoqueHTML = peca.estoque == null ? ''
    : peca.estoque === 0 ? `<div class="modal-estoque low">❌ Esgotada</div>`
    : peca.estoque <= 3  ? `<div class="modal-estoque low">⚠️ Últimas ${peca.estoque} unidades!</div>`
    : `<div class="modal-estoque ok">✅ Em estoque (${peca.estoque} un.)</div>`

  const varsPeca = todasVariacoes.filter(v => v.peca_id === id)
  let variacaoHTML = ''
  modalAtivoVariantesGrupos = 0
  if (varsPeca.length > 0) {
    const porTipo = {}
    varsPeca.forEach(v => { if (!porTipo[v.tipo_variacao_id]) porTipo[v.tipo_variacao_id] = []; porTipo[v.tipo_variacao_id].push(v) })
    modalAtivoVariantesGrupos = Object.keys(porTipo).length
    
    variacaoHTML = Object.entries(porTipo).map(([tId, variaveis]) => {
      const tObj = todosTiposVar.find(t => t.id === tId)
      const chips = variaveis.map(v => {
        if (!v.disponivel) return `<button class="var-chip esgotado" disabled>${v.valor}</button>`
        return `<button class="var-chip" id="chip_${v.id}" onclick="selecionarVariacaoModal('${tId}', '${v.id}', '${v.valor}')">${v.valor}</button>`
      }).join('')
      return `
        <div style="margin-top:16px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:var(--gray-dark);margin-bottom:8px;font-weight:600">${tObj?tObj.nome:'Opções'}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">${chips}</div>
        </div>
      `
    }).join('')
  }

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
          <div class="modal-desc">${peca.descricao || 'Peça em prata, acabamento polido de alta qualidade.'}</div>
          ${estoqueHTML}
          ${variacaoHTML}
          ${!esgotada ? `
          <button class="modal-add-btn" id="modalAddBtn" onclick="tentarAdicionarAoCarrinho('${peca.id}')">
            + Adicionar à lista
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

function selecionarVariacaoModal(tId, vId, vValor) {
  modalAtivoSelecoes[tId] = { id: vId, valor: vValor }
  document.querySelectorAll(`button[onclick^="selecionarVariacaoModal('${tId}'"]`).forEach(b => b.classList.remove('active'))
  document.getElementById(`chip_${vId}`).classList.add('active')
}

function tentarAdicionarAoCarrinho(pecaId) {
  if (Object.keys(modalAtivoSelecoes).length < modalAtivoVariantesGrupos) {
    showToast('Selecione uma opção de cada variação!', 'error')
    return
  }
  adicionarHashAoCarrinho(pecaId, modalAtivoSelecoes)
  fecharModal()
}

// ── Carrinho ──────────────────────────────────────────────────
function toggleCarrinhoSimples(e, id) {
  if (e) e.stopPropagation()
  const idx = carrinho.findIndex(c => c.id === id && !c.variacoesLabel)
  if (idx === -1) {
    adicionarHashAoCarrinho(id, {})
  } else {
    removerDoCarrinhoHash(`${id}-`)
  }
}

function adicionarHashAoCarrinho(pecaId, selecoesObj) {
  const peca = todasPecas.find(p => p.id === pecaId)
  if (!peca) return
  
  const hashObj = selecoesObj || {}
  const variacoesString = Object.entries(hashObj).sort((a,b)=>a[0].localeCompare(b[0])).map(x => x[1].valor).join(' | ')
  const carrinhoChave = pecaId + '-' + variacoesString
  
  const idx = carrinho.findIndex(c => c.carrinhoChave === carrinhoChave)
  if (idx === -1) {
    carrinho.push({ ...peca, variacoesLabel: variacoesString, carrinhoChave, quantidade: 1 })
    showToast(`"${peca.nome}" adicionado ✓`, 'success')
    registrarEvento(pecaId, 'adicionou')
  } else {
    carrinho[idx].quantidade += 1
    showToast(`Mais 1 un. de "${peca.nome}" adicionada ✓`, 'success')
  }
  
  atualizarContadorCarrinho()
  renderGrid()
  renderCarrinho()
}

function removerDoCarrinhoHash(carrinhoChave) {
  const idx = carrinho.findIndex(c => c.carrinhoChave === carrinhoChave)
  if (idx > -1) {
    const p = carrinho[idx]
    carrinho.splice(idx, 1)
    showToast(`"${p.nome}" removido`)
    registrarEvento(p.id, 'removeu')
    atualizarContadorCarrinho()
    renderGrid()
    renderCarrinho()
  }
}

function alterarQuantidade(carrinhoChave, delta) {
  const item = carrinho.find(c => c.carrinhoChave === carrinhoChave)
  if (!item) return
  item.quantidade = Math.max(1, item.quantidade + delta)
  renderCarrinho()
}

function atualizarContadorCarrinho() {
  const n = carrinho.reduce((s, c) => s + c.quantidade, 0)
  const total = carrinho.reduce((s, p) => s + p.preco * p.quantidade, 0)
  
  cartCountEl.textContent = n
  cartCountEl.classList.toggle('hidden', n === 0)

  // Barra Flutuante (só mostra se o carrinho tiver itens E o drawer estiver fechado)
  const floatingBar = document.getElementById('cartFloatingBar')
  const isDrawerOpen = cartDrawer.classList.contains('open')

  if (floatingBar) {
    if (n > 0 && !isDrawerOpen) {
      floatingBar.classList.remove('hidden')
      document.getElementById('cartFloatingQty').textContent = `${n} ${n === 1 ? 'peça' : 'peças'}`
      document.getElementById('cartFloatingTotal').textContent = formatarPreco(total)
    } else {
      floatingBar.classList.add('hidden')
    }
  }
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
        ${peca.variacoesLabel ? `<div style="font-size:11px;color:var(--gray-dark);margin-top:2px;font-weight:600">${peca.variacoesLabel}</div>` : ''}
        <div class="cart-item-price">${formatarPreco(peca.preco)} × ${peca.quantidade} = ${formatarPreco(peca.preco * peca.quantidade)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="alterarQuantidade('${peca.carrinhoChave}',-1)">−</button>
          <span class="qty-value">${peca.quantidade}</span>
          <button class="qty-btn" onclick="alterarQuantidade('${peca.carrinhoChave}',1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removerDoCarrinhoHash('${peca.carrinhoChave}')" title="Remover">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`).join('')

  const total = carrinho.reduce((s, p) => s + p.preco * p.quantidade, 0)
  cartTotalEl.textContent  = formatarPreco(total)
  cartFooterEl.style.display = 'block'
  atualizarContadorCarrinho()
}

function abrirCarrinho()  { 
  renderCarrinho()
  cartDrawer.classList.add('open')
  cartOverlay.classList.add('open')
  document.body.style.overflow = 'hidden'
  const floatingBar = document.getElementById('cartFloatingBar')
  if (floatingBar) floatingBar.classList.add('hidden')
}
function fecharCarrinho() { 
  cartDrawer.classList.remove('open')
  cartOverlay.classList.remove('open')
  document.body.style.overflow = ''
  if (carrinho.length > 0) {
    const floatingBar = document.getElementById('cartFloatingBar')
    if (floatingBar) floatingBar.classList.remove('hidden')
  }
}

// ── WhatsApp ──────────────────────────────────────────────────
function finalizarWhatsapp() {
  if (!carrinho.length) return
  
  const linhas = carrinho.map(p => {
    const label = p.variacoesLabel ? ` (${p.variacoesLabel})` : ''
    const itemInfo = p.quantidade > 1 
      ? `${p.nome}${label} × ${p.quantidade} — ${formatarPreco(p.preco * p.quantidade)}`
      : `${p.nome}${label} — ${formatarPreco(p.preco)}`
    return `- ${itemInfo}`
  })

  const total = carrinho.reduce((s, p) => s + p.preco * p.quantidade, 0)
  
  const msg = [
    'Olá! Gostaria de saber mais sobre as peças abaixo:',
    '',
    ...linhas,
    '',
    `Total: ${formatarPreco(total)}`,
    '',
    'Poderia confirmar disponibilidade e prazo? Obrigada!'
  ].join('\n')

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