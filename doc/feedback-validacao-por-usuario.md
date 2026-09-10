# Guia de validação por usuário (feedback cliente)

**Ambiente atual do app:** https://536-marcio.vercel.app  
**Landing (Firebase Hosting / Spark):** https://marcio-ab7d9.web.app  

> Se a landing Firebase estiver desatualizada (deploy sem acesso à conta do projeto), use a landing Next na Vercel:  
> Home: `https://536-marcio.vercel.app/` · Fornecedores: `https://536-marcio.vercel.app/fornecedores`

**Senha demo:** `123456`

---

## Contas demo × o que validar

| Usuário (e-mail) | Perfil | Onde entrar | O que este usuário deve ver |
|------------------|--------|-------------|-----------------------------|
| `sindico@demo.cotacondo.com.br` | **Síndico** | `/acesse` → `/app` | Dashboard numérico + gráfico % por status; banner rotativo no topo do `/app`; **Meu Plano** com planos de síndico; **Indicações**; **Cotações** / Nova cotação (botão magenta); barra de progresso ao trocar de página |
| `fornecedor@demo.cotacondo.com.br` | **Fornecedor** | `/acesse` → `/app` | Banner no `/app`; **Oportunidades** → toggle **Kanban** (`?view=kanban`) com **total R$ por coluna**; gráfico % no dashboard; Compliance; Meu Plano |
| `adm.master@demo.cotacondo.com.br` | **Adm Master** (Administradora + papel master) | `/acesse` → `/app` | Tudo do solicitante + **Equipe** (`/app/equipe`); **Financeiro** (comissões); Parcerias/Favoritos se plano Premium; Indicações |
| `adm.operacional@demo.cotacondo.com.br` | **Adm Operacional** | `/acesse` → `/app` | Cotações/condomínios; **sem** Financeiro; Equipe visível (convite só Master) |
| `admin@cotacondo.com.br` | **Master Admin** (plataforma) | `/acesse` → `/app` | **Plataforma**, Catálogo, Compliance global, **Banners** — *não* é o menu Equipe da administradora |
| `masterservice@demo.cotacondo.com.br` | **Master Service** | `/acesse` → `/app` | Pipeline Service, Clientes, Relatórios |

---

## Resposta ponto a ponto do feedback

### 1 — Identidade visual
| Item | Status | Notas |
|------|--------|-------|
| Contorno do logo mais fino | Aguardando arquivo do cliente | Assim que enviar o PNG/SVG, substituímos em `public/brand/` e `hosting-static/brand/` |
| Magenta `#c10089` (botões de ação) | Aplicado | Botões primary, CTAs, accents |
| Ciano `#00aab3` | Aplicado | Secundário / totais / accents |
| Remover `#102A43` da paleta | Aplicado no shell/marketing | Sidebar **sólida** `#00535a` (ciano escuro da família do logo), sem degradê navy |

### 2 — Melhorias no cadastro · **Síndico**
| Onde | URL |
|------|-----|
| Cadastro síndico | Vercel: `/cadastro` ou `/cadastro?tipo=sindico` |
| Comportamento | Formulário controlado: em erro de validação/API **mantém** nome, e-mail, tipo, organização, documento e privacidade |

### 3 — Progresso e indicações · **Síndico**
| Item | Usuário | Onde |
|------|---------|------|
| Barra de progresso de navegação | Todos (incl. síndico) | Faixa fina no **topo da janela** ao clicar em qualquer link interno |
| Indicações | Síndico, Fornecedor, Adm | Menu **Indicações** → `/app/indicacoes` (copiar link, lista Free/Pago) |

### 4 — Planos para síndico · **Síndico**
| Onde | URL |
|------|-----|
| No app | Menu **Meu Plano** → `/app/meu-plano` |
| Na landing | Home `#planos` (Vercel `/` ou Hosting `/`) |
| Checkout | `/checkout?plan=sindico-…` |

### 5 — Landing fornecedor · banner
| Ambiente | Onde ver o banner |
|----------|-------------------|
| **Vercel (Next)** | `https://536-marcio.vercel.app/fornecedores` — carrossel no topo com setas |
| **Firebase Hosting** | `https://marcio-ab7d9.web.app/fornecedores` — seção banners (precisa redeploy Hosting com conta que tem acesso a `marcio-ab7d9`) |

### 6 — Banners rotativos no app · **Síndico** (e demais)
| Usuário | Onde |
|---------|------|
| Síndico / Fornecedor / Adm / … | Topo de **qualquer** página `/app/*` (abaixo do header) |
| Fallback | Se o Firestore não tiver banners seedados, o app mostra slides padrão por perfil |

### 7 — Kanban financeiro · **Fornecedor**
| O que é | Onde | Usuário |
|---------|------|---------|
| Kanban de oportunidades (totais R$ por etapa) | `/app/oportunidades` → botão **Kanban** | **Fornecedor** |
| Financeiro (comissões) | `/app/financeiro` | **Adm Master** apenas — *não* é o kanban do fornecedor |

**Dashboard:** cards numéricos + **gráfico de % por status** (alimentado pelos KPIs) no `/app` para Síndico/Adm, Fornecedor e Master Service.

### 8 — Gestão de equipe · **Adm Master**
| Usuário correto | E-mail | Menu |
|-----------------|--------|------|
| Administradora Master | `adm.master@demo.cotacondo.com.br` | **Equipe** → `/app/equipe` |
| Master Admin (plataforma) | `admin@cotacondo.com.br` | **não** tem Equipe de administradora — usa **Plataforma** |

Na Equipe: convidar operacional/master, aprovadores externos e editar escopos de condomínio.

---

## Checklist rápido de aceite (cliente)

1. Login síndico → ver banner no `/app` + gráfico % + Meu Plano + Indicações.  
2. Navegar entre menus → ver barra magenta/ciano no topo.  
3. Abrir `/cadastro?tipo=sindico` → errar de propósito → campos permanecem.  
4. Login fornecedor → Oportunidades → Kanban → totais R$ nas colunas.  
5. Abrir `…/fornecedores` na **Vercel** → banner com setas.  
6. Login `adm.master@…` → menu **Equipe**.  

---

## Logo (próximo passo)

Enviar o arquivo com contorno fino. Substituiremos:

- `public/brand/logo-transparent-v2.png` (e variantes usadas pelo `Logo.tsx`)
- `hosting-static/brand/…`
