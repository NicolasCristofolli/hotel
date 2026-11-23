# Guia do Hóspede — Portal & Concierge Digital (white-label)

Portal mobile para hóspedes de hotel (acessado por QR Code) + painel administrativo para a equipe.

**Stack:** React 18 · TypeScript · Vite · Framer Motion · Lucide. **Supabase** (banco, login, tempo real e arquivos). Sem as variáveis do Supabase, roda em _modo demonstração_ (dados no `localStorage`, PIN 1234).

## Começando

Requisitos: Node 18+.

```bash
npm install
cp .env.example .env.local   # opcional por enquanto — usado pela integração com Supabase
npm run dev                  # http://localhost:5173 (já expõe na rede local para testar o QR no celular)
```

| Script                 | O que faz                                        |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Servidor de desenvolvimento                      |
| `npm run build`        | Checagem de tipos + build de produção em `dist/` |
| `npm run preview`      | Serve o build localmente                         |
| `npm run typecheck`    | Só a checagem de tipos                           |
| `npm run format`       | Formata o código (Prettier)                      |
| `npm run format:check` | Verifica a formatação (usado no CI)              |

O CI (`.github/workflows/ci.yml`) roda formatação + build a cada push/PR na `main`.

## Deploy

Um único site serve todos os hotéis: **`hotelguia.com.br/<id-do-hotel>`** (o id é a linha da tabela `hotels`).
Build command `npm run build`, output `dist`. Como o hotel vem do caminho da URL, a hospedagem precisa devolver o
`index.html` para qualquer caminho — o `vercel.json` já faz isso (em outra hospedagem, configure o equivalente "SPA fallback").

### Domínio hotelguia.com.br (Vercel + Registro.br)

1. Vercel → projeto → **Settings → Domains → Add**: `hotelguia.com.br` e `www.hotelguia.com.br` (redirecionando para o sem www).
2. A Vercel mostra os registros DNS. No **Registro.br → domínio → DNS → Editar zona**, crie exatamente os que ela pedir
   (normalmente um `A` para `hotelguia.com.br` e um `CNAME` para `www`). O HTTPS sai sozinho depois que o DNS propagar.
3. Vercel → **Settings → Environment Variables**: **apague `VITE_HOTEL_ID`** (senão a raiz do site abre esse hotel em vez
   da página da plataforma) e faça **Redeploy**.
4. Supabase → **Authentication → URL Configuration**: _Site URL_ = `https://hotelguia.com.br`; em _Redirect URLs_, adicione
   `https://hotelguia.com.br/**`.
5. Se usar Turnstile: Cloudflare → Turnstile → widget → adicione o domínio `hotelguia.com.br`.
6. Gere os QR Codes novos com o endereço do hotel (ex.: `https://hotelguia.com.br/vale-sereno`) — o painel de cada hotel fica
   em `https://hotelguia.com.br/vale-sereno#/admin`.

## Rotas

O primeiro trecho do caminho escolhe o hotel; o resto da navegação usa hash. `hotelguia.com.br/` é a página da plataforma
(com campo para digitar o código do hotel) e um endereço de hotel inexistente mostra "Hotel não encontrado".
Ids reservados (não podem ser hotel): veja `RESERVED` em `src/lib/tenant.ts` e `0005_multi_hotel.sql`.

Dentro de `hotelguia.com.br/<id-do-hotel>`:

| Rota                                                                 | Tela                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `#/`                                                                 | Início — Portal do Hóspede                                           |
| `#/servicos` · `#/servicos?c=gastronomia` · `#/servicos/restaurante` | Horários, Gastronomia & Drinks                                       |
| `#/programacao`                                                      | Programação do Hotel                                                 |
| `#/mapa` · `#/mapa/p4`                                               | Mapa Interativo (com foco no pino)                                   |
| `#/experience/spa` · `concierge` · `transfer`                        | Detalhe de experiência                                               |
| `#/admin`                                                            | Painel Administrativo — só pelo link direto (não há botão no portal) |

## Painel administrativo

- **Identidade & Configurações** — nome, textos, contato, Wi-Fi, imagens, paleta de cores e **logo** (substitui o monograma).
- **Painel Inicial** — cria, exclui, reordena, oculta e edita os atalhos de "Sua estadia, em um toque" (também usados no menu lateral)
  e os **pedidos rápidos** de "Falar com a Recepção" (cada um abre o WhatsApp da recepção com a mensagem pronta).
- **Recados & Avisos** — avisos ao vivo no topo do Início.
- **Programação & Eventos** — agenda semanal; atividades novas nascem como **rascunho** (salvas, mas ocultas) até serem publicadas.
- **Horários & Serviços** e **Editor Visual do Mapa**.
- **Relatórios** — atalhos mais clicados, eventos com mais interesse, o que os hóspedes mais pedem, serviços/pontos mais vistos, uso por horário e por dia; exportação CSV.

### Imagens

Todas as imagens (logo, banner, rodapé, serviços, mapa e pontos do mapa) são enviadas **por upload** — não há campo de URL.
Antes de subir, o próprio navegador redimensiona e comprime a foto (WebP; JPEG/PNG onde WebP não é suportado):

| Uso                        | Lado maior | Tamanho alvo |
| -------------------------- | ---------- | ------------ |
| Logo (SVG também é aceito) | 480 px     | ~150 KB      |
| Banner principal           | 1920 px    | ~400 KB      |
| Rodapé, serviços, pontos   | 1280 px    | ~250 KB      |
| Mapa                       | 2048 px    | ~600 KB      |

Originais de até 15 MB são aceitos. No servidor, o bucket recusa qualquer arquivo acima de **1 MB** (`0003_image_limits.sql`).

Para o hóspede, "Adicionar à agenda" baixa um arquivo `.ics` com alarme 15 min antes — quem avisa é a agenda do próprio celular.

## Adaptar para um novo hotel

Todo o conteúdo padrão fica em **`src/config/defaultHotelConfig.ts`**. O painel edita a mesma estrutura em tempo real
(botão **Restaurar Padrão** volta ao arquivo).

- Ícones são referenciados por nome: registre novos em `src/lib/icons.tsx`.
- Mapa: deixe `mapImage` vazio para usar o mapa ilustrado ou informe a URL de uma imagem 4:3.
- Clima ao vivo via Open-Meteo (`latitude`/`longitude`); sem rede, usa `weatherFallback`.
- Ao mudar a estrutura do config de forma incompatível, incremente `version` (descarta dados antigos salvos).

## Estrutura

```
src/
  admin/        painel administrativo (abas em admin/tabs)
  components/   componentes do portal
  config/       conteúdo padrão do hotel
  lib/          utilitários (analytics, agenda .ics, ícones, status, scroll desktop)
  state/        contextos (configuração, rotas, acesso admin, toasts)
  views/        telas do portal
```

## Analytics

`src/lib/analytics.ts` registra interações **anônimas** (tipo, item, horário e um id aleatório por visita — sem nome,
telefone ou quarto). Cliques feitos na pré-visualização do admin não contam. O armazenamento passa pela interface
`AnalyticsStore`: hoje é `localStorage` (dados só do navegador atual); com Supabase, troca-se apenas a implementação.

## Supabase

### Instalação (uma vez por projeto)

1. **SQL Editor → New query:** cole e rode `supabase/migrations/0001_init.sql`. Cria as tabelas, as regras de segurança (RLS),
   o tempo real, o bucket de imagens e o hotel inicial `vale-sereno`. Pode rodar de novo sem problemas.
2. **Authentication → Users → Add user → Create new user:** e-mail + senha forte, marque _Auto Confirm User_.
3. **SQL Editor:** abra `supabase/02_add_admin.sql`, troque o e-mail e rode, para dar acesso ao hotel.
4. **Authentication → Sign In / Providers:** desative _Allow new users to sign up_. Só quem você cadastrar entra.
5. Crie o `.env.local` a partir do `.env.example` (URL do projeto + _publishable key_). Na hospedagem, configure as mesmas variáveis.

### Segurança do login (uma vez)

6. **SQL Editor:** rode `supabase/migrations/0003_image_limits.sql` (limite de 1 MB por imagem) e `supabase/migrations/0002_require_mfa.sql` — o banco passa a exigir 2FA para editar e ver relatórios.
   Depois rode `supabase/migrations/0004_public_config_cdn.sql` e **salve qualquer alteração no painel uma vez**: o portal dos
   hóspedes passa a ler `hotel-assets/<hotel>/config.json` pelo CDN (sem consultar o banco). Cada salvamento do admin
   republica o arquivo; os hóspedes veem a mudança em até ~1 minuto (ao voltar para a aba ou a cada 5 min com ela aberta).
   Por fim rode `supabase/migrations/0005_multi_hotel.sql` (reserva ids usados pela plataforma).
7. **Authentication → URL Configuration:** _Site URL_ = endereço do site (ex.: `https://seu-site.vercel.app`) e, em
   _Redirect URLs_, adicione `https://seu-site.vercel.app/**` e `http://localhost:5173/**` (usado pelo "Esqueci minha senha").
8. **Authentication → Providers → Email:** senha mínima de 10 caracteres, exigindo letras e números.
9. **E-mails (recuperação de senha):** o envio padrão do Supabase só entrega para membros da equipe do projeto e tem limite
   baixo por hora. Para produção, configure um SMTP próprio em _Authentication → Emails → SMTP Settings_ (ex.: Resend, Brevo).
10. **CAPTCHA (opcional, nesta ordem):**
    1. Cloudflare → Turnstile → _Add widget_ com o domínio do site (e `localhost`) → copie a _Site Key_ e a _Secret Key_.
    2. Na Vercel, crie `VITE_TURNSTILE_SITE_KEY` com a Site Key e faça **Redeploy**.
    3. Só então: Supabase → _Authentication → Attack Protection → Enable Captcha protection_ → Turnstile → cole a Secret Key.
       (Se ativar no Supabase antes do site ter a chave, ninguém consegue entrar.)

### Relatórios agregados (uma vez)

**SQL Editor:** rode `supabase/migrations/0007_analytics_rollup.sql`. Ele cria os resumos por dia e por hora (preenchidos
automaticamente a cada clique), já resume o histórico existente e agenda a limpeza diária dos cliques individuais com mais
de 90 dias (`pg_cron`). Se aparecer o aviso "pg_cron indisponível", ative em _Database → Extensions → pg_cron_ e rode o
arquivo de novo. A aba Relatórios passa a receber o relatório pronto do banco (~15 KB, em milissegundos), em vez de baixar
todos os cliques; o "Exportar CSV" traz os cliques individuais dos últimos 90 dias. Dias e horários seguem o fuso do hotel
(`hotels.timezone`, padrão `America/Sao_Paulo`).

### Histórico de versões, edição simultânea e limite contra spam (uma vez)

**SQL Editor:** rode `supabase/migrations/0008_versions_and_limits.sql`.

- **Histórico:** cada sessão de edição vira uma versão (até 100 por hotel). No painel, _Histórico de versões_ lista e
  restaura. Restaurar também vira uma versão, então dá para desfazer. Substitui o antigo "Restaurar Padrão", que trocaria o
  conteúdo de um hotel real pelo do hotel de demonstração (no modo local continua existindo como "Restaurar demonstração").
- **Dois admins ao mesmo tempo:** o painel só grava se ninguém salvou no meio. Se alguém salvou, ele junta as duas
  alterações (por campo e por item: um mexendo em Eventos e outro no Mapa não perdem nada). Se os dois mudaram o mesmo
  campo, fica o de quem salvou por último.
- **Spam nos relatórios:** no máximo 3.000 cliques por hora por IP em cada hotel; o excesso é descartado. Do IP só fica um
  hash, por até 1 dia.
- **Versão do banco:** o site confere se o banco tem todas as migrações e mostra "Banco desatualizado" no painel quando falta
  alguma. Ao criar uma migração nova, atualize `app_schema_version()` no SQL e `EXPECTED_SCHEMA` em `src/lib/schema.ts`.

### E-mail próprio com Resend (uma vez)

Sem isso, o "Esqueci minha senha" só entrega para quem é da equipe do projeto Supabase.

1. **Resend:** _Domains_ → `hotelguia.com.br` precisa aparecer como **Verified** (registros DNS na Hostinger). Depois,
   _API Keys_ → _Create API key_ (permissão **Sending access**, domínio `hotelguia.com.br`) → copie (`re_…`).
2. **Supabase → Authentication → Emails → SMTP Settings** → _Enable custom SMTP_:
   - Sender email: `nao-responda@hotelguia.com.br` · Sender name: `Hotel Guia`
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: a API key `re_…`
3. **Authentication → Rate Limits:** suba _emails sent per hour_ (o padrão com SMTP próprio é 30).
4. _(Opcional)_ **Authentication → Emails → Templates:** traduza o assunto e o texto de _Reset Password_ e _Invite user_.
   Mantenha o `{{ .ConfirmationURL }}` no link.

A chave `re_…` fica só no Supabase — nunca no site nem no `.env`.

### Super admin da plataforma (`hotelguia.com.br/painel`)

Cria hotéis, convida os administradores de cada um, troca papéis, remove acessos e redefine a 2FA de quem perdeu o celular.
Mostra os acessos de hóspedes dos últimos 30 dias por hotel. O admin da plataforma também entra no painel de qualquer hotel
(suporte). Tudo é conferido no banco: só funciona com conta da plataforma **e** 2FA verificada.

Instalação (uma vez):

1. **SQL Editor:** rode `supabase/migrations/0006_platform.sql`.
2. **SQL Editor:** abra `supabase/03_add_platform_admin.sql`, troque o e-mail pelo seu (a conta que você já usa) e rode.
3. **Edge Function do convite:** Supabase → _Edge Functions_ → _Deploy a new function_ → _Via Editor_ → nome **`invite-admin`** →
   cole o conteúdo de `supabase/functions/invite-admin/index.ts` → _Deploy_. Depois, em _Details_ da função, **desligue
   "Verify JWT with legacy secret"** (a função confere o login sozinha).
4. **Chave secreta da função:** _Project Settings → API Keys_ → copie a **secret key** (`sb_secret_…`) → _Edge Functions →
   Secrets_ → adicione `PLATFORM_SECRET_KEY` com esse valor. (Ela fica só no servidor do Supabase — nunca no site.)
5. _(Opcional)_ _Authentication → Providers → Email → Email OTP Expiration_: aumente para `86400` (24 h) para os links de
   convite durarem um dia em vez de 1 hora.

Como funciona o convite: o painel gera um **link de acesso** e você envia por WhatsApp. Quem abre o link cadastra o app autenticador (2FA), cria a senha e cai no painel do hotel. Se o link
expirar, gere outro no mesmo lugar. Quem já tem conta (ex.: admin de outro hotel) só é vinculado — entra com a senha de sempre.
Quem esqueceu a senha: botão **Nova senha** ao lado do admin gera um link de uso único (pede a 2FA e depois a senha nova).

Hotel novo começa com um **modelo neutro** (nome do hotel, recepção, café da manhã, Wi-Fi), nunca com o conteúdo do hotel
de demonstração. O painel do hotel mostra **Primeiros passos** com o que falta preencher (WhatsApp, Wi-Fi, cidade, foto de
capa, horários).

### Fluxo de login da equipe

1. E-mail + senha (+ CAPTCHA, se ativo).
2. **2FA obrigatória:** no primeiro acesso, a pessoa escaneia um QR Code no app autenticador (Google/Microsoft Authenticator,
   1Password); depois, digita o código de 6 dígitos a cada login.
3. **Saída automática** após 30 min sem uso (vale para todas as abas do admin).
4. **Esqueci minha senha:** link por e-mail → código 2FA → nova senha. O link deve ser aberto no mesmo navegador em que foi pedido.

**Perdeu o celular?** O proprietário roda o trecho comentado no fim de `0002_require_mfa.sql` (apaga a 2FA daquele usuário);
no próximo login ele cadastra o app de novo.

### Como os dados fluem

| Tabela / recurso       | Hóspede (anônimo)         | Admin logado                                     |
| ---------------------- | ------------------------- | ------------------------------------------------ |
| `hotels.config`        | lê o `config.json` do CDN | edita (salva sozinho em ~1 s) e republica o JSON |
| `analytics_events`     | só insere                 | lê relatórios · owner/admin apagam               |
| `hotel_admins`         | —                         | vê o próprio vínculo                             |
| Storage `hotel-assets` | lê (público)              | envia/apaga arquivos do próprio hotel            |

Papéis: **owner** e **admin** editam tudo; **staff** vê só os Relatórios.

## Segurança

- Login com e-mail e senha + **verificação em 2 etapas obrigatória** (TOTP), CAPTCHA opcional e saída automática por inatividade.
- As permissões são aplicadas **no banco** (RLS) e exigem sessão com 2FA (`aal2`): mesmo com a senha vazada, sem o código
  ninguém edita nem lê relatórios — nem chamando a API direto.
- O portal não tem links para o painel; a equipe acessa por `/<id-do-hotel>#/admin`.
- A _publishable key_ é pública por design. **A _secret key_ (`sb_secret_…`) e a senha do banco nunca entram no código,
  no `.env` ou no git** — tudo com prefixo `VITE_` vai para o navegador.
- Analytics são anônimos (sem nome, telefone ou quarto) e o horário é definido pelo servidor.

## Roadmap

- [x] Configuração no banco + atualização ao vivo
- [x] Login de administradores + RLS + papéis
- [x] Analytics de todos os hóspedes no banco
- [x] Upload de logo no Storage
- [x] Upload das demais fotos (banner, serviços, mapa) com compressão automática
- [x] Edição dos pedidos rápidos (WhatsApp) pelo painel
- [x] 2FA obrigatória, recuperação de senha, CAPTCHA e logout por inatividade
- [x] Gestão de usuários (convites, papéis, redefinir 2FA, link de nova senha) — no `/painel`
- [x] Multi-hotel: um site para todos os hotéis (`hotelguia.com.br/<id>`)
- [x] Editor de Experiências com upload de foto
- [x] Portal dos hóspedes lido do CDN (o banco só é usado quando o admin salva)
- [x] Super admin da plataforma (criar hotéis, convidar admins, redefinir 2FA)
- [x] Relatórios agregados no banco (resumos por dia/hora + limpeza dos cliques com mais de 90 dias)
- [x] Histórico de versões, junção de edições simultâneas, modelo neutro para hotel novo, limite contra spam
- [x] Código do painel separado do portal (hóspedes não baixam o painel)
- [ ] Tirar a biblioteca do Supabase do carregamento do hóspede (portal ~35% menor)
- [ ] Vitrine de hotéis parceiros na página inicial
