import { z } from 'zod';
import { DECIMAL_PATTERN, normalizeDecimal } from './decimal';

const required = (label: string, max: number) => z.string({ error: `Informe ${label}.` })
  .trim().min(1, `Informe ${label}.`).max(max, `Use até ${max} caracteres.`);

const code = (label: string) => required(label, 80)
  .pipe(z.string().regex(/^[^\p{Cc}\s,;]+$/u, 'Use um código sem espaços, vírgulas ou ponto e vírgula.'));

const decimal = (label: string, allowZero = false) => required(label, 40)
  .pipe(z.string().regex(DECIMAL_PATTERN, 'Informe até 12 dígitos inteiros e 18 decimais, com vírgula ou ponto e sem separador de milhar.'))
  .transform(normalizeDecimal)
  .refine((value) => allowZero || value !== '0', 'Informe um valor maior que zero.');

export const machineSchema = z.object({
  code: code('o código da máquina'),
  description: required('a descrição ou modelo', 250),
  rpm: decimal('a rotação padrão (RPM)'),
  factor: decimal('o fator de tempo (min/m)'),
  machineType: z.string().trim().max(150, 'Use até 150 caracteres no tipo de máquina.').optional(),
});

export const mtmSchema = z.object({
  code: code('o código MTM'),
  description: required('a descrição do elemento', 250),
  minutes: decimal('o tempo unitário (min)', true),
});

const version = z.number().int().positive().optional();
export const machineWriteSchema = machineSchema.extend({ expectedVersion: version });
export const mtmWriteSchema = mtmSchema.extend({ expectedVersion: version });

export const captureStepSchema = z.object({
  text: required('o trecho de origem', 1500),
  code: code('o código MTM'),
  count: z.number().int().min(1).max(250),
  audioName: z.string().trim().max(250).optional(),
});

export const operationSchema = z.object({
  productName: required('o nome do produto', 250),
  perimeter: decimal('o perímetro de costura (m)'),
  density: decimal('a densidade de pontos (pontos/cm)'),
  machineCode: code('a máquina'),
  route: z.array(code('o código MTM')).max(250, 'O roteiro deve conter no máximo 250 ocorrências.'),
  notes: z.string().trim().max(4000, 'Use até 4.000 caracteres nas observações.').optional(),
  author: z.string().trim().max(150, 'Use até 150 caracteres no nome do responsável.').optional(),
  poCode: z.string().trim().max(80, 'Use até 80 caracteres no código da ficha.').optional(),
  revision: z.string().trim().max(30, 'Use até 30 caracteres na revisão.').optional(),
  operationName: z.string().trim().max(250, 'Use até 250 caracteres no nome da operação.').optional(),
  size: z.string().trim().max(100, 'Use até 100 caracteres no tamanho.').optional(),
  dimensions: z.string().trim().max(100, 'Use até 100 caracteres nas medidas.').optional(),
  capture: z.object({ steps: z.array(captureStepSchema).min(1).max(50) }).optional(),
});

const column = z.number().int().min(0).max(63).optional();
export const importSchema = z.object({
  id: z.uuid(),
  sheet: required('a aba', 250),
  headerRow: z.number().int().positive().max(5000),
  mapping: z.object({ code: column, description: column, rpm: column, factor: column, minutes: column, machineType: column }),
});
