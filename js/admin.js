// ============================================================
//  ÁUREAS PRATA — js/admin.js
//  Lógica do painel administrativo
// ============================================================

// ── Estado ──────────────────────────────────────────────────
let todasPecasAdmin = []
let filtroAdminCat  = 'todos'
let fotoArquivos    = [null, null, null, null]
let fotosAtuais     = [null, null, null, null]

const CATEGORIAS = {
  aneis:     'Anéis',
  colares:   'Colares',
  brincos:   'Brincos',
  pulseiras: 'Pulseiras',
}

// ── Elementos ───────────────────────────────────────────────
const toastEl      = document.getElementById('toast')
const tableBody    = document.getElementById('adminTableBody')
const saveBtn      = document.getElementById('saveBtn')
const saveBtnText  = document.getElementById('saveBtnText')
const saveSpinner  = document.getElementById('saveSpinner')
const cancelEditBtn= document.getElementById('cancelEditBtn')

// ── Inicialização ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  carregarPecasAdmin()
  carregarRelatorio()
})

// ── Upload de foto ───────────────────────────────────────────
function previewUpload(input, index) {
  const file = input.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    showToast('Foto muito grande! Máximo 5MB.', 'error')
    input.value = ''
    return
  }
  
  fotoArquivos[index] = file
  const reader = new FileReader()
  reader.onload = e => setSlotImage(index, e.target.result)
  reader.readAsDataURL(file)
}

function setSlotImage(index, url) {
  const slot = document.getElementById(`slot${index}`)
  slot.classList.add('has-image')
  
  // Remove imagem antiga e botão de remoção se existirem
  const oldImg = slot.querySelector('img')
  if (oldImg) oldImg.remove()
  const oldBtn = slot.querySelector('.remove-photo')
  if (oldBtn) oldBtn.remove()
  
  // Cria nova imagem
  const img = document.createElement('img')
  img.src = url
  slot.appendChild(img)
  
  // Botão de remoção
  const removeBtn = document.createElement('div')
  removeBtn.className = 'remove-photo'
  removeBtn.innerHTML = '&times;'
  removeBtn.onclick = (e) => {
    e.stopPropagation()
    limparSlot(index)
  }
  slot.appendChild(removeBtn)
}

function limparSlot(index) {
  fotoArquivos[index] = null
  fotosAtuais[index] = null
  const input = document.getElementById(`photoInput${index}`)
  if (input) input.value = ''
  
  const slot = document.getElementById(`slot${index}`)
  slot.classList.remove('has-image')
  const oldImg = slot.querySelector('img')
  if (oldImg) oldImg.remove()
  const oldBtn = slot.querySelector('.remove-photo')
  if (oldBtn) oldBtn.remove()
}

// ── Carregar peças ────────────────────────────────────────────
async function carregarPecasAdmin() {
  try {
    const { data, error } = await db
      .from('pecas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    todasPecasAdmin = data || []
    atualizarStats()
    renderTabela()
  } catch (err) {
    console.error('Erro ao carregar:', err)
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#C0392B;padding:40px">Erro ao carregar. Verifique sua conexão.</td></tr>`
  }
}

// ── Stats ─────────────────────────────────────────────────────
function atualizarStats() {
  const total   = todasPecasAdmin.length
  const visiveis= todasPecasAdmin.filter(p => p.visivel).length
  const ocultas = total - visiveis
  document.getElementById('statTotal').textContent   = total
  document.getElementById('statVisible').textContent = visiveis
  document.getElementById('statHidden').textContent  = ocultas
}

// ── Renderizar tabela ─────────────────────────────────────────
function renderTabela() {
  const lista = filtroAdminCat === 'todos'
    ? todasPecasAdmin
    : todasPecasAdmin.filter(p => p.categoria === filtroAdminCat)

  if (lista.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:40px">Nenhuma peça encontrada.</td></tr>`
    return
  }

  tableBody.innerHTML = lista.map(peca => {
    const fotoURL  = fotoPublicaAdmin(peca.foto_path)
    const catLabel = CATEGORIAS[peca.categoria] || peca.categoria
    const statusCls= peca.visivel ? 'visible' : 'hidden-product'
    const statusTxt= peca.visivel ? '● Visível' : '○ Oculta'

    return `
      <tr>
        <td>
          <img
            class="product-thumb"
            src="${fotoURL}"
            alt="${peca.nome}"
            onerror="this.src='https://placehold.co/44x44/e8e8e4/888?text=?'"
          />
        </td>
        <td class="product-name-cell">${peca.nome}</td>
        <td>${catLabel}</td>
        <td class="price-cell">${formatarPreco(peca.preco)}</td>
        <td>
          <button
            class="toggle-btn ${statusCls}"
            onclick="toggleVisivel('${peca.id}', ${peca.visivel})"
            title="Clique para ${peca.visivel ? 'ocultar' : 'mostrar'}"
          >${statusTxt}</button>
        </td>
        <td>
          <button class="action-btn" onclick="editarPeca('${peca.id}')">✏️ Editar</button>
          <button class="action-btn delete" onclick="confirmarDelete('${peca.id}', '${peca.nome.replace(/'/g, "\\'")}')">🗑 Deletar</button>
        </td>
      </tr>`
  }).join('')
}

// ── Filtro da tabela admin ────────────────────────────────────
function filtrarAdmin(btn) {
  document.querySelectorAll('[data-admin-cat]').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  filtroAdminCat = btn.dataset.adminCat
  renderTabela()
}

// ── Salvar peça (criar ou editar) ─────────────────────────────
async function salvarPeca() {
  const nome      = document.getElementById('inputNome').value.trim()
  const categoria = document.getElementById('inputCategoria').value
  const preco     = parseFloat(document.getElementById('inputPreco').value)
  let estoque     = parseInt(document.getElementById('inputEstoque').value, 10)
  if (isNaN(estoque)) estoque = null
  const descricao = document.getElementById('inputDesc').value.trim()
  const editingId = document.getElementById('editingId').value

  // Validação
  if (!nome)      return showToast('Informe o nome da peça.', 'error')
  if (!categoria) return showToast('Selecione uma categoria.', 'error')
  if (isNaN(preco) || preco <= 0) return showToast('Informe um preço válido.', 'error')
  
  // Pelo menos 1 foto na principal ou existente
  if (!editingId && !fotoArquivos[0]) return showToast('Adicione a foto principal.', 'error')

  setBtnLoading(true)

  try {
    let foto_paths = [...fotosAtuais] // inicia com os caminhos atuais se houver

    const uploads = fotoArquivos.map(async (arquivo, idx) => {
      if (!arquivo) return null
      const ext      = arquivo.name.split('.').pop()
      const nomeArq  = `${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(nomeArq, arquivo, { cacheControl: '3600', upsert: false })

      if (uploadErr) throw uploadErr
      return nomeArq
    })

    const novosPaths = await Promise.all(uploads)
    
    // Mescla os novos uploads nos paths atuais
    for (let i=0; i<4; i++) {
        if (novosPaths[i]) foto_paths[i] = novosPaths[i]
    }

    if (editingId) {
      // ── EDITAR ──
      const updates = { 
        nome, categoria, preco, descricao, estoque,
        foto_path: foto_paths[0],
        foto_2: foto_paths[1] || null,
        foto_3: foto_paths[2] || null,
        foto_4: foto_paths[3] || null
      }

      const { error } = await db
        .from('pecas')
        .update(updates)
        .eq('id', editingId)

      if (error) throw error
      showToast('Peça atualizada com sucesso! ✓', 'success')
    } else {
      // ── CRIAR ──
      const { error } = await db
        .from('pecas')
        .insert([{ 
          nome, categoria, preco, descricao, estoque,
          foto_path: foto_paths[0],
          foto_2: foto_paths[1] || null,
          foto_3: foto_paths[2] || null,
          foto_4: foto_paths[3] || null,
          visivel: true 
        }])

      if (error) throw error
      showToast('Peça cadastrada com sucesso! ✓', 'success')
    }

    limparFormulario()
    await carregarPecasAdmin()

  } catch (err) {
    console.error('Erro ao salvar:', err)
    showToast('Erro ao salvar. Tente novamente.', 'error')
  } finally {
    setBtnLoading(false)
  }
}

// ── Editar peça ───────────────────────────────────────────────
function editarPeca(id) {
  const peca = todasPecasAdmin.find(p => p.id === id)
  if (!peca) return

  limparFormulario()

  document.getElementById('inputNome').value      = peca.nome
  document.getElementById('inputCategoria').value = peca.categoria
  document.getElementById('inputPreco').value     = peca.preco
  document.getElementById('inputEstoque').value   = peca.estoque !== null ? peca.estoque : ''
  document.getElementById('inputDesc').value      = peca.descricao || ''
  document.getElementById('editingId').value      = peca.id

  fotosAtuais = [
    peca.foto_path || null,
    peca.foto_2 || null,
    peca.foto_3 || null,
    peca.foto_4 || null
  ]

  fotosAtuais.forEach((path, idx) => {
    if (path) {
      setSlotImage(idx, fotoPublicaAdmin(path))
    }
  })

  document.getElementById('formTitle').textContent = '✏️ Editando Peça'
  saveBtnText.textContent = 'Salvar Alterações'
  cancelEditBtn.classList.remove('hidden')

  // Rola para o formulário
  document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' })
}

// ── Cancelar edição ───────────────────────────────────────────
function cancelarEdicao() {
  limparFormulario()
}

function limparFormulario() {
  document.getElementById('inputNome').value      = ''
  document.getElementById('inputCategoria').value = ''
  document.getElementById('inputPreco').value     = ''
  document.getElementById('inputEstoque').value   = ''
  document.getElementById('inputDesc').value      = ''
  document.getElementById('editingId').value      = ''
  
  for(let i=0; i<4; i++) limparSlot(i)

  document.getElementById('formTitle').textContent = 'Cadastrar Nova Peça'
  saveBtnText.textContent = 'Cadastrar Peça'
  cancelEditBtn.classList.add('hidden')
}

// ── Toggle visível / oculto ───────────────────────────────────
async function toggleVisivel(id, visivel) {
  try {
    const { error } = await db
      .from('pecas')
      .update({ visivel: !visivel })
      .eq('id', id)

    if (error) throw error
    showToast(visivel ? 'Peça ocultada.' : 'Peça visível novamente! ✓', visivel ? '' : 'success')
    await carregarPecasAdmin()
  } catch (err) {
    showToast('Erro ao alterar status.', 'error')
  }
}

// ── Deletar peça ──────────────────────────────────────────────
function confirmarDelete(id, nome) {
  if (!confirm(`Tem certeza que deseja deletar "${nome}"?\nEssa ação não pode ser desfeita.`)) return
  deletarPeca(id)
}

async function deletarPeca(id) {
  try {
    const peca = todasPecasAdmin.find(p => p.id === id)

    // Remove foto do storage se existir
    if (peca?.foto_path && !peca.foto_path.startsWith('http')) {
      await db.storage.from(STORAGE_BUCKET).remove([peca.foto_path])
    }

    const { error } = await db.from('pecas').delete().eq('id', id)
    if (error) throw error

    showToast('Peça deletada.', '')
    await carregarPecasAdmin()
    carregarRelatorio()
  } catch (err) {
    showToast('Erro ao deletar.', 'error')
  }
}

// ── Helpers ───────────────────────────────────────────────────
function fotoPublicaAdmin(path) {
  if (!path) return 'https://placehold.co/44x44/e8e8e4/888?text=?'
  if (path.startsWith('http')) return path
  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

// ── Relatório de Peças ────────────────────────────────────────
async function carregarRelatorio() {
  const dias = document.getElementById('reportFilter').value
  const listEl = document.getElementById('reportList')

  try {
    let query = db.from('eventos_carrinho').select('peca_id, acao, created_at').eq('acao', 'adicionou')
    
    if (dias !== 'todos') {
      const ms = parseInt(dias) * 24 * 60 * 60 * 1000
      const d = new Date(Date.now() - ms).toISOString()
      query = query.gte('created_at', d)
    }

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) {
      listEl.innerHTML = '<div style="color:var(--gray-mid); text-align:center; padding: 20px;">Nenhuma adição registrada nesse período.</div>'
      return
    }

    // Agrupar
    const contagem = {}
    data.forEach(e => {
        contagem[e.peca_id] = (contagem[e.peca_id] || 0) + 1
    })

    const rank = Object.keys(contagem).map(id => {
      const peca = todasPecasAdmin.find(p => p.id === id)
      return {
        id,
        nome: peca ? peca.nome : 'Peça deletada',
        count: contagem[id]
      }
    }).sort((a,b) => b.count - a.count)

    const maxCount = rank[0].count

    listEl.innerHTML = rank.map(item => {
      const pct = (item.count / maxCount) * 100
      return `
        <div class="report-item">
           <div class="report-bar-wrap">
              <div class="report-bar" style="width: ${pct}%"></div>
              <div class="report-label">${item.nome}</div>
           </div>
           <div class="report-count">${item.count}</div>
        </div>
      `
    }).join('')

  } catch (err) {
    console.error('Erro no relatório', err)
    listEl.innerHTML = '<div style="color:red;text-align:center;">Erro ao carregar relatório.</div>'
  }
}