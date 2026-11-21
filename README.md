# Guia do Hóspede — Portal & Concierge Digital (white-label)

Portal mobile para hóspedes de hotel (acessado por QR Code) + painel administrativo para a equipe.

**Stack:** React 18 · TypeScript · Vite · Framer Motion · Lucide. Sem backend por enquanto (estado em `localStorage`) — a integração com Supabase está planejada (veja [Roadmap](#roadmap)).

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

É um site estático: publique a pasta `dist/` em qualquer hospedagem (Vercel, Netlify, Cloudflare Pages, GitHub Pages…).
Build command `npm run build`, output `dist`. As rotas usam hash (`#/mapa`), então não é preciso configurar rewrites.

## Rotas

| Rota                                                                 | Tela                                      |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `#/`                                                                 | Início — Portal do Hóspede                |
| `#/servicos` · `#/servicos?c=gastronomia` · `#/servicos/restaurante` | Horários, Gastronomia & Drinks            |
| `#/programacao`                                                      | Programação do Hotel                      |
| `#/mapa` · `#/mapa/p4`                                               | Mapa Interativo (com foco no pino)        |
| `#/experience/spa` · `concierge` · `transfer`                        | Detalhe de experiência                    |
| `#/admin`                                                            | Painel Administrativo (PIN demo **1234**) |

## Painel administrativo

- **Identidade & Configurações** — nome, textos, contato, Wi-Fi, imagens, paleta de cores e **logo** (substitui o monograma).
- **Painel Inicial** — cria, exclui, reordena, oculta e edita os atalhos de "Sua estadia, em um toque" (também usados no menu lateral).
- **Recados & Avisos** — avisos ao vivo no topo do Início.
- **Programação & Eventos** — agenda semanal; atividades novas nascem como **rascunho** (salvas, mas ocultas) até serem publicadas.
- **Horários & Serviços** e **Editor Visual do Mapa**.
- **Relatórios** — atalhos mais clicados, eventos com mais interesse, o que os hóspedes mais pedem, serviços/pontos mais vistos, uso por horário e por dia; exportação CSV.

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

## Segurança — estado atual

⚠️ **Ainda não está pronto para produção com dados reais:**

- O PIN do painel é verificado no navegador — é só uma demonstração, não é segurança.
- As edições ficam no `localStorage` de quem editou e **não chegam aos celulares dos hóspedes**.

Ambos são resolvidos pela migração para o Supabase abaixo. Nunca coloque a _secret key_ do Supabase em variáveis
`VITE_*` nem no repositório — tudo com prefixo `VITE_` vai para o navegador.

## Roadmap

- [ ] Supabase: configuração do hotel no banco + atualização ao vivo nos celulares
- [ ] Login de administradores (Supabase Auth) no lugar do PIN, com regras RLS (hóspede só lê; admin edita)
- [ ] Analytics agregados de todos os hóspedes no banco
- [ ] Upload de logos/fotos no Supabase Storage
- [ ] Multi-hotel (`hotel_id` + RLS por hotel) e perfis de acesso
