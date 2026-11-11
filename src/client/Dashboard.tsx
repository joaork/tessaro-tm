// GitHub https://github.com/joaork

import { ArrowRight, ClipboardCheck, ClipboardList, Factory, FlaskConical, GitBranch } from 'lucide-react';
import Link from 'next/link';
import type { Workspace } from '../shared/contracts';
import { sectionHref } from '../shared/routes';
import { isModuleName, modules } from './modules';
import { OperationsTable } from './Po';
import { Empty, PanelTitle, Spinner } from './ui';
import type { Navigate } from './ui';

const workflow = [
  { path: 'oficio', ...modules.oficio },
  { path: 'nova-operacao', name: 'Ficha PO', icon: ClipboardCheck, task: 'Calcular e emitir', description: 'Tempo fixo e roteiro MTM' },
  { path: 'trama', ...modules.trama },
  { path: 'lastro', ...modules.lastro },
  { path: 'reveza', ...modules.reveza },
];

export function Dashboard({ workspace, navigate, loadDemo, demoBusy }: {
  workspace: Workspace;
  navigate: Navigate;
  loadDemo: () => Promise<void>;
  demoBusy: boolean;
}) {
  const { operations, machines, mtm } = workspace;
  const hasDemo = [...machines, ...mtm].some((record) => record.origin === 'demo');
  const current = operations.filter(({ supersededBy }) => !supersededBy).length;
  const recent = [...operations].sort((first, second) => second.number - first.number).slice(0, 4);
  const bases = [
    { label: 'Elementos MTM', count: mtm.length, path: 'mtm', icon: GitBranch },
    { label: 'Máquinas', count: machines.length, path: 'maquinas', icon: Factory },
  ];
  const metrics = [
    { value: current, label: 'Fichas vigentes', icon: ClipboardList, path: 'historico' },
    ...bases.map(({ count, ...base }) => ({ value: count, ...base })),
  ];

  return (
    <div className="stack dashboard">
      <header className="page-title dashboard-title"><h1 id="workspace-heading" tabIndex={-1}>Painel de trabalho</h1></header>

      <section className="panel workflow-board">
        <PanelTitle title="Fluxo de trabalho" description="Comece com um relato no OFÍCIO ou importe a demanda TXT em Nova operação." />
        <ol className="flow-grid">
          {workflow.map(({ path, name, icon: Icon, task, description }) => (
            <li key={path}>
              <Link href={sectionHref(path)} className="flow-card" data-module={isModuleName(path) ? path : undefined}>
                <span className="flow-icon"><Icon size={21} aria-hidden="true" /></span>
                <span className="flow-copy">
                  <span className="flow-name">{name}</span>
                  <strong>{task}</strong>
                  <small>{description}</small>
                </span>
                <ArrowRight className="flow-arrow" size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="metrics" role="group" aria-label="Indicadores da base">
        {metrics.map(({ value, label, icon: Icon, path }) => (
          <Link className="metric" key={path} href={sectionHref(path)}>
            <span className="metric-icon"><Icon size={18} aria-hidden="true" /></span>
            <span className="metric-copy">
              <span className="metric-label">{label}</span>
              <strong className="metric-value">{value}</strong>
            </span>
            <ArrowRight className="metric-arrow" size={16} aria-hidden="true" />
          </Link>
        ))}
      </div>

      <div className="dashboard-bottom">
        <section className="panel">
          <PanelTitle title="Fichas recentes">
            {recent.length > 0 && <Link className="button button-text" href={sectionHref('historico')}>Ver histórico <ArrowRight size={15} /></Link>}
          </PanelTitle>
          {recent.length
            ? <OperationsTable operations={recent} navigate={navigate} compact />
            : <Empty icon={ClipboardList} title="Nenhuma ficha emitida" detail="As operações salvas aparecem aqui com o tempo calculado.">
                <Link className="button button-secondary" href={sectionHref('nova-operacao')}>Criar ficha PO <ArrowRight size={15} /></Link>
              </Empty>}
        </section>

        <section className="panel readiness">
          <PanelTitle title="Bases de apoio" />
          <div className="readiness-list">
            {bases.map(({ label, count, icon: Icon, path }) => (
              <Link href={sectionHref(path)} key={path}>
                <Icon size={17} aria-hidden="true" /><strong>{label}</strong>
                <span className="base-state" data-ready={count > 0}>{count ? 'Disponível' : 'Pendente'}</span>
              </Link>
            ))}
          </div>
          {hasDemo && <div className="readiness-note"><FlaskConical size={17} aria-hidden="true" /><p>Os registros demonstrativos estão identificados nos cadastros e nas fichas.</p></div>}
          {!hasDemo && <button className="button button-secondary demo-button" onClick={() => void loadDemo()} disabled={demoBusy}>
            {demoBusy ? <Spinner /> : <FlaskConical size={16} aria-hidden="true" />} Carregar dados demonstrativos
          </button>}
        </section>
      </div>
    </div>
  );
}
