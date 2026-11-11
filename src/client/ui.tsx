import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, FlaskConical, Info, LoaderCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ApiError } from './api';
import { modules } from './modules';
import type { ModuleName } from './modules';

export type Navigate = (page: string) => void;

export function decimal(value: string | number): string {
  return String(value).replace('.', ',');
}

export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function poNumber(value: number): string {
  return 'PO-' + String(value).padStart(4, '0');
}

export function BrandMark() {
  return <img className="brand-emblem" src="/icon.svg" alt="" width={44} height={44} />;
}

export function PageTitle({ title, description, children, module }: {
  title: string;
  description: string;
  children?: ReactNode;
  module?: ModuleName;
}) {
  const Icon = module ? modules[module].icon : undefined;
  return (
    <header className={'page-title' + (module ? ' module-title' : '')} data-module={module}>
      {Icon && <span className="module-icon"><Icon size={26} aria-hidden="true" /></span>}
      <div className="page-title-copy">
        <h1 id="workspace-heading" tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="button-group">{children}</div>}
    </header>
  );
}

export function PanelTitle({ title, description, children }: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="panel-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function StepTitle({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <header className="step-title">
      <span>{step}</span>
      <div><h2>{title}</h2><p>{description}</p></div>
    </header>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : tone === 'warn' ? FlaskConical : Info;
  return (
    <div className={'notice notice-' + tone} role={tone === 'error' ? 'alert' : undefined}>
      <Icon size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function ErrorNotice({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <Notice tone="error">
      <strong>{error.message}</strong>
      {error.issues.length > 0 && (
        <ul className="issues">
          {error.issues.map((issue, index) => (
            <li key={index}>{issue.line ? 'Linha ' + issue.line + ' · ' : ''}{issue.message}</li>
          ))}
        </ul>
      )}
    </Notice>
  );
}

export function Empty({ icon: Icon, title, detail, children, heading: Heading = 'h3' }: {
  icon: LucideIcon;
  title: string;
  detail: string;
  children?: ReactNode;
  heading?: 'h2' | 'h3';
}) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={21} aria-hidden="true" /></span>
      <Heading>{title}</Heading>
      <p>{detail}</p>
      {children && <div className="button-group">{children}</div>}
    </div>
  );
}

export function ScrollTable({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className ? 'table-wrap ' + className : 'table-wrap'} tabIndex={0} role="region" aria-label={label}>{children}</div>;
}

export function Origin({ origin }: { origin: 'demo' | 'manual' | 'imported' }) {
  const labels = { demo: 'Demonstrativo', manual: 'Manual', imported: 'Importado' };
  return <span className={'badge' + (origin === 'demo' ? ' badge-warn' : '')}>{labels[origin]}</span>;
}

export function Spinner() {
  return <LoaderCircle className="spinner" size={17} aria-hidden="true" />;
}
