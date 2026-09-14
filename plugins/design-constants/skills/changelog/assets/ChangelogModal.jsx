/**
 * The "What's New" dialog: the whole changelog array, newest first.
 *
 * The newest entry's chip uses the primary variant and every older one the neutral
 * variant, so "which one is new" is answered without reading. The dialog scrolls — the
 * history is long by design.
 *
 * Swap `Modal` and `Chip` for whatever the target app already has. If it has no dialog
 * component, build one against ../design-foundations/references/modal-accessibility.md —
 * in particular, `aria-labelledby` must point at a GENERATED id, because two dialogs can
 * be on screen at once and a hard-coded id breaks that silently.
 */
import { Modal, Chip } from './ui';
import { CHANGELOG } from '../lib/changelog';

export function ChangelogModal({ onClose }) {
  return (
    <Modal open onClose={onClose} title="What's New" icon="history_edu">
      {CHANGELOG.map((entry, i) => {
        const isLast = i === CHANGELOG.length - 1;
        return (
          <div key={entry.version} style={{ marginBottom: isLast ? 0 : 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Chip variant={i === 0 ? 'primary' : 'neutral'}>v{entry.version}</Chip>
              <span style={{ fontWeight: 600, fontSize: '.88rem' }}>{entry.title}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {entry.items.map((item, j) => (
                <li key={j} className="note">{item}</li>
              ))}
            </ul>
            {!isLast && (
              <hr style={{ border: 'none', borderTop: '1px solid var(--outline-variant)', marginTop: 18 }} />
            )}
          </div>
        );
      })}
    </Modal>
  );
}
