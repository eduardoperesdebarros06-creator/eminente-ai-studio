import { ArrowRight, ArrowUpRight, Check, FolderOpen } from 'lucide-react';
import { MODULES, getModule, type ModuleId } from '../../app/modules';
import { ROADMAP } from '../../app/roadmap';
import { useLinkProps } from '../../app/router';
import { Badge, ButtonLink, Card, EmptyState, SectionHeader } from '../../components/ui';
import { cx } from '../../lib/cx';
import { OUTPUT_FORMATS } from '../formats';
import { ModuleStatusBadge } from '../shared/ModuleStatusBadge';

const PIPELINE: Array<{ step: string; title: string; detail: string; module: ModuleId }> = [
  { step: '01', title: 'Assunto', detail: 'Tema, objetivo e público', module: 'content' },
  { step: '02', title: 'Conteúdo', detail: 'Roteiro, copy e estrutura', module: 'content' },
  { step: '03', title: 'Peças', detail: 'Posts, carrosséis e motion', module: 'design' },
  { step: '04', title: 'Exportação', detail: 'PNG por página e MP4', module: 'motion' },
];

function ModuleCard({ id }: { id: ModuleId }) {
  const m = getModule(id);
  const link = useLinkProps(m.path);
  const Icon = m.icon;
  return (
    <a {...link} className="module-card">
      <div className="module-card__top">
        <span className="module-card__icon" aria-hidden>
          <Icon size={20} strokeWidth={1.7} />
        </span>
        <ModuleStatusBadge module={m} />
      </div>
      <h3 className="module-card__title">{m.label}</h3>
      <p className="module-card__description">{m.description}</p>
      <span className="module-card__cta">
        Abrir <ArrowUpRight size={14} aria-hidden />
      </span>
    </a>
  );
}

export function DashboardPage() {
  const currentPhase = ROADMAP.find((p) => p.state === 'current');
  const creationModules = MODULES.filter((m) => m.group === 'create');

  return (
    <div className="page dashboard">
      <section className="hero">
        <div className="hero__glow" aria-hidden />
        <div className="hero__content">
          <p className="eyebrow hero__eyebrow">Eminente · AI Studio</p>
          <h1 className="hero__title">
            Do assunto ao arquivo final,
            <br />
            <span className="hero__accent">em um só estúdio.</span>
          </h1>
          <p className="hero__lead">
            Crie conteúdo de marketing, componha posts e carrosséis e transforme tudo em motion
            gráfico com exportação real em PNG e MP4 — rodando localmente, sem serviços pagos.
          </p>
          <div className="hero__actions">
            <ButtonLink to="/content" variant="primary" size="lg" iconRight={ArrowRight}>
              Começar pelo conteúdo
            </ButtonLink>
            <ButtonLink to="/design-system" variant="ghost" size="lg">
              Ver design system
            </ButtonLink>
          </div>
        </div>
        {currentPhase && (
          <aside className="hero__status" aria-label="Estado atual do projeto">
            <p className="eyebrow">Estado do estúdio</p>
            <p className="hero__status-phase">
              Fase {currentPhase.phase}
              <span> / {ROADMAP.length}</span>
            </p>
            <p className="hero__status-title">{currentPhase.title}</p>
            <p className="hero__status-text">{currentPhase.summary}</p>
            <div className="hero__status-bar" aria-hidden>
              {ROADMAP.map((p) => (
                <span key={p.phase} className={cx('hero__status-seg', `hero__status-seg--${p.state}`)} />
              ))}
            </div>
          </aside>
        )}
      </section>

      <section className="section" aria-labelledby="pipeline-title">
        <SectionHeader
          title={<span id="pipeline-title">Fluxo de produção</span>}
          description="Cada etapa corresponde a um módulo do estúdio."
        />
        <ol className="pipeline">
          {PIPELINE.map((s) => (
            <li key={s.step} className="pipeline__step">
              <span className="pipeline__num">{s.step}</span>
              <div>
                <p className="pipeline__title">{s.title}</p>
                <p className="pipeline__detail">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="modules-title">
        <SectionHeader
          title={<span id="modules-title">Estúdios</span>}
          description="Módulos marcados com a fase prevista ainda não estão funcionais."
        />
        <div className="module-grid">
          {creationModules.map((m) => (
            <ModuleCard key={m.id} id={m.id} />
          ))}
        </div>
      </section>

      <div className="dashboard__split">
        <section className="section" aria-labelledby="recent-title">
          <SectionHeader
            title={<span id="recent-title">Projetos recentes</span>}
            actions={
              <ButtonLink to="/library" variant="ghost" size="sm" iconRight={ArrowRight}>
                Biblioteca
              </ButtonLink>
            }
          />
          <Card padding="none">
            <EmptyState
              icon={FolderOpen}
              title="Nenhum projeto ainda"
              description="Projetos salvos aparecerão aqui. A persistência local em SQLite chega na Fase 5; até lá, nada é gravado."
              compact
            />
          </Card>
        </section>

        <section className="section" aria-labelledby="roadmap-title">
          <SectionHeader title={<span id="roadmap-title">Roadmap</span>} />
          <Card padding="sm">
            <ol className="roadmap">
              {ROADMAP.map((p) => (
                <li key={p.phase} className={cx('roadmap__item', `roadmap__item--${p.state}`)}>
                  <span className="roadmap__marker" aria-hidden>
                    {p.state === 'done' ? <Check size={12} strokeWidth={3} /> : p.phase}
                  </span>
                  <div className="roadmap__text">
                    <p className="roadmap__title">
                      {p.title}
                      {p.state === 'current' && (
                        <Badge tone="accent" dot>
                          Em andamento
                        </Badge>
                      )}
                    </p>
                    <p className="roadmap__summary">{p.summary}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      </div>

      <section className="section" aria-labelledby="formats-title">
        <SectionHeader
          title={<span id="formats-title">Formatos de saída</span>}
          description="Especificações-alvo para exportação a partir da Fase 3 (PNG) e Fase 4 (MP4)."
        />
        <div className="format-grid">
          {OUTPUT_FORMATS.map((f) => (
            <Card key={f.id} className="format-card">
              <div className="format-card__frame-wrap" aria-hidden>
                <div
                  className={cx('format-card__frame', f.width > f.height && 'format-card__frame--wide')}
                  style={{ aspectRatio: `${f.width} / ${f.height}` }}
                >
                  <span>{f.ratio}</span>
                </div>
              </div>
              <p className="format-card__label">{f.label}</p>
              <p className="format-card__size mono">
                {f.width} × {f.height}
              </p>
              <p className="format-card__use">{f.use}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
