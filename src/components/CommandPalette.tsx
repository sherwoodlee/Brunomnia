import { Icon } from './Icon';

type CommandPaletteProps = {
  onClose: () => void;
  onAddRequest: () => void;
  onAddCollection: () => void;
  onEnvironment: () => void;
  onImport: () => void;
  onExport: () => void;
  onDesign: () => void;
  onRunner: () => void;
  onUnitTests: () => void;
  onMocks: () => void;
  onPreferences: () => void;
};

export function CommandPalette({ onClose, onAddRequest, onAddCollection, onEnvironment, onImport, onExport, onDesign, onRunner, onUnitTests, onMocks, onPreferences }: CommandPaletteProps) {
  const actions = [
    { icon: 'plus' as const, label: 'Create request', shortcut: 'N', action: onAddRequest },
    { icon: 'folder' as const, label: 'Create collection', shortcut: '⇧ N', action: onAddCollection },
    { icon: 'braces' as const, label: 'Edit active environment', shortcut: 'E', action: onEnvironment },
    { icon: 'import' as const, label: 'Import artifact', shortcut: 'I', action: onImport },
    { icon: 'download' as const, label: 'Export artifact', shortcut: 'X', action: onExport },
    { icon: 'grid' as const, label: 'Open API design', shortcut: 'D', action: onDesign },
    { icon: 'database' as const, label: 'Open collection runner', shortcut: 'R', action: onRunner },
    { icon: 'check' as const, label: 'Open unit tests', shortcut: 'T', action: onUnitTests },
    { icon: 'spark' as const, label: 'Open local mocks', shortcut: 'M', action: onMocks },
    { icon: 'settings' as const, label: 'Open preferences', shortcut: ',', action: onPreferences },
  ];
  return (
    <div className="modal-backdrop palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-label="Command palette" aria-modal="true" className="command-palette" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <label><Icon name="search" /><input autoFocus placeholder="Search or run a command…" /></label>
        <div>{actions.map((item) => <button key={item.label} onClick={() => { item.action(); onClose(); }} type="button"><Icon name={item.icon} /><span>{item.label}</span><kbd>{item.shortcut}</kbd></button>)}</div>
      </section>
    </div>
  );
}
