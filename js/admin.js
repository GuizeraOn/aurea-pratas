// ============================================================
//  ÁUREAS PRATA — js/admin.js
// ============================================================

let todasPecasAdmin = []
let filtroAdminCat  = 'todos'
let fotosArquivos   = [null, null, null, null]   // até 4 fotos
let fotosExistentes = ['', '', '', '']           // paths já salvos (edição)

const CATEGORIAS = { aneis:'Anéis', colares:'Colares', brincos:'Brincos', pulseiras:'Pulseiras' }

const toastEl       = document.getElementById('toast')
const tableBody     = document.getElementById('adminTableBody')
const saveBtn       = document.getElementById('saveBtn')
const saveBtnText   = document.getElementById('saveBtnText')
const saveSpinner   = document.getElementById('saveSpinner')
const cancelEditBtn = document.getElementById('cancelEditBtn')

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  configurarSlots()
  carregarPecasAdmin()
  carregarRelatorio(7)
})

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
    if (economia > 5) showToast(`Foto otimizada! ${kb1}KB → ${kb2}KB $(-${economia}%)`, 'success')

    const reader = new FileReader()
    reader.onload = e => mostrarPreview(idx, e.target.result)
    reader.readAsDataURL(webpFile)
  } catch (err) {
    console.error(err)
    showToast('Erro ao comprimir imagem', 'error')
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
    const catLabel = CATEGORIAS[peca.categoria] || peca.categoria
    const statusCls= peca.visivel ? 'visible' : 'hidden-product'
    const statusTxt= peca.visivel ? '● Visível' : '○ Oculta'
    const estoque  = peca.estoque != null
      ? (peca.estoque === 0 ? '<span style="color:var(--red)">Esgotado</span>'
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
  const nome      = document.getElementById('inputNome').value.trim()
  const categoria = document.getElementById('inputCategoria').value
  const preco     = parseFloat(document.getElementById('inputPreco').value)
  const estoqueVal= document.getElementById('inputEstoque').value
  const descricao = document.getElementById('inputDesc').value.trim()
  const editingId = document.getElementById('editingId').value

  if (!nome)                          return showToast('Informe o nome da peça.', 'error')
  if (!categoria)                     return showToast('Selecione uma categoria.', 'error')
  if (isNaN(preco) || preco <= 0)     return showToast('Informe um preço válido.', 'error')
  if (!editingId && !fotosArquivos[0]) return showToast('Adicione pelo menos a foto principal.', 'error')

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

    const payload = {
      nome, categoria, preco, descricao, estoque,
      foto_path: paths[0] || null,
      foto_2:    paths[1] || null,
      foto_3:    paths[2] || null,
      foto_4:    paths[3] || null,
    }

    if (editingId) {
      const { error } = await db.from('pecas').update(payload).eq('id', editingId)
      if (error) throw error
      showToast('Peça atualizada! ✓', 'success')
    } else {
      const { error } = await db.from('pecas').insert([{ ...payload, visivel: true }])
      if (error) throw error
      showToast('Peça cadastrada! ✓', 'success')
    }

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
function editarPeca(id) {
  const p = todasPecasAdmin.find(p => p.id === id)
  if (!p) return

  document.getElementById('inputNome').value      = p.nome
  document.getElementById('inputCategoria').value = p.categoria
  document.getElementById('inputPreco').value     = p.preco
  document.getElementById('inputEstoque').value   = p.estoque ?? ''
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
  cancelEditBtn.classList.add('hidden')
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
    let query = db.from('eventos_carrinho').select('peca_id').eq('acao', 'adicionou')
    if (dias > 0) {
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', desde)
    }
    const { data: eventos, error } = await query
    if (error) throw error

    if (!eventos || eventos.length === 0) {
      container.innerHTML = `<p style="color:#888;text-align:center;padding:32px">Nenhum dado ainda. As peças aparecerão aqui conforme as clientes adicionarem ao carrinho.</p>`
      return
    }

    // Conta por peça
    const contagem = {}
    eventos.forEach(e => { contagem[e.peca_id] = (contagem[e.peca_id] || 0) + 1 })
    const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const maxCount = ordenado[0][1]

    // Busca nomes
    const ids = ordenado.map(([id]) => id)
    const { data: pecas } = await db.from('pecas').select('id,nome,categoria').in('id', ids)
    const mapa = Object.fromEntries((pecas || []).map(p => [p.id, p]))

    container.innerHTML = ordenado.map(([id, count], i) => {
      const peca   = mapa[id]
      const nome   = peca ? peca.nome : 'Peça removida'
      const cat    = peca ? (CATEGORIAS[peca.categoria] || peca.categoria) : ''
      const pct    = Math.round((count / maxCount) * 100)
      const medalha= i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`
      return `
        <div class="relatorio-item">
          <div class="relatorio-rank">${medalha}</div>
          <div class="relatorio-info">
            <div class="relatorio-nome">${nome} ${cat ? `<span style="font-size:12px;color:#888">· ${cat}</span>` : ''}</div>
            <div class="relatorio-bar-wrap"><div class="relatorio-bar" style="width:${pct}%"></div></div>
          </div>
          <div class="relatorio-count">${count} <span>adições</span></div>
        </div>`
    }).join('')
  } catch (err) {
    console.error(err)
    container.innerHTML = `<p style="color:var(--red);text-align:center;padding:32px">Erro ao carregar relatório.</p>`
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
  toastEl.textContent = msg
  toastEl.className   = `toast ${tipo} show`
  setTimeout(() => toastEl.classList.remove('show'), 2800)
}