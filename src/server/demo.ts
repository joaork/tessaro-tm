// GitHub https://github.com/joaork

export const demoMachines = [
  { code: 'DEMO-M01', description: 'Modelo fictício A', machineType: 'Reta', rpm: '4500', factor: '0.1' },
  { code: 'DEMO-M02', description: 'Modelo fictício B', machineType: 'Interlock', rpm: '4200', factor: '0.085' },
];

export const demoMtm = [
  { code: 'DEMO-01', description: 'Posicionar a peça (demonstração)', minutes: '0.12' },
  { code: 'DEMO-02', description: 'Ajustar a borda (demonstração)', minutes: '0.08' },
  { code: 'DEMO-03', description: 'Retirar a peça (demonstração)', minutes: '0.09' },
];

export function hasDemoCode(code: string): boolean {
  return code.startsWith('DEMO-');
}
