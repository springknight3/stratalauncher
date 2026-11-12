import { useEffect, useState } from 'react';

import { Button } from '@/components/motion/button/base';
import Flyout from './Flyout';
import { useLauncherSnapshot } from '../lib/launcher';
import { strataApi } from '../lib/strata';

interface ImportCandidate {
  source: string;
  key: string;
  name: string;
  versionId: string;
  path: string;
}

const SOURCE_LABELS: Record<string, string> = {
  official: 'Official Minecraft Launcher',
  sklauncher: 'SKLauncher',
  prism: 'PrismLauncher',
  curseforge: 'CurseForge app',
  modrinth: 'Modrinth app',
};

const SOURCE_ORDER = ['official', 'sklauncher', 'prism', 'curseforge', 'modrinth'];

interface ImportInstanceDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportInstanceDialog({
  open,
  onClose,
}: ImportInstanceDialogProps) {
  const launcher = useLauncherSnapshot();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [importingKey, setImportingKey] = useState('');

  const scan = () => {
    setScanning(true);
    setScanError('');
    void strataApi
      .request<ImportCandidate[]>('import.scan')
      .then((result) => setCandidates(Array.isArray(result) ? result : []))
      .catch(() => setScanError('Could not scan for instances to import.'))
      .finally(() => setScanning(false));
  };

  useEffect(() => {
    if (open) {
      scan();
    } else {
      setCandidates([]);
      setImportingKey('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const importCandidate = (candidate: ImportCandidate) => {
    setImportingKey(`${candidate.source}:${candidate.key}`);
    void strataApi
      .request('import.instance', {
        source: candidate.source,
        key: candidate.key,
        name: '',
        versionId: candidate.versionId,
      })
      .catch(() => setImportingKey(''));
  };

  const grouped = SOURCE_ORDER.map((source) => ({
    source,
    label: SOURCE_LABELS[source] ?? source,
    items: candidates.filter((candidate) => candidate.source === source),
  })).filter((group) => group.items.length > 0);

  return (
    <Flyout
      open={open}
      onClose={onClose}
      label="Import instance"
      widthClass="max-w-[560px]"
      heightClass="h-[min(560px,calc(100dvh-4rem))]"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Import instance
          </h2>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={scan}
            disabled={scanning || launcher.installing}
          >
            {scanning ? 'Scanning…' : 'Rescan'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {scanError.length > 0 && (
            <p className="text-sm text-destructive">{scanError}</p>
          )}
          {launcher.installing && (
            <p className="text-sm text-muted-foreground">
              Importing {launcher.currentInstallName}… {launcher.currentInstallItem}
            </p>
          )}
          {!scanning && grouped.length === 0 && scanError.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No instances found in supported launchers. Install instances in the
              Official Minecraft Launcher, SKLauncher, PrismLauncher, CurseForge,
              or the Modrinth app, then rescan.
            </p>
          )}
          {grouped.map((group) => (
            <section key={group.source}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                {group.items.map((candidate) => {
                  const key = `${candidate.source}:${candidate.key}`;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {candidate.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {candidate.versionId.length > 0
                            ? `Minecraft ${candidate.versionId}`
                            : 'Unknown version'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={launcher.installing || importingKey.length > 0}
                        onClick={() => importCandidate(candidate)}
                      >
                        {importingKey === key ? 'Importing…' : 'Import'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Flyout>
  );
}
