import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, ClipboardList, Download, FileCheck2, FileText, Printer, Search,
} from 'lucide-react';
import type { PoPreview, ProcessOperation } from '../shared/contracts';
import { operationFile } from './api';
import { dateLabel, decimal, Empty, Notice, Origin, PageTitle, PanelTitle, poNumber, ScrollTable } from './ui';
import { modules } from './modules';
import { differenceDecimals } from '../shared/decimal';
import { captureMatchesRoute } from '../shared/workflow';
import type { Navigate } from './ui';

export function Calculation({ result, label = 'Memória de cálculo' }: { result: PoPreview; label?: string }) {
  return (
    <section className="calculation" aria-label={label}>
      <div className="formula-line">
        <div><strong>Tempo FIXO</strong><small>Perímetro × fator da máquina</small></div>
        <strong>{decimal(result.fixedMinutes)} <small>min</small></strong>
      </div>
      <div className="formula-expression">
        {decimal(result.input.perimeter)} m × {decimal(result.machine.factor)} min/m = {decimal(result.fixedMinutes)} min
      </div>
      <div className="formula-line">
        <div><strong>Tempos MTM</strong><small>Soma das ocorrências do roteiro</small></div>
        <strong>{decimal(result.mtmMinutes)} <small>min</small></strong>
      </div>
      {result.items.length > 0 && (
        <div className="formula-expression">
          {result.items.map(({ element }) => decimal(element.minutes)).join(' + ')} = {decimal(result.mtmMinutes)} min
        </div>
      )}
      <div className="formula-total">
        <div><strong>Tempo total (TP)</strong><small>FIXO + MTM</small></div>
        <div><strong>{decimal(result.totalMinutes)}</strong> <small>min</small></div>
      </div>
    </section>
  );
}

export function PoSheet({ result, operation }: { result: PoPreview; operation?: ProcessOperation }) {
  const { input, machine, items } = result;
  return (
    <article className="panel po-sheet" aria-label="Ficha de Processo Operacional">
      <div className="sheet-header">
        <div>
          <div className="eyebrow"><span /> ENGENHARIA DE TEMPOS E MÉTODOS</div>
          <h2>Ficha de Processo Operacional</h2>
          <p>Tessaro T&amp;M · Tessaro Soluções</p>
        </div>
        <div className="sheet-code">
          <strong>{input.poCode || (operation ? poNumber(operation.number) : 'Prévia')}</strong>
          <small>{input.revision ? 'Revisão ' + input.revision : operation ? 'Registro emitido' : 'Aguardando emissão'}</small>
        </div>
      </div>

      <div className="sheet-body">
        {result.demonstrative && (
          <Notice tone="warn">Dados demonstrativos. Esta ficha usa ao menos um registro de exemplo.</Notice>
        )}
        <dl className="sheet-fields">
          <div><dt>Produto / Agrupamento</dt><dd>{input.productName}</dd></div>
          <div><dt>Equipamento</dt><dd>{machine.code} · {machine.description}</dd></div>
          {input.operationName && <div><dt>Operação</dt><dd>{input.operationName}</dd></div>}
          {machine.machineType && <div><dt>Tipo de equipamento</dt><dd>{machine.machineType}</dd></div>}
          {input.size && <div><dt>Tamanho</dt><dd>{input.size}</dd></div>}
          {input.dimensions && <div><dt>Medidas</dt><dd>{input.dimensions}</dd></div>}
          <div><dt>Perímetro de costura</dt><dd>{decimal(input.perimeter)} m</dd></div>
          <div><dt>Densidade de pontos</dt><dd>{decimal(input.density)} pontos/cm</dd></div>
          <div><dt>RPM inferior</dt><dd>{decimal(result.rpmLower)} rpm</dd></div>
          <div><dt>RPM padrão</dt><dd>{decimal(machine.rpm)} rpm</dd></div>
          <div><dt>RPM superior</dt><dd>{decimal(result.rpmUpper)} rpm</dd></div>
          <div><dt>Fator de tempo</dt><dd>{decimal(machine.factor)} min/m</dd></div>
          {input.author && <div><dt>Responsável</dt><dd>{input.author}</dd></div>}
          {operation && <div><dt>Emissão</dt><dd>{dateLabel(operation.createdAt)}</dd></div>}
        </dl>

        <ScrollTable className="sheet-table" label="Elementos da ficha">
          <table>
            <caption className="sr-only">Elementos da ficha</caption>
            <thead><tr><th scope="col">Pos.</th><th scope="col">Código</th><th scope="col">Descrição</th><th scope="col" className="numeric">Freq.</th><th scope="col" className="numeric">Tempo (min)</th></tr></thead>
            <tbody>
              <tr><td>—</td><td><span className="code-label">FIXO</span></td><td>Costura de máquina</td><td className="numeric">1</td><td className="numeric">{decimal(result.fixedMinutes)}</td></tr>
              {items.map(({ position, element }) => (
                <tr key={position}>
                  <td>{position}</td><td><span className="code-label">{element.code}</span></td>
                  <td>{element.description}</td><td className="numeric">1</td><td className="numeric">{decimal(element.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>

        <Calculation result={result} label="Cálculo da ficha" />
        {input.notes && <div className="sheet-notes"><h3>Observações</h3><p>{input.notes}</p></div>}

        <div className="sheet-trace">
          <FileCheck2 size={16} />
          <div>
            <strong>Referências do cálculo</strong>
            <p>Fórmula {result.formulaVersion} · Máquina {machine.code} v{machine.version} <Origin origin={machine.origin} /></p>
            {items.length > 0 && <p>MTM {Array.from(new Map(items.map(({ element }) => [element.code, element])).values())
              .map((element) => element.code + ' v' + element.version).join(' · ')}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

export function OperationsTable({ operations, navigate, compact = false }: {
  operations: ProcessOperation[];
  navigate: Navigate;
  compact?: boolean;
}) {
  return (
    <ScrollTable label={compact ? 'Fichas recentes' : 'Fichas emitidas'}>
      <table className={compact ? 'compact-table' : undefined}>
        <caption className="sr-only">Fichas de Processo Operacional</caption>
        <thead><tr><th scope="col">Ficha / Produto</th><th scope="col">Máquina</th><th scope="col" className="numeric">TP (min)</th>{!compact && <th scope="col">Emissão</th>}<th scope="col"><span className="sr-only">Abrir ficha</span></th></tr></thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id}>
              <td><strong>{operation.input.productName}</strong><small className="cell-note">{operation.input.poCode || poNumber(operation.number)} · rev. {operation.input.revision || '00'}{operation.supersededBy && ' · Substituída'}{operation.demonstrative && <> · <span className="demo-text">Demonstrativa</span></>}</small></td>
              <td><span className="code-label">{operation.machine.code}</span></td>
              <td className="numeric strong">{decimal(operation.totalMinutes)}</td>
              {!compact && <td className="nowrap">{dateLabel(operation.createdAt)}</td>}
              <td className="table-action"><button className="icon-button" aria-label={'Abrir ficha ' + (operation.input.poCode || poNumber(operation.number))} onClick={() => navigate('historico/' + operation.id)}><ArrowRight size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}

export function History({ operations, navigate }: { operations: ProcessOperation[]; navigate: Navigate }) {
  const [query, setQuery] = useState('');
  const keyword = query.trim().toLocaleLowerCase('pt-BR');
  const results = [...operations]
    .filter((record) => [record.input.productName, record.input.poCode, record.machine.code, poNumber(record.number)]
      .some((item) => item?.toLocaleLowerCase('pt-BR').includes(keyword)))
    .sort((first, second) => second.number - first.number);

  return (
    <div className="stack">
      <PageTitle title="Fichas PO" description="Consulte as versões emitidas e exporte as fichas." />
      <section className="panel">
        <PanelTitle title="Fichas emitidas" description={operations.length + (operations.length === 1 ? ' ficha salva' : ' fichas salvas')}>
          {operations.length > 0 && <label className="search">
            <Search size={17} /><span className="sr-only">Buscar fichas</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou ficha" />
          </label>}
        </PanelTitle>
        {results.length > 0
          ? <OperationsTable operations={results} navigate={navigate} />
          : <Empty icon={ClipboardList} title={operations.length ? 'Nenhuma ficha encontrada' : 'Nenhuma ficha emitida'}
              detail={operations.length ? 'Tente buscar por outro produto, código ou equipamento.' : 'As fichas ficam disponíveis para consulta após a emissão.'}>
              {operations.length === 0 && <button className="button button-secondary" onClick={() => navigate('nova-operacao')}>Criar primeira PO <ArrowRight size={16} /></button>}
            </Empty>}
      </section>
    </div>
  );
}

export function OperationDetail({ operation, previous, navigate }: { operation: ProcessOperation; previous?: ProcessOperation; navigate: Navigate }) {
  const actions = [
    { module: 'trama', label: 'Simular no TRAMA' },
    { module: 'lastro', label: 'Revisar no LASTRO' },
    { module: 'reveza', label: 'Planejar no REVEZA' },
  ] as const;
  const available = actions.filter(({ module }) => !operation.supersededBy || module === 'trama');

  return (
    <div className="stack operation-detail">
      <div className="print-hide">
        <button className="button button-text back-button" onClick={() => navigate('historico')}><ArrowLeft size={16} /> Voltar ao histórico</button>
        <PageTitle title={operation.input.poCode || poNumber(operation.number)} description={operation.input.productName}>
          <button className="button button-secondary" onClick={() => window.print()}><Printer size={17} /> Imprimir</button>
          <a className="button button-primary" href={operationFile(operation.id)} download><Download size={17} /> Baixar Excel</a>
        </PageTitle>
        <div className="button-group workflow-po-actions">
          {available.map(({ module, label }) => {
            const Icon = modules[module].icon;
            return <button className="button button-secondary module-action" data-module={module} key={module}
              onClick={() => navigate(module + '/' + operation.id)}><Icon size={16} aria-hidden="true" /> {label}</button>;
          })}
          {operation.previousId && <button className="button button-secondary" onClick={() => navigate('historico/' + operation.previousId)}>Abrir revisão anterior</button>}
          {operation.supersededBy && <button className="button button-secondary" onClick={() => navigate('historico/' + operation.supersededBy)}>Abrir revisão seguinte</button>}
          {previous && <button className="button button-secondary" onClick={() => navigate('roi/' + operation.id)}>Projetar impacto na produção</button>}
        </div>
      </div>
      {previous && <section className="panel print-hide">
        <PanelTitle title="Comparação com a revisão anterior" />
        <div className="panel-padding workflow-stats">
          <div><small>TP anterior</small><strong>{decimal(previous.totalMinutes)} min</strong></div>
          <div><small>TP desta revisão</small><strong>{decimal(operation.totalMinutes)} min</strong></div>
          <div><small>Variação por peça</small><strong>{decimal(differenceDecimals(operation.totalMinutes, previous.totalMinutes))} min</strong></div>
        </div>
      </section>}
      <PoSheet result={operation} operation={operation} />
      {operation.input.capture && <section className="panel">
        <PanelTitle title="Origem do roteiro · OFÍCIO" description={captureMatchesRoute(operation.input.capture, operation.input.route)
          ? 'Trechos conferidos ao preparar a operação.' : 'Roteiro de origem preservado. A tabela da ficha mostra a sequência final aprovada.'} />
        <ol className="panel-padding workflow-source">
          {operation.input.capture.steps.map((step, index) => <li key={index}>
            <strong>{step.code} · {step.count} ocorrência(s)</strong>
            <p>{step.text}</p>
            {step.audioName && <small>Arquivo de origem · {step.audioName}</small>}
          </li>)}
        </ol>
      </section>}
      <div className="detail-footnote print-hide"><FileText size={16} /> Os dados desta ficha correspondem às versões usadas na emissão.</div>
    </div>
  );
}
