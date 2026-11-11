import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calculator, ClipboardList, Factory, GitBranch, LayoutDashboard, PanelLeftOpen, Plus, Upload, X } from 'lucide-react';
import { sectionHref, sectionTitles } from '../shared/routes';
import { isModuleName, modules } from './modules';
import { BrandMark } from './ui';

const groups = [
  { label: 'Operações', pages: [
    { path: 'nova-operacao', label: sectionTitles['nova-operacao'], icon: Plus },
    { path: 'historico', label: sectionTitles.historico, icon: ClipboardList },
  ] },
  { label: 'Módulos', pages: Object.entries(modules).map(([path, { name, icon }]) => ({ path, label: name, icon })) },
  { label: 'Cadastros', pages: [
    { path: 'importar', label: sectionTitles.importar, icon: Upload },
    { path: 'maquinas', label: sectionTitles.maquinas, icon: Factory },
    { path: 'mtm', label: sectionTitles.mtm, icon: GitBranch },
  ] },
  { label: 'Análise', pages: [
    { path: 'roi', label: sectionTitles.roi, icon: Calculator },
  ] },
];

function WorkspaceBrand({ commandBar = false, onClick }: { commandBar?: boolean; onClick?: () => void }) {
  return <Link className={commandBar ? 'brand-link command-brand' : 'brand-link'} href="/"
    aria-label="Tessaro, painel de trabalho" onClick={onClick}>
    <BrandMark />
    <svg className="brand-name" width={123} height={20} viewBox="0 0 123 20" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M0 0H16L14 4H10V20H6V4H2Z" />
      <path transform="translate(19)" d="M0 0H13V4H4V8H11V12H4V16H13V20H0Z" />
      <path transform="translate(35)" d="M2 0H14V4H4V8H12L14 10V18L12 20H0V16H10V12H2L0 10V2Z" />
      <path transform="translate(52)" d="M2 0H14V4H4V8H12L14 10V18L12 20H0V16H10V12H2L0 10V2Z" />
      <path transform="translate(69)" d="M0 20V5L5 0H11L16 5V20H12V14H4V20ZM4 10H12V6L10 4H6L4 6Z" />
      <path transform="translate(88)" d="M0 0H12L15 3V10L12 13H10L16 20H11L5.5 13H4V20H0ZM4 4V9H10L11 8V5L10 4Z" />
      <path transform="translate(107)" d="M3 0H13L16 3V17L13 20H3L0 17V3ZM5 4L4 5V15L5 16H11L12 15V5L11 4Z" />
    </svg>
  </Link>;
}

function WorkspaceLinks({ active, onSelect }: { active: string; onSelect?: () => void }) {
  return <nav className="workspace-links" aria-label="Navegação principal">
    <Link className="workspace-link workspace-home" href="/" aria-current={active === 'inicio' ? 'page' : undefined} onClick={onSelect}>
      <span className="workspace-link-icon"><LayoutDashboard size={17} aria-hidden="true" /></span>
      {sectionTitles.inicio}
    </Link>
    {groups.map(({ label, pages }) => <section className="workspace-nav-group" aria-label={label} key={label}>
      <h2>{label}</h2>
      <ul>
        {pages.map(({ path, label: name, icon: Icon }) => <li key={path}>
          <Link className="workspace-link" href={sectionHref(path)} data-module={isModuleName(path) ? path : undefined}
            aria-current={active === path ? 'page' : undefined} onClick={onSelect}>
            <span className="workspace-link-icon"><Icon size={16} aria-hidden="true" /></span>
            {name}
          </Link>
        </li>)}
      </ul>
    </section>)}
  </nav>;
}

export function WorkspaceNavigation({ active }: { active: string }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    drawer.current?.close();
  }

  useEffect(() => { drawer.current?.close(); }, [active]);

  useEffect(() => {
    const desktop = window.matchMedia('(width > 840px)');
    function closeOnDesktop() {
      if (!desktop.matches || !drawer.current?.open) return;
      drawer.current.close();
      sidebar.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')?.focus();
    }
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return <>
    <header className="command-bar" aria-label="Barra de ferramentas">
      <WorkspaceBrand commandBar />
      <button type="button" className="icon-button nav-toggle" aria-label="Abrir navegação" aria-expanded={menuOpen}
        aria-haspopup="dialog" aria-controls="workspace-drawer" onClick={() => {
          drawer.current?.showModal();
          setMenuOpen(true);
        }}>
        <PanelLeftOpen size={21} aria-hidden="true" />
      </button>
      <div className="command-actions">
        <Link className="button button-accent" href={sectionHref('nova-operacao')} aria-label="Nova operação" aria-current={active === 'nova-operacao' ? 'page' : undefined}>
          <Plus size={17} aria-hidden="true" /> <span>Nova operação</span>
        </Link>
        <Link className="button button-secondary command-import" href={sectionHref('importar')} aria-label="Importar dados"
          aria-current={active === 'importar' ? 'page' : undefined}>
          <Upload size={16} aria-hidden="true" /> <span>Importar dados</span>
        </Link>
      </div>
    </header>

    <aside className="workspace-sidebar" ref={sidebar} aria-label="Barra lateral">
      <div className="workspace-sidebar-head">
        <WorkspaceBrand />
      </div>
      <WorkspaceLinks active={active} />
    </aside>

    <dialog className="workspace-drawer" id="workspace-drawer" aria-label="Navegação do painel" ref={drawer} onClose={() => setMenuOpen(false)}
      onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className="workspace-drawer-content">
        <div className="workspace-sidebar-head">
          <WorkspaceBrand onClick={closeMenu} />
          <button type="button" className="icon-button nav-close" aria-label="Fechar navegação" onClick={closeMenu}><X size={21} aria-hidden="true" /></button>
        </div>
        <WorkspaceLinks active={active} onSelect={closeMenu} />
      </div>
    </dialog>
  </>;
}
