// GitHub https://github.com/joaork

import { AudioLines, CalendarRange, Layers3, TrendingDown } from 'lucide-react';

export const modules = {
  oficio: { name: 'OFÍCIO', icon: AudioLines, task: 'Capturar método', description: 'Texto ou microfone' },
  trama: { name: 'TRAMA', icon: TrendingDown, task: 'Simular alternativas', description: 'Máquinas e metas de tempo' },
  lastro: { name: 'LASTRO', icon: Layers3, task: 'Revisar fichas', description: 'Versões e emissão em lote' },
  reveza: { name: 'REVEZA', icon: CalendarRange, task: 'Planejar o turno', description: 'Pedidos, máquinas e equipes' },
};

export type ModuleName = keyof typeof modules;

export function isModuleName(value: string): value is ModuleName {
  return Object.hasOwn(modules, value);
}
