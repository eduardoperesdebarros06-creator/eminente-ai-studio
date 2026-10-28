# EMINENTE · AI STUDIO

Estúdio local para criar conteúdo de marketing, posts, carrosséis e motions
gráficos com exportação real em PNG e MP4. Roda inteiramente na sua máquina,
sem hospedagem e sem APIs pagas.

## Estado atual

| Fase | Escopo | Situação |
| --- | --- | --- |
| 1 | Interface navegável, design system e dashboard | **Implementada** |
| 2 | Content Studio (templates + texto de IA externa) | Planejada |
| 3 | Posts e carrosséis com exportação PNG | Planejada |
| 4 | Motion: quadros via Playwright + MP4 via FFmpeg | Planejada |
| 5 | SQLite, biblioteca, histórico e recuperação | Planejada |
| 6 | Integração opcional com Ollama | Planejada |

Os módulos das fases 2–6 aparecem na interface com o selo **“Não implementado”**
e a fase prevista. Nenhuma exportação ou gravação é simulada: hoje o aplicativo
**não gera arquivos nem salva projetos**.

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
  domain/         Regras de negócio puras e testáveis (ex.: validação de briefing)
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

`npm test` cobre o roteador (normalização e resolução de rotas), a integridade
do registro de módulos — incluindo a regra de que nenhum módulo de fase futura
é anunciado como disponível — e a validação de briefing.
