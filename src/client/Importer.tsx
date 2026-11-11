// GitHub https://github.com/joaork

import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { catalogFields, optionalCatalogFields, suggestMapping } from '../shared/contracts';
import type {
  CatalogKind, ColumnMapping, ImportInspection, ImportPreview, ImportSelection, MappingField,
} from '../shared/contracts';
import { ApiError, catalogFile, messageFrom, request } from './api';
import { ErrorNotice, Notice, PageTitle, PanelTitle, ScrollTable, Spinner } from './ui';
import type { Navigate } from './ui';

const labels: Record<MappingField, string> = {
  code: 'Código', description: 'Descrição / modelo', rpm: 'RPM padrão', factor: 'Fator (min/m)',
  minutes: 'Tempo unitário (min)', machineType: 'Tipo de equipamento',
};

const steps = ['Selecionar arquivo', 'Mapear colunas', 'Validar e confirmar'];

function recommend(inspection: ImportInspection, sheetName?: string): ImportSelection | null {
  let choice: ImportSelection | null = null;
  let score = -1;
  const required = catalogFields[inspection.kind];
  for (const sheet of inspection.sheets) {
    if (sheetName && sheet.name !== sheetName) continue;
    sheet.rows.forEach((headers, index) => {
      const mapping = suggestMapping(headers, inspection.kind);
      const matched = new Set(required.map((field) => mapping[field]).filter((column) => column !== undefined)).size;
      if (matched > score) {
        score = matched;
        choice = { id: inspection.id, sheet: sheet.name, headerRow: index + 1, mapping };
      }
    });
  }
  return choice;
}

function columnLabel(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : columnLabel(Math.floor(index / 26) - 1) + columnLabel(index % 26);
}

export function Importer({ initialKind, onImported, navigate }: {
  initialKind: CatalogKind;
  onImported: (count: number) => Promise<void>;
  navigate: Navigate;
}) {
  const [kind, setKind] = useState(initialKind);
  const [inspection, setInspection] = useState<ImportInspection | null>(null);
  const [selection, setSelection] = useState<ImportSelection | null>(null);
  const [validation, setValidation] = useState<ImportPreview | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const step = validation || success !== null ? 2 : inspection ? 1 : 0;
  const fields = [...catalogFields[kind], ...optionalCatalogFields[kind]];
  const sheet = inspection?.sheets.find((candidate) => candidate.name === selection?.sheet);
  const header = sheet?.rows[(selection?.headerRow ?? 1) - 1] ?? [];
  const columns = Math.min(64, Math.max(0, ...((sheet?.rows ?? []).map((line) => line.length))));
  const catalogPage = kind === 'machines' ? 'maquinas' : 'mtm';

  async function inspect(file?: File) {
    if (!file || busy) return;
    if (!/\.(csv|xlsx|ods)$/i.test(file.name)) {
      setError(new ApiError('Selecione um arquivo CSV, XLSX ou ODS.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      const result = await request<ImportInspection>('/imports/inspect', 'POST', form);
      const suggested = recommend(result);
      if (!suggested) throw new ApiError('O arquivo não tem linhas para mapear.');
      setInspection(result);
      setSelection(suggested);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    void inspect(file);
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void inspect(event.dataTransfer.files[0]);
  }

  function setSheet(name: string) {
    if (!inspection) return;
    const suggested = recommend(inspection, name);
    setSelection(suggested ?? { id: inspection.id, sheet: name, headerRow: 1, mapping: {} });
    setError(null);
  }

  function setHeaderRow(row: number) {
    if (!selection || !sheet) return;
    setSelection({ ...selection, headerRow: row, mapping: suggestMapping(sheet.rows[row - 1] ?? [], kind) });
    setError(null);
  }

  function mapField(field: MappingField, column: string) {
    if (!selection) return;
    const mapping: ColumnMapping = { ...selection.mapping };
    if (column === '') delete mapping[field];
    else mapping[field] = Number(column);
    setSelection({ ...selection, mapping });
    setError(null);
  }

  async function validate() {
    if (!selection || busy) return;
    const required = catalogFields[kind];
    if (required.some((field) => selection.mapping[field] === undefined)) {
      setError(new ApiError('Mapeie todas as colunas obrigatórias antes de validar.'));
      return;
    }
    const mapped = Object.values(selection.mapping);
    if (new Set(mapped).size !== mapped.length) {
      setError(new ApiError('Use uma coluna diferente para cada campo mapeado.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setValidation(await request<ImportPreview>('/imports/preview', 'POST', selection));
    } catch (cause) {
      const issue = messageFrom(cause);
      if (issue.status === 410) reset();
      setError(issue);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!selection || !validation?.valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await request<{ count: number; batchId: string }>('/imports/confirm', 'POST', selection);
      setSuccess(result.count);
      await onImported(result.count);
    } catch (cause) {
      const issue = messageFrom(cause);
      if (issue.status === 410) reset();
      if (issue.status === 409) setValidation(null);
      setError(issue);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setInspection(null);
    setSelection(null);
    setValidation(null);
    setSuccess(null);
    setError(null);
  }

  return (
    <div className="stack">
      <PageTitle title="Importar dados" description="Envie uma planilha, confira o mapeamento e valide os registros antes de gravar." />

      <ol className="import-steps" aria-label="Etapas de importação">
        {steps.map((label, index) => (
          <li key={label} className={index === step ? 'current-step' : index < step ? 'completed-step' : ''} aria-current={index === step ? 'step' : undefined}>
            <span>{index < step ? <Check size={16} /> : index + 1}</span><strong>{label}</strong>
          </li>
        ))}
      </ol>
      <ErrorNotice error={error} />

      {!inspection && (
        <section className="panel import-panel">
          <PanelTitle title="Selecionar base e arquivo" description="Cada importação alimenta um dos cadastros técnicos." />
          <div className="panel-padding stack">
            <label className="field"><span>Tipo de cadastro</span>
              <select value={kind} disabled={busy} onChange={(event) => { setKind(event.target.value as CatalogKind); setError(null); }}>
                <option value="mtm">Matriz de elementos MTM</option>
                <option value="machines">Cadastro de máquinas</option>
              </select>
            </label>
            <div className={'dropzone' + (dragging ? ' dropzone-active' : '')}
              onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
              onDragLeave={() => setDragging(false)} onDrop={dropFile}>
              <input className="sr-only" type="file" accept=".csv,.xlsx,.ods" ref={fileInput} onChange={selectFile} tabIndex={-1} aria-hidden="true" />
              <span className="empty-icon"><FileSpreadsheet size={24} /></span>
              <strong>Arraste a planilha para cá</strong>
              <p>Formatos CSV, XLSX e ODS</p>
              <button className="button button-primary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
                {busy ? <Spinner /> : <Upload size={17} />} {busy ? 'Lendo arquivo…' : 'Selecionar arquivo'}
              </button>
            </div>
            <div className="import-models">
              <div><strong>Modelos de importação</strong><small>Baixe um modelo vazio ou teste o assistente com dados identificados como exemplo.</small></div>
              <div className="button-group">
                <a className="button button-secondary" href={catalogFile('templates', kind, 'csv')} download><Download size={15} /> Modelo CSV</a>
                <a className="button button-secondary" href={catalogFile('templates', kind, 'xlsx')} download><Download size={15} /> Modelo Excel</a>
                <a className="button button-text" href={catalogFile('fixtures', kind, 'xlsx')} download><Download size={15} /> Exemplo Excel</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {inspection && selection && !validation && (
        <section className="panel import-panel">
          <PanelTitle title="Mapear colunas" description={inspection.filename}>
            <button className="button button-text" type="button" onClick={reset} disabled={busy}><X size={16} /> Trocar arquivo</button>
          </PanelTitle>
          <div className="panel-padding stack">
            <div className="form-grid">
              <label className="field"><span>Aba da planilha</span>
                <select value={selection.sheet} disabled={busy} onChange={(event) => setSheet(event.target.value)}>
                  {inspection.sheets.map((candidate) => <option value={candidate.name} key={candidate.name}>{candidate.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Linha do cabeçalho</span>
                <select value={selection.headerRow} disabled={busy} onChange={(event) => setHeaderRow(Number(event.target.value))}>
                  {(sheet?.rows ?? []).map((row, index) => <option key={index} value={index + 1}>Linha {index + 1}{row.some(Boolean) ? ' · ' + row.filter(Boolean).slice(0, 3).join(' / ').slice(0, 85) : ' · Vazia'}</option>)}
                </select>
              </label>
            </div>
            <Notice>Os campos são sugeridos a partir do cabeçalho. Confira cada associação antes de validar.</Notice>
            <div className="form-grid">
              {fields.map((field) => <label className="field" key={field}>
                <span>{labels[field]} {catalogFields[kind].includes(field) && <span className="required-mark">*</span>}</span>
                <select value={selection.mapping[field] ?? ''} disabled={busy} onChange={(event) => mapField(field, event.target.value)}>
                  <option value="">Selecione uma coluna</option>
                  {Array.from({ length: columns }, (_, index) => <option value={index} key={index}>{columnLabel(index)} · {header[index] || '(Sem título)'}</option>)}
                </select>
              </label>)}
            </div>
            {columns > 0 && <ScrollTable className="import-sample" label="Amostra das linhas da planilha">
              <table>
                <caption>Amostra das linhas abaixo do cabeçalho</caption>
                <thead><tr><th scope="col">Linha</th>{Array.from({ length: columns }, (_, index) => <th scope="col" key={index}>{header[index] || columnLabel(index)}</th>)}</tr></thead>
                <tbody>{(sheet?.rows ?? []).slice(selection.headerRow, selection.headerRow + 5).map((row, rowIndex) => (
                  <tr key={rowIndex}><td>{selection.headerRow + rowIndex + 1}</td>
                    {Array.from({ length: columns }, (_, index) => <td key={index}>{row[index] || '—'}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </ScrollTable>}
            <div className="button-group form-actions">
              <button className="button button-secondary" onClick={reset} disabled={busy}><ArrowLeft size={16} /> Voltar</button>
              <button className="button button-primary" onClick={() => void validate()} disabled={busy}>{busy ? <Spinner /> : <ArrowRight size={16} />} Validar registros</button>
            </div>
          </div>
        </section>
      )}

      {inspection && validation && success === null && (
        <section className="panel import-panel">
          <PanelTitle title="Revisar validação" description={validation.totalRows + (validation.totalRows === 1 ? ' linha avaliada' : ' linhas avaliadas')} />
          <div className="panel-padding stack">
            {validation.valid
              ? <Notice tone="success">A validação foi concluída. Confirme para incluir os registros nos cadastros.</Notice>
              : <ErrorNotice error={new ApiError('Ajuste os dados ou o mapeamento para concluir a importação.', validation.issues)} />}
            {validation.rows.length > 0 && <ScrollTable className="import-sample" label="Amostra dos dados mapeados">
              <table>
                <caption>Amostra dos dados mapeados</caption>
                <thead><tr><th scope="col">Linha</th>{fields.map((field) => <th scope="col" key={field}>{labels[field]}</th>)}</tr></thead>
                <tbody>{validation.rows.map(({ line, values }) => <tr key={line}><td>{line}</td>
                  {fields.map((field) => <td key={field}>{values[field] || '—'}</td>)}
                </tr>)}</tbody>
              </table>
            </ScrollTable>}
            <div className="button-group form-actions">
              <button className="button button-secondary" onClick={() => { setValidation(null); setError(null); }} disabled={busy}><ArrowLeft size={16} /> Ajustar mapeamento</button>
              <button className="button button-primary" onClick={() => void confirm()} disabled={busy || !validation.valid}>
                {busy ? <Spinner /> : <Check size={17} />} Confirmar importação
              </button>
            </div>
          </div>
        </section>
      )}

      {success !== null && <section className="panel import-panel">
        <PanelTitle title="Importação concluída" description={inspection?.filename} />
        <div className="panel-padding stack">
          <Notice tone="success"><strong>{success} {success === 1 ? 'registro incluído.' : 'registros incluídos.'}</strong> A origem do arquivo está registrada no cadastro.</Notice>
          <div className="button-group">
            <button className="button button-primary" onClick={() => navigate(catalogPage)}>Ver cadastro <ArrowRight size={16} /></button>
            <button className="button button-secondary" onClick={reset}>Importar outro arquivo</button>
          </div>
        </div>
      </section>}
    </div>
  );
}
