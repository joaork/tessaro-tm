export const sectionTitles = {
  inicio: 'Painel de trabalho',
  'nova-operacao': 'Nova operação',
  historico: 'Fichas PO',
  mtm: 'Elementos MTM',
  maquinas: 'Máquinas',
  importar: 'Importar dados',
  oficio: 'OFÍCIO',
  trama: 'TRAMA',
  lastro: 'LASTRO',
  reveza: 'REVEZA',
  roi: 'Estimativa de ROI',
} as const;

export type SectionPath = keyof typeof sectionTitles;
export const sectionPaths = Object.keys(sectionTitles) as SectionPath[];

export function isSectionPath(value: string): value is SectionPath {
  return Object.hasOwn(sectionTitles, value);
}

export function sectionHref(page: string): string {
  const [section, reference, machine] = page.split('/');
  if (!section || section === 'inicio' || !isSectionPath(section)) return '/';
  const parameters = new URLSearchParams();
  if (reference && section === 'importar') parameters.set('tipo', reference);
  else if (reference) parameters.set('po', reference);
  if (machine && section === 'lastro') parameters.set('maquina', decodeMachine(machine));
  return '/' + section + '/' + (parameters.size ? '?' + parameters.toString() : '');
}

function decodeMachine(value: string): string {
  try { return decodeURIComponent(value); }
  catch { return value; }
}
