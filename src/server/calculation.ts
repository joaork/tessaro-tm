// GitHub https://github.com/joaork

import type { Machine, MtmElement, PoPreview } from '../shared/contracts';
import { addDecimals, multiplyDecimals } from '../shared/decimal';
import { machineSchema, mtmSchema, operationSchema } from '../shared/schemas';
import { AppError, checked } from './errors';

export const FORMULA_VERSION = 'tm-v1';

export function calculateOperation(
  draft: unknown,
  machines: readonly Machine[],
  catalog: readonly MtmElement[],
): PoPreview {
  const input = checked(operationSchema, draft);
  const machine = machines.find(({ code }) => code === input.machineCode);
  const elements = new Map(catalog.map((element) => [element.code, element]));
  const issues = input.route.flatMap((code, index) => elements.has(code) ? [] : [{
    line: index + 1,
    field: 'route',
    message: `Código MTM “${code}” não encontrado no cadastro.`,
  }]);

  if (!machine) {
    throw new AppError('Selecione uma máquina cadastrada.', 422, [
      { field: 'machineCode', message: `Máquina “${input.machineCode}” não encontrada no cadastro.` },
      ...issues,
    ]);
  }
  if (issues.length) throw new AppError('O roteiro contém códigos MTM desconhecidos.', 422, issues);

  const machineSnapshot = { ...machine, ...checked(machineSchema, machine) };
  const fixedMinutes = multiplyDecimals(input.perimeter, machineSnapshot.factor);
  const items = input.route.map((code, index) => {
    const element = elements.get(code);
    if (!element) throw new Error(`Catálogo inconsistente para ${code}.`);
    return { position: index + 1, element: { ...element, ...checked(mtmSchema, element) } };
  });
  const mtmMinutes = items.reduce((sum, { element }) => addDecimals(sum, element.minutes), '0');

  return {
    input,
    machine: machineSnapshot,
    items,
    fixedMinutes,
    mtmMinutes,
    totalMinutes: addDecimals(fixedMinutes, mtmMinutes),
    rpmLower: multiplyDecimals(machineSnapshot.rpm, '0.9'),
    rpmUpper: multiplyDecimals(machineSnapshot.rpm, '1.1'),
    demonstrative: machine.origin === 'demo' || items.some(({ element }) => element.origin === 'demo'),
    formulaVersion: FORMULA_VERSION,
  };
}
