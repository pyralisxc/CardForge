import { Ellipsis, X } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

import { isActionAvailable, type ActionDescriptor } from '../model';
import type { EnvironmentDetailRecord } from '../presentation';
import { EnvironmentStatus } from './EnvironmentStatus';
import styles from './EnvironmentFoundation.module.css';

interface DetailBodyProps {
  record: EnvironmentDetailRecord;
  actions: readonly ActionDescriptor[];
  showClose: boolean;
  sheetContext?: boolean;
  onClose: () => void;
  onAction: (action: ActionDescriptor) => void;
}

function DetailBody({ record, actions, showClose, sheetContext = false, onClose, onAction }: DetailBodyProps) {
  const visibleActions = actions.filter((action) => action.availability.kind !== 'hidden');
  const primary = visibleActions.find((action) => action.hierarchy === 'primary');
  const supporting = visibleActions.filter((action) => action.hierarchy === 'supporting');
  const overflow = visibleActions.filter((action) => action.hierarchy === 'overflow');
  const run = (action: ActionDescriptor) => { if (isActionAvailable(action)) onAction(action); };
  return (
    <div className={styles.detailInner}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.eyebrow}>{record.eyebrow}</p>
          {sheetContext ? <SheetTitle className={styles.detailTitle}>{record.title}</SheetTitle> : <h2 className={styles.detailTitle}>{record.title}</h2>}
          {sheetContext ? <SheetDescription className={styles.surfaceCopy}>{record.summary}</SheetDescription> : <p className={styles.surfaceCopy}>{record.summary}</p>}
          <EnvironmentStatus label={record.status} tone={record.tone} />
        </div>
        {showClose ? <button type="button" className={styles.iconButton} aria-label={`Close details for ${record.title}`} onClick={onClose}><X size={18} aria-hidden="true" /></button> : null}
      </div>
      <dl className={styles.detailMeta}>
        {record.meta.map(([label, value]) => <div key={label} className={styles.detailMetaRow}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className={styles.detailActions} aria-label={`Actions for ${record.title}`}>
        {primary ? <button type="button" className={styles.primaryButton} disabled={!isActionAvailable(primary)} title={primary.availability.kind === 'disabled' ? primary.availability.reason : undefined} onClick={() => run(primary)}>{primary.label}</button> : null}
        {supporting.map((action) => <button key={action.id} type="button" className={styles.secondaryButton} disabled={!isActionAvailable(action)} title={action.availability.kind === 'disabled' ? action.availability.reason : undefined} onClick={() => run(action)}>{action.label}</button>)}
        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={styles.quietButton}><Ellipsis size={17} aria-hidden="true" />More actions</button></DropdownMenuTrigger>
            <DropdownMenuContent className={styles.overflowMenu} align="start">
              {overflow.map((action) => <DropdownMenuItem key={action.id} disabled={!isActionAvailable(action)} onSelect={() => run(action)}>{action.label}{action.commitment !== 'none' ? ` · ${action.commitment}` : ''}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

export function EnvironmentDesktopInspector(props: Omit<DetailBodyProps, 'showClose' | 'sheetContext'>) {
  return <aside className={styles.detailPane} aria-label={`Details for ${props.record.title}`}><DetailBody {...props} showClose /></aside>;
}

export function EnvironmentMobileSheet({ open, focusReturnId, ...props }: Omit<DetailBodyProps, 'showClose' | 'sheetContext'> & { open: boolean; focusReturnId?: string }) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) props.onClose(); }}>
      <SheetContent
        side="bottom"
        className={styles.mobileSheetPanel}
        overlayClassName={styles.mobileSheetBackdrop}
        onCloseAutoFocus={(event) => {
          if (!focusReturnId) return;
          event.preventDefault();
          document.getElementById(focusReturnId)?.focus();
        }}
      >
        <DetailBody {...props} showClose={false} sheetContext />
      </SheetContent>
    </Sheet>
  );
}
