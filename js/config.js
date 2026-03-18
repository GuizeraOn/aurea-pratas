// ============================================================
//  AUREA PRATAS — js/config.js
//  Configuração do Supabase
// ============================================================

const SUPABASE_URL  = 'https://hebfmphzpavqorjjzlgr.supabase.co'
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYmZtcGh6cGF2cW9yamp6bGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzk3MzEsImV4cCI6MjA4OTM1NTczMX0.yIB7gXzEdNIZ1-5z-2bF3WKYc0w1MNkwjSB2yPN1H4g'

// Número do WhatsApp da dona (com DDI e DDD, sem espaços ou traços)
// Exemplo: 5531999990000  → 55 (Brasil) + 31 (BH) + número
const WHATSAPP_NUMBER = '55XXXXXXXXXXX'  // ← TROQUE PELO NÚMERO DELA

// Nome do bucket de fotos no Supabase Storage
const STORAGE_BUCKET = 'fotos-pecas'

// ── Inicializa cliente Supabase (via CDN, carregado nos HTMLs) ──
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)