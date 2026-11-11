// GitHub https://github.com/joaork

import type { Machine, ProcessOperation } from '../shared/contracts';
import { poNumber } from './ui';

export function ficheLabel(operation: ProcessOperation): string {
  return (operation.input.poCode || poNumber(operation.number)) + ' · ' + operation.input.productName + ' · rev. ' + (operation.input.revision || '00');
}

export function FicheSelect({ operations, value, onChange, label = 'Ficha PO' }: {
  operations: ProcessOperation[]; value: string; onChange: (id: string) => void; label?: string;
}) {
  return <label className="field"><span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione uma ficha</option>
      {operations.map((operation) => <option key={operation.id} value={operation.id}>{ficheLabel(operation)}</option>)}
    </select>
  </label>;
}

export function MachineChoices({ machines, value, onChange, label }: {
  machines: Machine[]; value: string[]; onChange: (codes: string[]) => void; label: string;
}) {
  return <fieldset className="workflow-choices">
    <legend>{label}</legend>
    {machines.map(({ code, description }) => <label key={code} className="workflow-check">
      <input type="checkbox" checked={value.includes(code)} onChange={(event) => {
        onChange(event.target.checked ? [...value, code] : value.filter((item) => item !== code));
      }} />
      <span>{code} · {description}</span>
    </label>)}
  </fieldset>;
}
