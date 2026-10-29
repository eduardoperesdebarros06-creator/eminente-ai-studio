# EMINENTE · AI STUDIO

Estúdio local para criar conteúdo de marketing, posts, carrosséis e motions
gráficos com exportação real em PNG e MP4. Roda inteiramente na sua máquina,
sem hospedagem e sem APIs pagas.

## Estado atual

| Fase | Escopo | Situação |
| --- | --- | --- |
| 1 | Interface navegável, design system e dashboard | **Implementada** |
| 2 | Content Studio (templates + texto de IA externa) | **Implementada** |
| 3 | Posts e carrosséis com exportação PNG | **Implementada** |
| 4 | Motion: quadros via Playwright + MP4 via FFmpeg | Planejada |
| 5 | SQLite, biblioteca, histórico e recuperação | Planejada |
| 6 | Integração opcional com Ollama | Planejada |

Os módulos das fases 4–6 aparecem na interface com o selo **“Não implementado”**
e a fase prevista. Nenhuma exportação é simulada.

O que já gera arquivos de verdade:

- **Content Studio:** conteúdo em `.md` e `.json`.
- **Design Studio e Carousel Studio:** imagens PNG na resolução final, uma por
  página no caso de carrosséis.

Ainda **não** há exportação de vídeo (Fase 4), e a biblioteca de projetos
(SQLite) chega na Fase 5.

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

## Design Studio e Carousel Studio (Fase 3)

Transformam o texto do Content Studio em imagens. O **Design Studio** cuida de
posts (1 página) e o **Carousel Studio**, de carrosséis (2 a 10 slides). Use o
botão **Diagramar** no Content Studio ou o menu lateral.

- **Formatos:** post em 1:1 (1080×1080), 4:5 (1080×1350), 9:16 (1080×1920) ou
  16:9 (1920×1080); carrossel em 1:1 ou 4:5, os formatos aceitos pelo Instagram.
- **Temas da marca:** Carvão (padrão), Laranja e Papel.
- **Layouts por papel:** capa (título grande alinhado à base), conteúdo (número
  da página, título e texto) e chamada final (título e pílula com o CTA).
- **Ajuste automático:** o título diminui até caber. Se mesmo assim não couber,
  ou se o texto de apoio passar do limite de linhas, a página é marcada e a
  exportação fica bloqueada. Nenhum PNG sai com texto cortado.
- **Assinatura** no rodapé (ex.: `@eminente`), numeração “01 / 07” e indicação
  “Arraste →” (as duas últimas podem ser desligadas).
- **O que você vê é o que exporta:** a pré-visualização e o PNG usam o mesmo
  código de desenho, na mesma resolução.

**Exportação** (cada PNG tem o cabeçalho lido de volta e as dimensões conferidas
antes de ser entregue):

| Opção | Resultado |
| --- | --- |
| Salvar todas em pasta… | Grava um arquivo por página na pasta escolhida (Edge e Chrome no Windows) |
| Baixar todas | Um download por página. O navegador pode pedir permissão para baixar vários arquivos: clique em **Permitir** |
| Baixar .zip | Um `.zip` com todas as páginas |
| Só a página N / Baixar PNG | Apenas a página atual (ou o post) |

Os nomes seguem o padrão `eminente-carrossel-<assunto>-01-capa-1080x1350.png`.

**Rascunho automático:** o conteúdo em andamento (texto e aparência) fica em
memória, compartilhado por todos os estúdios, e é copiado para o navegador
(`localStorage`) a cada alteração. Ao reabrir o app, ele é recuperado. Isso protege contra
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
  domain/design/  Formatos, temas, configurações, quebra/ajuste de texto e montagem
                  das cenas (layout puro, sem DOM: reaproveitado pelo motion)
  render/         Desenho das cenas em Canvas, geração/verificação de PNG e gravação
                  (pasta, downloads, .zip)
  features/       Uma pasta por módulo (dashboard, content, visual, design, carousel,
                  motion, library, settings, design-system)
  lib/            Utilitários (classes CSS, armazenamento local, arquivos, leitura
                  de cabeçalho PNG, gerador de ZIP)
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
  rejeição de dados corrompidos);
- store do rascunho: alterações visíveis imediatamente para outro módulo,
  gravação com debounce, falha de gravação e recuperação;
- quebra e ajuste de texto, e cenas em todos os formatos e temas, com todos os
  elementos dentro da área, estouro detectado e reticências dentro da largura;
- leitura de cabeçalho PNG, CRC32 e estrutura do ZIP.

Além dos testes automatizados, cada fase foi verificada num Chromium real
(Playwright). Na Fase 3, os PNGs baixados foram conferidos com `ffprobe`, o
`.zip` foi aberto e testado, e a cor de fundo de cada tema foi lida pixel a
pixel.
