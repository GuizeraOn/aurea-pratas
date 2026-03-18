// ============================================================
//  AUREA PRATAS — js/admin.js
// ============================================================

let todasPecasAdmin = []
let filtroAdminCat  = 'todos'
let fotosArquivos   = [null, null, null, null]
let fotosExistentes = ['', '', '', '']

let categorias = []
let tiposVariacao = []
let pecaVariacoes = {} // { tipo_id: [ { valor: 'P', disponivel: true, id: uuid } ] }

const toastEl       = document.getElementById('toast')
const tableBody     = document.getElementById('adminTableBody')
const saveBtn       = document.getElementById('saveBtn')
const saveBtnText   = document.getElementById('saveBtnText')
const saveSpinner   = document.getElementById('saveSpinner')
const cancelEditBtn = document.getElementById('cancelEditBtn')

// ── Autenticação simples ──────────────────────────────────────
const SENHA_HASH = '2669aa90' 

function verificarSenha() {
  const digitada = document.getElementById('loginSenha').value
  const hashDigitada = simpleHash(digitada)

  if (hashDigitada === SENHA_HASH) {
    sessionStorage.setItem('admin_auth', SENHA_HASH)
    carregarTudo()
  } else {
    document.getElementById('loginErro').style.display = 'block'
    document.getElementById('loginSenha').value = ''
    document.getElementById('loginSenha').focus()
  }
}

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

function verificarSessao() {
  const auth = sessionStorage.getItem('admin_auth')
  if (auth === SENHA_HASH) {
    carregarTudo()
  } else {
    // Garante que o tema seja carregado mesmo sem login para a tela de login ficar bonita
    initTheme()
  }
}

// ── Tema (Dark Mode Default) ──────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('admin-theme')
  const adminLogo = document.getElementById('adminLogo')
  const loginLogo = document.getElementById('loginLogo')
  
  if (!saved || saved === 'dark') {
    document.body.classList.add('dark-mode')
    document.getElementById('themeToggle').textContent = '☀️'
    if (adminLogo) adminLogo.src = 'assets/logo-dark.png'
    if (loginLogo) loginLogo.src = 'assets/logo-white.png'
  } else {
    document.body.classList.remove('dark-mode')
    document.getElementById('themeToggle').textContent = '🌙'
    if (adminLogo) adminLogo.src = 'assets/logo-white.png'
    if (loginLogo) loginLogo.src = 'assets/logo-dark.png'
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode')
  localStorage.setItem('admin-theme', isDark ? 'dark' : 'light')
  document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙'
  
  const adminLogo = document.getElementById('adminLogo')
  const loginLogo = document.getElementById('loginLogo')
  
  if (isDark) {
    if (adminLogo) adminLogo.src = 'assets/logo-dark.png'
    if (loginLogo) loginLogo.src = 'assets/logo-white.png'
  } else {
    if (adminLogo) adminLogo.src = 'assets/logo-white.png'
    if (loginLogo) loginLogo.src = 'assets/logo-dark.png'
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  verificarSessao()
  document.getElementById('themeToggle').addEventListener('click', toggleTheme)
})

async function carregarTudo() {
  initTheme()
  configurarSlots()
  await carregarCategoriasETipos()
  carregarPecasAdmin()
  carregarRelatorio(7)
  
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('adminPanel').style.display = 'block'
}

// ── Slots de foto ─────────────────────────────────────────────
function configurarSlots() {
  for (let i = 0; i < 4; i++) {
    const slot  = document.getElementById(`slot${i}`)
    const input = document.getElementById(`photoInput${i}`)

    slot.addEventListener('click', (e) => {
      if (e.target.classList.contains('slot-remove')) return
      input.click()
    })

    input.addEventListener('change', e => {
      const file = e.target.files[0]
      if (file) selecionarFoto(i, file)
    })

    slot.addEventListener('dragover', e => { e.preventDefault(); slot.style.borderColor = 'var(--gold-light)' })
    slot.addEventListener('dragleave', () => { slot.style.borderColor = '' })
    slot.addEventListener('drop', e => {
      e.preventDefault(); slot.style.borderColor = ''
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) selecionarFoto(i, file)
    })
  }
}

async function selecionarFoto(idx, file) {
  if (file.size > 15 * 1024 * 1024) { showToast('Foto excedeu 15MB.', 'error'); return }
  
  try {
    const antes = file.size
    const webpFile = await comprimirParaWebP(file, 0.8)
    fotosArquivos[idx] = webpFile
    
    // Feedback de economia
    const kb1     = (antes / 1024).toFixed(0)
    const kb2     = (webpFile.size / 1024).toFixed(0)
    const economia = Math.round((1 - webpFile.size / antes) * 100)
    if (economia > 5) showToast(`Foto otimizada! ${kb1}KB → ${kb2}KB (-${economia}%)`, 'success')

    const reader = new FileReader()
    reader.onload = e => mostrarPreview(idx, e.target.result)
    reader.readAsDataURL(webpFile)
  } catch (err) {
    console.error('ERRO COMPRESSÃO:', err)
    showToast('Erro ao processar imagem. Tente outra.', 'error')
  }
}

function comprimirParaWebP(file, qualidade = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve(file)

    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // Limite dimensionado para ótima leitura mas controle de tamanho
      const MAX_WIDTH = 1200
      const MAX_HEIGHT = 1200
      let width = img.width
      let height = img.height
      
      if (width > height) {
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH }
      } else {
        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT }
      }
      
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(blob => {
        if (!blob) return reject('Erro ao converter no canvas')
        // Substitui a extensão por .webp
        const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
        resolve(new File([blob], `${base}.webp`, { type: 'image/webp' }))
      }, 'image/webp', qualidade)
    }
    img.onerror = () => reject('Falha ao carregar a imagem original')
  })
}

function mostrarPreview(idx, src) {
  const preview = document.getElementById(`preview${idx}`)
  const remove  = document.getElementById(`remove${idx}`)
  const slot    = document.getElementById(`slot${idx}`)
  preview.src = src
  preview.classList.remove('hidden')
  remove.classList.remove('hidden')
  slot.querySelector('.slot-placeholder').style.opacity = '0'
}

function removerFoto(idx) {
  fotosArquivos[idx]   = null
  fotosExistentes[idx] = ''
  const preview = document.getElementById(`preview${idx}`)
  const remove  = document.getElementById(`remove${idx}`)
  const slot    = document.getElementById(`slot${idx}`)
  preview.classList.add('hidden')
  preview.src = ''
  remove.classList.add('hidden')
  slot.querySelector('.slot-placeholder').style.opacity = '1'
  document.getElementById(`photoInput${idx}`).value = ''
}

// ── Dados Dynamicos (Categorias e Tipos) ──────────────────────
async function carregarCategoriasETipos() {
  const [resCat, resTipos] = await Promise.all([
    db.from('categorias').select('*').order('ordem'),
    db.from('tipos_variacao').select('*').order('nome')
  ])
  if (!resCat.error) categorias = resCat.data || []
  if (!resTipos.error) tiposVariacao = resTipos.data || []
  
  renderCategorias()
  renderTiposVariacao()
  atualizarFiltrosAdmin()
  preencherSelectCategoria()
  renderVariacoesSelector()

  const statCats = document.getElementById('statCats')
  if (statCats) statCats.textContent = categorias.length
}

// Categorias CRUD
async function criarCategoria() {
  const input = document.getElementById('novaCatNome')
  const nome = input.value.trim()
  if (!nome) {
    input.classList.add('input-error')
    showToast('Preencha o nome da categoria', 'error')
    input.focus()
    input.oninput = () => input.classList.remove('input-error')
    return
  }
  const slug = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  const ordem = categorias.length + 1
  const { error } = await db.from('categorias').insert([{ nome, slug, ordem }])
  if (!error) { 
    showToast('Categoria criada!', 'success')
    input.value=''
    input.classList.remove('input-error')
    await carregarCategoriasETipos() 
  } else {
    showToast('Erro ao criar.', 'error')
  }
}

async function excluirCategoria(id) {
  // Verifica primeiro no banco (mais robusto)
  const { count, error: countErr } = await db.from('pecas').select('id', { count: 'exact', head: true }).eq('categoria', id)
  if (countErr) { showToast('Erro ao validar categoria.', 'error'); return }
  
  if (count > 0) { 
    showToast(`Não é possível excluir. Existem ${count} peças nesta categoria.`, 'error')
    return 
  }
  
  if (!confirm('Deletar essa categoria?')) return
  const { error } = await db.from('categorias').delete().eq('id', id)
  if (!error) { showToast('Deletada!', 'success'); await carregarCategoriasETipos() }
}

function renderCategorias() {
  const tbody = document.getElementById('adminCatTable')
  if (!tbody) return
  if (!categorias.length) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#888;padding:16px;">Nenhuma categoria</td></tr>`; return }
  tbody.innerHTML = categorias.map(c => `<tr><td>${c.nome}</td><td>${c.slug}</td><td><button class="action-btn delete" onclick="excluirCategoria('${c.id}')">Excluir</button></td></tr>`).join('')
}

// Tipos Variacao CRUD
async function criarTipoVariacao() {
  const input = document.getElementById('novoTipoNome')
  const inputPre = document.getElementById('novoTipoPresets')
  const nome = input.value.trim()
  const presets = inputPre.value.split(',').map(s=>s.trim()).filter(Boolean)
  if (!nome) return
  const { error } = await db.from('tipos_variacao').insert([{ nome, presets }])
  if (!error) { showToast('Tipo criado!', 'success'); input.value=''; inputPre.value=''; await carregarCategoriasETipos() }
}

async function excluirTipoVariacao(id) {
  if (!confirm('Deletar tipo de variação? Vai apagar de todas as peças!')) return
  const { error } = await db.from('tipos_variacao').delete().eq('id', id)
  if (!error) { showToast('Deletado!', 'success'); await carregarCategoriasETipos() }
}

function renderTiposVariacao() {
  const tbody = document.getElementById('adminTipoVarTable')
  if (!tbody) return
  if (!tiposVariacao.length) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#888;padding:16px;">Nenhum tipo criado</td></tr>`; return }
  tbody.innerHTML = tiposVariacao.map(t => `<tr><td>${t.nome}</td><td>${(t.presets||[]).join(', ')}</td><td><button class="action-btn delete" onclick="excluirTipoVariacao('${t.id}')">Excluir</button></td></tr>`).join('')
}

function atualizarFiltrosAdmin() {
  const wrap = document.getElementById('filtrosAdminGrid')
  if(!wrap) return
  wrap.innerHTML = `<button class="filter-btn ${filtroAdminCat==='todos'?'active':''}" data-admin-cat="todos" onclick="filtrarAdmin(this)">Todos</button>` +
    categorias.map(c => `<button class="filter-btn ${filtroAdminCat===c.id?'active':''}" data-admin-cat="${c.id}" onclick="filtrarAdmin(this)">${c.nome}</button>`).join('')
}

function preencherSelectCategoria() {
  const sel = document.getElementById('inputCategoria')
  if (!sel) return
  const currentVal = sel.value
  sel.innerHTML = `<option value="">Selecione...</option>` + categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')
  if (categorias.find(c => c.id === currentVal)) sel.value = currentVal
}

// Variações de Peça Form Logic
function renderVariacoesSelector() {
  const container = document.getElementById('variacoesTiposSelector')
  if (!container) return
  container.innerHTML = tiposVariacao.map(t => `
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;background:var(--white);padding:6px 12px;border-radius:100px;border:1.5px solid var(--gray-light);color:var(--dark)">
      <input type="checkbox" onchange="toggleTipoVariacao('${t.id}', this.checked)" ${pecaVariacoes[t.id] ? 'checked' : ''} />
      ${t.nome}
    </label>
  `).join('')
  renderVariacoesAtivas()
}

function toggleTipoVariacao(id, isChecked) {
  if (isChecked) { if (!pecaVariacoes[id]) pecaVariacoes[id] = [] }
  else { delete pecaVariacoes[id] }
  renderVariacoesAtivas()
}

function renderVariacoesAtivas() {
  const container = document.getElementById('variacoesAtivasContainer')
  if (!container) return
  container.innerHTML = Object.entries(pecaVariacoes).map(([tipo_id, vals]) => {
    const t = tiposVariacao.find(x => x.id === tipo_id)
    if (!t) return ''
    
    const presetsHTML = (t.presets || []).map(p => `
      <span style="font-size:11px;background:var(--gray-light);color:var(--dark);padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid var(--gray-light);transition:var(--transition);" 
            onclick="addVariacaoValor('${t.id}', '${p.replace(/'/g,"\\'")}')">+ ${p}</span>
    `).join(' ')
    const activeHTML = vals.map((v, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg);padding:8px 12px;border-radius:6px;border:1px solid var(--gray-light);margin-bottom:6px;">
        <span style="font-weight:500;font-size:13px;text-decoration:${v.disponivel?'none':'line-through'};color:${v.disponivel?'var(--dark)':'var(--red)'}">${v.valor}</span>
        <div style="display:flex;gap:8px;">
           <button type="button" class="action-btn" onclick="toggleDisponibilidade('${t.id}', ${i})">${v.disponivel?'Ativo':'Esgotado'}</button>
           <button type="button" class="action-btn delete" onclick="removerVariacaoValor('${t.id}', ${i})">✕</button>
        </div>
      </div>`).join('')

    return `
      <div style="border:1px solid var(--gray-light);border-radius:8px;padding:16px;background:var(--white);">
        <h4 style="margin-top:0;margin-bottom:12px;font-size:14px;color:var(--dark);">${t.nome}</h4>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">${presetsHTML}</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <input type="text" id="customVar_${t.id}" placeholder="Valor customizado" 
                 style="padding:8px 12px;border:1.5px solid var(--gray-light);border-radius:6px;flex:1;background:var(--bg);color:var(--dark)"/>
          <button type="button" class="btn-secondary" style="padding:6px 16px;" onclick="addVariacaoValorCustom('${t.id}')">Adicionar</button>
        </div>
        <div>${activeHTML}</div>
      </div>`
  }).join('')
}

function addVariacaoValor(tipo_id, valor) {
  if (!pecaVariacoes[tipo_id].find(v => v.valor === valor)) {
    pecaVariacoes[tipo_id].push({ valor, disponivel: true })
    renderVariacoesAtivas()
  }
}
function addVariacaoValorCustom(tipo_id) {
  const input = document.getElementById(`customVar_${tipo_id}`)
  const valor = input.value.trim()
  if (valor) { addVariacaoValor(tipo_id, valor); input.value = '' }
}
function toggleDisponibilidade(tipo_id, index) {
  pecaVariacoes[tipo_id][index].disponivel = !pecaVariacoes[tipo_id][index].disponivel
  renderVariacoesAtivas()
}
function removerVariacaoValor(tipo_id, index) {
  pecaVariacoes[tipo_id].splice(index, 1)
  renderVariacoesAtivas()
}

// ── Carregar peças ────────────────────────────────────────────
async function carregarPecasAdmin() {
  try {
    const { data, error } = await db.from('pecas').select('*').order('created_at', { ascending: false })
    if (error) throw error
    todasPecasAdmin = data || []
    atualizarStats()
    renderTabela()
  } catch (err) {
    console.error(err)
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:40px">Erro ao carregar. Verifique sua conexão.</td></tr>`
  }
}

function atualizarStats() {
  const total    = todasPecasAdmin.length
  const visiveis = todasPecasAdmin.filter(p => p.visivel).length
  document.getElementById('statTotal').textContent   = total
  document.getElementById('statVisible').textContent = visiveis
  document.getElementById('statHidden').textContent  = total - visiveis
  const statCat = document.getElementById('statCat')
  if(statCat) statCat.textContent = categorias.length
}

// ── Tabela ────────────────────────────────────────────────────
function renderTabela() {
  const lista = filtroAdminCat === 'todos'
    ? todasPecasAdmin
    : todasPecasAdmin.filter(p => p.categoria === filtroAdminCat)

  if (lista.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#888;padding:40px">Nenhuma peça encontrada.</td></tr>`
    return
  }

  tableBody.innerHTML = lista.map(peca => {
    const foto     = fotoPublicaAdmin(peca.foto_path)
    const catLabel = categorias.find(c => c.id === peca.categoria)?.nome || 'Sem categoria'
    const statusCls= peca.visivel ? 'visible' : 'hidden-product'
    const statusTxt= peca.visivel ? '● Visível' : '○ Oculta'
    const estoque  = peca.estoque != null
      ? (peca.estoque === 0 ? `<span style="color:var(--red); font-weight:600">Esgotado</span> <button type="button" class="action-btn" style="padding:2px 8px; font-size:10px; margin-left:6px; color:var(--dark); background:#eee; border:none;" onclick="promptReporEstoque('${peca.id}')">Repor</button>`
        : peca.estoque <= 3 ? `<span style="color:var(--red)">${peca.estoque} un.</span>`
        : `${peca.estoque} un.`)
      : '<span style="color:#bbb">—</span>'

    return `
      <tr>
        <td><img class="product-thumb" src="${foto}" alt="${peca.nome}" onerror="this.src='https://placehold.co/44x44/e8e8e4/888?text=?'" /></td>
        <td class="product-name-cell">${peca.nome}</td>
        <td>${catLabel}</td>
        <td class="price-cell">${formatarPreco(peca.preco)}</td>
        <td>${estoque}</td>
        <td><button class="toggle-btn ${statusCls}" onclick="toggleVisivel('${peca.id}',${peca.visivel})">${statusTxt}</button></td>
        <td>
          <button class="action-btn" onclick="editarPeca('${peca.id}')">✏️ Editar</button>
          <button class="action-btn delete" onclick="confirmarDelete('${peca.id}','${peca.nome.replace(/'/g,"\\'")}')">🗑 Deletar</button>
        </td>
      </tr>`
  }).join('')
}

function filtrarAdmin(btn) {
  document.querySelectorAll('[data-admin-cat]').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  filtroAdminCat = btn.dataset.adminCat
  renderTabela()
}

// ── Salvar peça ───────────────────────────────────────────────
async function salvarPeca() {
  const inputs = {
    nome: document.getElementById('inputNome'),
    categoria: document.getElementById('inputCategoria'),
    preco: document.getElementById('inputPreco'),
    estoque: document.getElementById('inputEstoque'),
    desc: document.getElementById('inputDesc'),
    url: [
      document.getElementById('inputImg'),
      document.getElementById('inputImg2'),
      document.getElementById('inputImg3'),
      document.getElementById('inputImg4')
    ]
  }

  const nome      = inputs.nome.value.trim()
  const categoria = inputs.categoria.value
  const preco     = parseFloat(inputs.preco.value)
  const estoqueVal= inputs.estoque.value
  const descricao = inputs.desc.value.trim()
  const fotoUrls  = inputs.url.map(inp => inp.value.trim())
  const editingId = document.getElementById('editingId').value

  // QC Validation
  if (!nome)      { inputs.nome.classList.add('input-error'); inputs.nome.focus(); return showToast('Informe o nome da peça.', 'error') }
  if (!categoria) { inputs.categoria.classList.add('input-error'); return showToast('Selecione uma categoria.', 'error') }
  if (isNaN(preco) || preco <= 0) { inputs.preco.classList.add('input-error'); return showToast('Informe um preço válido.', 'error') }
  
  if (!editingId && !fotosArquivos[0] && !fotoUrls[0]) {
     return showToast('Adicione a foto principal ou uma URL.', 'error')
  }

  // Clear errors on input
  Object.values(inputs).forEach(el => {
    el.oninput = () => el.classList.remove('input-error')
    if (el.tagName === 'SELECT') el.onchange = () => el.classList.remove('input-error')
  })

  const estoque = estoqueVal !== '' ? parseInt(estoqueVal) : null

  setBtnLoading(true)
  try {
    // Upload das fotos novas
    const paths = [...fotosExistentes]
    const uploads = fotosArquivos.map((file, i) => {
      if (!file) return Promise.resolve(null)
      const ext    = file.name.split('.').pop()
      const nome_  = `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`
      return db.storage.from(STORAGE_BUCKET).upload(nome_, file, { cacheControl:'3600', upsert:false })
        .then(({ error }) => { if (error) throw error; return nome_ })
    })

    const resultados = await Promise.all(uploads)
    resultados.forEach((path, i) => { if (path) paths[i] = path })
    
    // Fallback para URLs externas se não houver foto nova/existente no slot
    fotoUrls.forEach((url, i) => {
      if (url && !fotosArquivos[i] && !fotosExistentes[i]) {
        paths[i] = url
      }
    })

    const payload = {
      nome, categoria, preco, descricao, estoque,
      foto_path: paths[0] || null,
      foto_2:    paths[1] || null,
      foto_3:    paths[2] || null,
      foto_4:    paths[3] || null,
    }

    let resultPeca
    if (editingId) {
      const { data, error } = await db.from('pecas').update(payload).eq('id', editingId).select()
      if (error) throw error
      resultPeca = data[0]
      showToast('Peça atualizada! ✓', 'success')
      await db.from('variacoes_peca').delete().eq('peca_id', resultPeca.id)
    } else {
      const { data, error } = await db.from('pecas').insert([{ ...payload, visivel: true }]).select()
      if (error) throw error
      resultPeca = data[0]
      showToast('Peça cadastrada! ✓', 'success')
    }

    // Insert new variations
    const variacoesInsert = []
    Object.entries(pecaVariacoes).forEach(([tipo_id, vals]) => {
      vals.forEach(v => {
        variacoesInsert.push({ peca_id: resultPeca.id, tipo_variacao_id: tipo_id, valor: v.valor, disponivel: v.disponivel })
      })
    })
    if (variacoesInsert.length > 0) {
      await db.from('variacoes_peca').insert(variacoesInsert)
    }

    inputs.url.forEach(inp => inp.value = '')
    limparFormulario()
    await carregarPecasAdmin()
  } catch (err) {
    console.error(err)
    showToast('Erro ao salvar. Tente novamente.', 'error')
  } finally {
    setBtnLoading(false)
  }
}

// ── Editar ────────────────────────────────────────────────────
async function editarPeca(id) {
  const p = todasPecasAdmin.find(p => p.id === id)
  if (!p) return

  document.getElementById('inputNome').value      = p.nome
  document.getElementById('inputCategoria').value = p.categoria
  document.getElementById('inputPreco').value     = p.preco
  document.getElementById('inputEstoque').value   = p.estoque ?? ''
  
  const formGroupEstoque = document.getElementById('inputEstoque').parentElement
  let toggleBtn = document.getElementById('btnToggleEsgotado')
  if (!toggleBtn) {
    toggleBtn = document.createElement('button')
    toggleBtn.id = 'btnToggleEsgotado'
    toggleBtn.type = 'button'
    toggleBtn.style = 'margin-top:6px; font-size:12px; font-weight:600; padding:6px 10px; border-radius:4px; border:none; cursor:pointer; width:max-content; transition:0.2s;'
    formGroupEstoque.appendChild(toggleBtn)
  }

  if (p.estoque != null && p.estoque > 0) {
    toggleBtn.textContent = 'Marcar como Esgotado'
    toggleBtn.style.background = '#FDECEA'
    toggleBtn.style.color = 'var(--red)'
    toggleBtn.onclick = () => atualizarEstoqueBanco(p.id, 0)
    toggleBtn.style.display = 'block'
  } else if (p.estoque === 0) {
    toggleBtn.textContent = 'Marcar como Disponível'
    toggleBtn.style.background = '#E8F5EE'
    toggleBtn.style.color = 'var(--green)'
    toggleBtn.onclick = () => promptReporEstoque(p.id)
    toggleBtn.style.display = 'block'
  } else {
    toggleBtn.style.display = 'none'
  }
  document.getElementById('inputDesc').value      = p.descricao || ''
  document.getElementById('editingId').value      = p.id

  // Mostra fotos existentes nos slots
  const caminhos = [p.foto_path, p.foto_2, p.foto_3, p.foto_4]
  fotosExistentes = caminhos.map(c => c || '')
  fotosArquivos   = [null, null, null, null]

  caminhos.forEach((path, i) => {
    if (path) mostrarPreview(i, fotoPublicaAdmin(path))
  })

  document.getElementById('formTitle').textContent = '✏️ Editando Peça'
  saveBtnText.textContent = 'Salvar Alterações'
  cancelEditBtn.classList.remove('hidden')

  // Fetch variations
  const { data: vars } = await db.from('variacoes_peca').select('*').eq('peca_id', id)
  pecaVariacoes = {}
  if (vars) {
    vars.forEach(v => {
      if (!pecaVariacoes[v.tipo_variacao_id]) pecaVariacoes[v.tipo_variacao_id] = []
      pecaVariacoes[v.tipo_variacao_id].push({ valor: v.valor, disponivel: v.disponivel, id: v.id })
    })
  }
  renderVariacoesSelector()

  document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' })
}

function cancelarEdicao() { limparFormulario() }

function limparFormulario() {
  ['inputNome','inputCategoria','inputPreco','inputEstoque','inputDesc','editingId'].forEach(id => {
    document.getElementById(id).value = ''
  })
  fotosArquivos   = [null, null, null, null]
  fotosExistentes = ['', '', '', '']
  for (let i = 0; i < 4; i++) removerFoto(i)
  document.getElementById('formTitle').textContent = 'Cadastrar Nova Peça'
  saveBtnText.textContent = 'Cadastrar Peça'
  cancelEditBtn.classList.remove('hidden')
  cancelEditBtn.classList.add('hidden')
  
  const toggleBtn = document.getElementById('btnToggleEsgotado')
  if (toggleBtn) toggleBtn.style.display = 'none'

  pecaVariacoes = {}
  renderVariacoesSelector()
}

// ── Toggle visível ────────────────────────────────────────────
async function toggleVisivel(id, visivel) {
  try {
    const { error } = await db.from('pecas').update({ visivel: !visivel }).eq('id', id)
    if (error) throw error
    showToast(visivel ? 'Peça ocultada.' : 'Peça visível! ✓', visivel ? '' : 'success')
    await carregarPecasAdmin()
  } catch { showToast('Erro ao alterar status.', 'error') }
}

// ── Deletar ───────────────────────────────────────────────────
function confirmarDelete(id, nome) {
  if (!confirm(`Deletar "${nome}"?\nEssa ação não pode ser desfeita.`)) return
  deletarPeca(id)
}

async function deletarPeca(id) {
  try {
    const p = todasPecasAdmin.find(p => p.id === id)
    const paths = [p?.foto_path, p?.foto_2, p?.foto_3, p?.foto_4].filter(Boolean).filter(x => !x.startsWith('http'))
    if (paths.length) await db.storage.from(STORAGE_BUCKET).remove(paths)

    const { error } = await db.from('pecas').delete().eq('id', id)
    if (error) throw error
    showToast('Peça deletada.')
    await carregarPecasAdmin()
  } catch { showToast('Erro ao deletar.', 'error') }
}

// ── Relatório ─────────────────────────────────────────────────
async function carregarRelatorio(dias) {
  const container = document.getElementById('relatorioContainer')
  container.innerHTML = `<p style="color:#888;text-align:center;padding:32px">Carregando...</p>`

  try {
    // Monta filtro de data
    let query = db
      .from('eventos_carrinho')
      .select('peca_id')
      .eq('acao', 'adicionou')

    if (dias > 0) {
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', desde)
    }

    const { data: eventos, error } = await query

    if (error) {
      console.error('Erro na query eventos:', error)
      throw error
    }

    // Tabela vazia — sem dados ainda
    if (!eventos || eventos.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:32px;margin-bottom:12px">📊</div>
          <p style="color:var(--dark);font-weight:500;margin-bottom:6px">Nenhum dado ainda</p>
          <p style="color:var(--gray-mid);font-size:13px">
            Os dados aparecem aqui conforme as clientes adicionarem peças ao carrinho.
          </p>
        </div>`
      return
    }

    // Conta quantas vezes cada peça foi adicionada
    const contagem = {}
    eventos.forEach(e => {
      contagem[e.peca_id] = (contagem[e.peca_id] || 0) + 1
    })

    // Ordena e pega top 10
    const ordenado = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    const maxCount = ordenado[0][1]

    // Busca os nomes das peças separadamente (evita JOIN que pode falhar)
    const ids = ordenado.map(([id]) => id)
    const { data: pecas, error: erroPecas } = await db
      .from('pecas')
      .select('id, nome, categoria')
      .in('id', ids)

    if (erroPecas) console.warn('Erro ao buscar nomes:', erroPecas)

    const mapa = Object.fromEntries((pecas || []).map(p => [p.id, p]))

    // Busca nome da categoria separadamente
    const catIds = [...new Set((pecas || []).map(p => p.categoria).filter(Boolean))]
    let mapaCats = {}
    if (catIds.length > 0) {
      const { data: cats } = await db
        .from('categorias')
        .select('id, nome')
        .in('id', catIds)
      mapaCats = Object.fromEntries((cats || []).map(c => [c.id, c.nome]))
    }

    // Renderiza
    container.innerHTML = ordenado.map(([id, count], i) => {
      const peca    = mapa[id]
      const nome    = peca ? peca.nome : 'Peça removida'
      const catNome = peca ? (mapaCats[peca.categoria] || '') : ''
      const pct     = Math.round((count / maxCount) * 100)
      const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`

      return `
        <div class="relatorio-item">
          <div class="relatorio-rank">${medalha}</div>
          <div class="relatorio-info">
            <div class="relatorio-nome">
              ${nome}
              ${catNome ? `<span style="font-size:12px;color:#888"> · ${catNome}</span>` : ''}
            </div>
            <div class="relatorio-bar-wrap">
              <div class="relatorio-bar" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="relatorio-count">${count} <span>adições</span></div>
        </div>`
    }).join('')

  } catch (err) {
    console.error('ERRO RELATÓRIO:', err)
    container.innerHTML = `
      <div style="text-align:center;padding:40px">
        <p style="color:var(--red);margin-bottom:12px">Erro ao carregar o relatório.</p>
        <button onclick="carregarRelatorio(7)" class="btn-secondary">Tentar Novamente</button>
      </div>`
  }
}

function filtrarRelatorio(btn) {
  document.querySelectorAll('[data-periodo]').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  carregarRelatorio(parseInt(btn.dataset.periodo))
}

// ── Helpers ───────────────────────────────────────────────────
function fotoPublicaAdmin(path) {
  if (!path) return 'https://placehold.co/44x44/e8e8e4/888?text=?'
  if (path.startsWith('http')) return path
  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

function setBtnLoading(on) {
  saveBtn.disabled = on
  saveBtnText.classList.toggle('hidden', on)
  saveSpinner.classList.toggle('hidden', !on)
}

function showToast(msg, tipo = '') {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className   = `toast ${tipo} show`
  setTimeout(() => el.classList.remove('show'), 2800)
}

async function atualizarEstoqueBanco(id, valor) {
  try {
    const { error } = await db.from('pecas').update({ estoque: valor }).eq('id', id)
    if (error) throw error
    if (valor === 0) showToast('Marcada como esgotada!', 'success')
    else showToast('Estoque reposto com sucesso!', 'success')
    await carregarPecasAdmin()
    
    if (document.getElementById('editingId').value === id) {
       editarPeca(id)
    }
  } catch(e) {
    showToast('Erro ao atualizar estoque.', 'error')
  }
}

function promptReporEstoque(id) {
  const q = prompt('Digite a nova quantidade (unidades):')
  if (q === null) return
  const num = parseInt(q)
  if (isNaN(num) || num <= 0) {
     showToast('Quantidade inválida.', 'error')
     return
  }
  atualizarEstoqueBanco(id, num)
}