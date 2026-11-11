import { describe, expect, it } from 'vitest';
import type { Machine, MtmElement, OperationInput } from '../src/shared/contracts';
import { formatDecimal } from '../src/shared/decimal';
import { calculateOperation } from '../src/server/calculation';

const metadata = { origin: 'manual', version: 1, updatedAt: '2026-01-01T00:00:00Z' } as const;
const machine: Machine = { ...metadata, code: '003', description: 'Máquina de teste', rpm: '5000', factor: '0.125' };
const mtm: MtmElement[] = [
  { ...metadata, code: '1.0', description: 'Primeira etapa de teste', minutes: '0.12' },
  { ...metadata, code: '2.3', description: 'Segunda etapa de teste', minutes: '0.35' },
  { ...metadata, code: '0.1', description: 'Etapa sem tempo', minutes: '0' },
];
const input: OperationInput = { productName: 'Peça de teste', perimeter: '2,4', density: '2,5', machineCode: '003', route: ['1.0', '2.3'] };
const calculate = (overrides: Partial<OperationInput> = {}) => calculateOperation({ ...input, ...overrides }, [machine], mtm);

describe('motor de tempos', () => {
  it('calcula FIXO em min a partir de m × min/m', () => {
    expect(calculate().fixedMinutes).toBe('0.3');
  });

  it('soma vários tempos manuais', () => {
    expect(calculate()).toMatchObject({ mtmMinutes: '0.47', totalMinutes: '0.77' });
  });

  it('contabiliza cada repetição e mantém tempos unitários zero', () => {
    expect(calculate({ route: ['1.0', '0.1', '1.0'] })).toMatchObject({ mtmMinutes: '0.24', totalMinutes: '0.54' });
  });

  it('aceita roteiro vazio para a costura pura', () => {
    expect(calculate({ route: [] })).toMatchObject({ items: [], mtmMinutes: '0', totalMinutes: '0.3' });
  });

  it('aponta código MTM inexistente e a posição', () => {
    expect(() => calculate({ route: ['2.3', 'inexistente'] })).toThrow(expect.objectContaining({
      issues: [expect.objectContaining({ line: 2, field: 'route' })],
    }));
  });

  it('rejeita máquina ausente do cadastro', () => {
    expect(() => calculate({ machineCode: '3' })).toThrow('Selecione uma máquina cadastrada.');
  });

  it.each(['0', '-0,5', '', 'abc', 'NaN', 'Infinity', '1.000,00'])('rejeita perímetro inválido %j', (perimeter) => {
    expect(() => calculate({ perimeter })).toThrow(expect.objectContaining({ issues: [expect.objectContaining({ field: 'perimeter' })] }));
  });

  it.each(['0', '-1', 'texto', ''])('rejeita densidade inválida %j', (density) => {
    expect(() => calculate({ density })).toThrow(expect.objectContaining({ issues: [expect.objectContaining({ field: 'density' })] }));
  });

  it.each(['0', '-0.1', '1.2.3', ''])('rejeita fator inválido %j', (factor) => {
    expect(() => calculateOperation(input, [{ ...machine, factor }], mtm)).toThrow(expect.objectContaining({
      issues: [expect.objectContaining({ field: 'factor' })],
    }));
  });

  it('preserva 36 casas de multiplicação e arredonda half-up só na apresentação', () => {
    const output = calculateOperation({ ...input, route: [], perimeter: '0.123456789012345678' }, [{ ...machine, factor: '0.123456789012345678' }], mtm);
    expect(output.fixedMinutes).toBe('0.015241578753238836527968299765279684');
    expect(formatDecimal(output.fixedMinutes)).toBe('0,0152');
    expect(formatDecimal('0.12345')).toBe('0,1235');
    expect(formatDecimal('0.99995')).toBe('1,0000');
  });

  it('preserva a ordem mesmo com códigos fora da ordem do cadastro', () => {
    const route = ['2.3', '1.0', '2.3'];
    expect(calculate({ route }).items.map(({ position, element }) => [position, element.code])).toEqual([[1, '2.3'], [2, '1.0'], [3, '2.3']]);
  });

  it('mantém RPM e densidade como metadados', () => {
    const output = calculateOperation({ ...input, density: '5' }, [{ ...machine, rpm: '4000' }], mtm);
    expect(output).toMatchObject({ rpmLower: '3600', rpmUpper: '4400', totalMinutes: '0.77' });
  });
});
