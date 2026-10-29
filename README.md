# EMINENTE · AI STUDIO

Estúdio local para criar conteúdo de marketing, posts, carrosséis e motions
gráficos com exportação real em PNG e MP4. Roda inteiramente na sua máquina,
sem hospedagem e sem APIs pagas.

## Estado atual

| Fase | Escopo | Situação |
| --- | --- | --- |
| 1 | Interface navegável, design system e dashboard | **Implementada** |
| 2 | Content Studio (templates + texto de IA externa) | **Implementada** |
| 3 | Posts e carrosséis com exportação PNG | Planejada |
| 4 | Motion: quadros via Playwright + MP4 via FFmpeg | Planejada |
| 5 | SQLite, biblioteca, histórico e recuperação | Planejada |
| 6 | Integração opcional com Ollama | Planejada |

Os módulos das fases 3–6 aparecem na interface com o selo **“Não implementado”**
e a fase prevista. Nenhuma exportação é simulada.

O que já gera arquivos de verdade: o Content Studio baixa o conteúdo em `.md` e
`.json` pelo navegador. Ainda **não** há exportação de imagens (Fase 3) nem de
vídeo (Fase 4), e a biblioteca de projetos (SQLite) chega na Fase 5.

## Content Studio (Fase 2)

1. **Briefing** — assunto (obrigatório), formato (post, carrossel ou motion),
   objetivo, tom de voz, público e observações. O assunto também pode ser
   digitado no campo do dashboard.
2. **Estrutura**, por um destes caminhos:
   - **Template** — monta a estrutura a partir do briefing. Não usa IA: os
     trechos entre `[colchetes]` são marcadores para você substituir, e o
     estúdio avisa enquanto existirem.
   - **IA externa** — o estúdio gera um prompt; você cola em qualquer
     assistente de IA (inclusive versões gratuitas) e cola a resposta de volta.
     A resposta pode vir em JSON (formato pedido no prompt) ou em texto livre
     (“Slide 1”, “Título:”, “Legenda:”…). Nada é enviado pela internet pelo app.
   - **Em branco** — páginas vazias para escrever manualmente.
3. **Edição** — títulos, textos, duração das cenas (motion), ordem das páginas,
   legenda, CTA e hashtags, com contadores e validação em tempo real.
4. **Exportação** — copiar legenda, copiar tudo (Markdown), baixar `.md` e
   `.json`. O `.json` pode ser reaberto depois em **Abrir .json**. A exportação
   fica bloqueada enquanto houver erros (avisos não bloqueiam).

**Limites:** post = 1 página; carrossel = 2 a 10 slides; motion = 1 a 12 cenas,
de 1 a 15 s cada, até 90 s no total; título até 90 caracteres (recomendado 60);
texto até 420; legenda até 2.200; até 30 hashtags.

**Rascunho automático:** o conteúdo em andamento é salvo no navegador
(`localStorage`) a cada alteração e recuperado ao reabrir. Isso protege contra
perda acidental, mas não substitui a biblioteca da Fase 5. Se o navegador
bloquear o armazenamento, o estúdio avisa; nesse caso, baixe o `.json`. Um
rascunho corrompido nunca é carregado: o estúdio recomeça e guarda uma cópia
dos dados originais na chave `eminente:contentDraft.corrupt`.

## Requisitos (Windows)

- **Node.js 22.12 ou superior** (LTS) — <https://nodejs.org>. Durante a
  instalação, mantenha marcada a opção que adiciona o Node ao `PATH`.
- Git (opcional, para clonar o repositório).
- FFmpeg será necessário a partir da Fase 4 (instruções serão adicionadas então).

Confira no PowerShell:

```powershell
node -v
npm -v
```

## Instalação e execução

No PowerShell, dentro da pasta do projeto:

```powershell
npm install
npm run dev
```

Abra <http://127.0.0.1:5173>. O servidor escuta apenas em `127.0.0.1`, ou seja,
não fica acessível a outros computadores da rede.

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia a interface em modo de desenvolvimento |
| `npm run build` | Verifica tipos (TypeScript) e gera a versão de produção em `dist/` |
| `npm run preview` | Serve a versão de produção gerada pelo build |
| `npm test` | Executa os testes (Vitest) |
| `npm run typecheck` | Apenas a verificação de tipos |

### Problemas comuns no Windows

- **`npm` não é reconhecido**: reinicie o terminal após instalar o Node.js ou
  reinstale marcando “Add to PATH”.
- **Execução de scripts desabilitada no PowerShell** (`npm.ps1 cannot be
  loaded`): rode `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` ou use o
  Prompt de Comando (`cmd`).
- **Porta 5173 ocupada**: o Vite usa a próxima porta livre e mostra o endereço
  no terminal.

## Estrutura

```
src/
  app/            Shell da aplicação: registro de módulos, roadmap e roteador (hash)
  components/
    ui/           Design system: Button, Badge, Card, Alert, ProgressBar, campos…
    layout/       AppShell, Sidebar, Topbar, ErrorBoundary
    brand/        Logo e monograma
  domain/content/ Regras de negócio puras e testáveis: tipos, limites, templates,
                  reducer do rascunho, validação, prompt, parser de respostas de IA,
                  exportação e serialização
  features/       Uma pasta por módulo (dashboard, content, design, carousel,
                  motion, library, settings, design-system)
  lib/            Utilitários (classes CSS, preferências locais)
  styles/         tokens.css (fonte única de cores/tipos/espaços), base, componentes,
                  layout e páginas
```

Previsto para as próximas fases: `server/` (Express local: persistência SQLite,
renderização com Playwright e codificação FFmpeg), mantendo segredos e acesso
ao sistema de arquivos fora do frontend.

## Decisões técnicas

- **Sem roteador externo**: roteamento por hash (`#/motion`) com
  `useSyncExternalStore`; funciona em dev, preview e arquivos estáticos.
- **Fonte local**: Inter Variable via `@fontsource-variable/inter`, empacotada no
  build — a interface funciona offline.
- **CSS próprio com tokens**: todas as cores, espaçamentos e tipos vêm de
  `src/styles/tokens.css`.
- **Remotion não é usado**: a licença precisa ser avaliada antes de qualquer uso
  em uma ferramenta automatizada de geração de vídeo. O pipeline previsto é
  Playwright (quadros) + FFmpeg (MP4).
- **Preferências de interface** (ex.: menu recolhido) ficam em `localStorage`;
  dados de projeto irão para SQLite na Fase 5.

## Testes

`npm test` cobre:

- roteador e registro de módulos (nenhum módulo de fase futura é anunciado como
  disponível);
- briefing, hashtags e validação do rascunho (erros x avisos, limites por formato);
- todos os templates respeitando os limites de cada formato;
- reducer do rascunho: páginas, reordenação, troca de formato, importação;
- parser de respostas de IA: JSON (com e sem bloco de código, chaves em PT/EN,
  JSON truncado), texto com marcadores e texto em parágrafos;
- exportação Markdown, nomes de arquivo e recuperação de rascunho (ida e volta e
  rejeição de dados corrompidos).
