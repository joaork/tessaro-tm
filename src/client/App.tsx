'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { OperationInput, ProcessOperation, Workspace } from '../shared/contracts';
import type { ScenarioHandoff } from '../shared/workflow';
import { sectionHref } from '../shared/routes';
import { ApiError, messageFrom, request } from './api';
import { Dashboard } from './Dashboard';
import { Catalog } from './Catalog';
import { Importer } from './Importer';
import { OperationEditor } from './OperationEditor';
import { History, OperationDetail } from './Po';
import { Roi } from './Roi';
import { Oficio } from './Oficio';
import { Trama } from './Trama';
import { Lastro, scenarioStorageKey } from './Lastro';
import { Reveza } from './Reveza';
import { isModuleName } from './modules';
import { ErrorNotice, Notice, Spinner } from './ui';
import { WorkspaceNavigation } from './WorkspaceNavigation';

export function App() {
  const router = useRouter();
  const pathname = usePathname();
  const parameters = useSearchParams();
  const active = pathname.split('/').filter(Boolean)[0] ?? 'inicio';
  const contextId = parameters.get('po') ?? undefined;
  const contextMachine = parameters.get('maquina') ?? undefined;
  const contextKind = parameters.get('tipo');
  const contextScenario = parameters.get('simulacao') ?? undefined;
  const page = [active, contextId, contextMachine, contextKind, contextScenario].join('/');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [flash, setFlash] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const [draft, setDraft] = useState<OperationInput>();
  const [scenario, setScenario] = useState<ScenarioHandoff & { key: string }>();
  const workspaceRead = useRef(0);
  const previousPage = useRef(page);

  const reload = useCallback(async () => {
    const read = ++workspaceRead.current;
    try {
      const updated = await request<Workspace>('/workspace');
      if (read !== workspaceRead.current) return;
      setWorkspace(updated);
      setError(null);
    } catch (cause) {
      if (read === workspaceRead.current) setError(messageFrom(cause));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    const target = document.getElementById('workspace-heading') ?? document.getElementById('content');
    target?.focus();
  }, [page]);

  useEffect(() => {
    function openLegacyLink() {
      if (window.location.hash.startsWith('#/')) router.replace(sectionHref(window.location.hash.slice(2)));
    }
    openLegacyLink();
    window.addEventListener('hashchange', openLegacyLink);
    return () => window.removeEventListener('hashchange', openLegacyLink);
  }, [router]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(''), 5500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function navigate(next: string) {
    router.push(sectionHref(next));
  }

  function sendScenario(handoff: ScenarioHandoff) {
    const transfer = { ...handoff, key: crypto.randomUUID() };
    setScenario(transfer);
    try { sessionStorage.setItem(scenarioStorageKey, JSON.stringify(transfer)); }
    catch { /* A proposta permanece em memória na aba atual. */ }
    const path = sectionHref('lastro/' + handoff.operationId + '/' + encodeURIComponent(handoff.machineCode));
    router.push(path + '&simulacao=' + transfer.key);
  }

  async function loadDemo() {
    setDemoBusy(true);
    try {
      await request<Workspace>('/demo', 'POST');
      await reload();
      setFlash('Dados demonstrativos disponíveis nos cadastros.');
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setDemoBusy(false);
    }
  }

  function onSaved(record: ProcessOperation, showDetail: boolean, submittedDraft?: OperationInput) {
    setWorkspace((previous) => previous && ({
      ...previous,
      operations: [record, ...previous.operations.filter((operation) => operation.id !== record.id).map((operation) => (
        operation.id === record.previousId ? { ...operation, supersededBy: record.id } : operation
      ))],
    }));
    void reload();
    setFlash('Ficha PO salva no histórico.');
    if (submittedDraft) setDraft((current) => current === submittedDraft ? undefined : current);
    if (showDetail) navigate('historico/' + record.id);
  }

  const selected = active === 'historico' && contextId ? workspace?.operations.find((item) => item.id === contextId) : undefined;

  function renderPage(data: Workspace) {
    if (selected) return <OperationDetail operation={selected} previous={data.operations.find(({ id }) => id === selected.previousId)} navigate={navigate} />;
    if (active === 'historico') return <History operations={data.operations} navigate={navigate} />;
    if (active === 'nova-operacao') return (
      <OperationEditor workspace={data} navigate={navigate} onSaved={onSaved} loadDemo={loadDemo} demoBusy={demoBusy}
        initialInput={draft} onDraftChange={setDraft} reload={reload} />
    );
    if (active === 'maquinas' || active === 'mtm') return (
      <Catalog key={active} kind={active === 'maquinas' ? 'machines' : 'mtm'} workspace={data} navigate={navigate}
        onSaved={async () => { await reload(); setFlash('Cadastro salvo.'); }} reload={reload} />
    );
    if (active === 'importar') return (
      <Importer initialKind={contextKind === 'maquinas' ? 'machines' : 'mtm'}
        onImported={async (count) => { await reload(); setFlash(count + (count === 1 ? ' registro importado.' : ' registros importados.')); }}
        navigate={navigate} />
    );
    if (active === 'roi') return <Roi workspace={data} initialId={contextId} />;
    if (active === 'oficio') return <Oficio workspace={data} onDraft={(input) => { setDraft(input); navigate('nova-operacao'); }} />;
    if (active === 'trama') return <Trama key={page} workspace={data} initialId={contextId} onScenario={sendScenario} />;
    if (active === 'lastro') return <Lastro key={page} workspace={data} initialId={contextId} initialMachine={contextMachine}
      scenarioKey={contextScenario} initialScenario={scenario?.key === contextScenario ? scenario : undefined}
      onSaved={onSaved} reload={reload} navigate={navigate} />;
    if (active === 'reveza') return <Reveza key={page} workspace={data} initialId={contextId} reload={reload} />;
    return <Dashboard workspace={data} navigate={navigate} loadDemo={loadDemo} demoBusy={demoBusy} />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content" onClick={(event) => { event.preventDefault(); document.getElementById('content')?.focus(); }}>
        Ir para o conteúdo
      </a>
      <WorkspaceNavigation active={active} />
      <div className="main-area">
        <main id="content" className="content" tabIndex={-1} data-module={isModuleName(active) ? active : undefined}>
          <ErrorNotice error={error} />
          {error && <button className="button button-secondary retry-button" onClick={() => void reload()}>Tentar novamente</button>}
          {workspace && <div key={page} className="workspace-page">{renderPage(workspace)}</div>}
          {!workspace && !error && <div className="loading" role="status"><Spinner /> Carregando os dados do Tessaro…</div>}
        </main>
      </div>
      {flash && <div className="toast" role="status"><Notice tone="success">{flash}</Notice></div>}
    </div>
  );
}
