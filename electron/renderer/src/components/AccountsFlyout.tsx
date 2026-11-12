import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import Flyout from './Flyout';
import { useAppReducedMotion } from '../hooks/useAppReducedMotion';
import { useLauncherSnapshot } from '../lib/launcher';
import { strataApi } from '../lib/strata';
import { durations, motionEase } from '../theme/motion';

interface AccountsFlyoutProps {
  open: boolean;
  onClose: () => void;
}

// Parity with the QML accountFlyout: account list with Use/Remove, offline
// name field, Microsoft client ID + device-code sign-in, typed DELETE removal.
export default function AccountsFlyout({ open, onClose }: AccountsFlyoutProps) {
  const launcher = useLauncherSnapshot();
  const reduceMotion = useAppReducedMotion();

  const [offlineName, setOfflineName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientIdTouched, setClientIdTouched] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const effectiveClientId = clientIdTouched ? clientId : launcher.microsoftClientId;

  const saveClientId = () => {
    setClientIdTouched(true);
    void strataApi
      .request('accounts.setMicrosoftClientId', { clientId: effectiveClientId })
      .catch(() => undefined);
  };

  const confirmRemove = () => {
    if (pendingRemoveId === null) {
      return;
    }
    void strataApi
      .request('accounts.remove', { accountId: pendingRemoveId })
      .then(() => {
        setPendingRemoveId(null);
        setDeleteConfirmation('');
      })
      .catch(() => undefined);
  };

  return (
    <Flyout open={open} onClose={onClose} label="Accounts">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <h2 className="font-display text-2xl font-semibold text-foreground">Accounts</h2>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
          {launcher.accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
          )}
          {launcher.accounts.map((account) => (
            <div
              key={account.accountId}
              className="flex h-12 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {account.name} ({account.type})
                {account.active ? ' - Active' : ''}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={account.active}
                onClick={() =>
                  void strataApi
                    .request('accounts.select', { accountId: account.accountId })
                    .catch(() => undefined)
                }
              >
                Use
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPendingRemoveId(account.accountId);
                  setDeleteConfirmation('');
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {pendingRemoveId !== null && (
            <motion.div
              className="flex flex-col gap-2 rounded-xl border border-primary/50 bg-accent/50 p-4"
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: durations.fast, ease: motionEase('standard') }}
            >
              <span className="text-sm text-foreground">
                Type DELETE to remove this account
              </span>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={deleteConfirmation}
                  onChange={setDeleteConfirmation}
                  placeholder="DELETE"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={deleteConfirmation !== 'DELETE'}
                  onClick={confirmRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingRemoveId(null)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={offlineName || launcher.offlineUsername}
            onChange={(value) => {
              setOfflineName(value);
            }}
            placeholder="Offline name (1-16 letters, numbers, underscores)"
            maxLength={16}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void strataApi
                .request('accounts.addOffline', {
                  name: offlineName || launcher.offlineUsername,
                })
                .catch(() => undefined)
            }
          >
            Add offline
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-sm text-foreground">
            Microsoft app client ID
          </span>
          <Input
            className="flex-1"
            value={effectiveClientId}
            onChange={(value) => {
              setClientId(value);
              setClientIdTouched(true);
            }}
            onBlur={saveClientId}
            placeholder="Azure public-client application ID"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Register a public-client app with device-code flow enabled in Microsoft Entra ID.
        </p>

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={launcher.microsoftAuthInProgress}
            onClick={() =>
              void strataApi
                .request('auth.signIn', { clientId: effectiveClientId })
                .catch(() => undefined)
            }
          >
            {launcher.microsoftAuthInProgress
              ? 'Waiting for Microsoft...'
              : 'Sign in with Microsoft'}
          </Button>
          {launcher.microsoftAuthInProgress && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void strataApi.request('auth.cancel', {}).catch(() => undefined)
              }
            >
              Cancel
            </Button>
          )}
        </div>

        {launcher.microsoftUserCode.length > 0 && (
          <p className="text-sm text-blue-500 dark:text-blue-300">
            Visit{' '}
            <button
              type="button"
              className="underline"
              onClick={() =>
                void strataApi
                  .request('shell.openExternal', {
                    url: launcher.microsoftVerificationUrl,
                  })
                  .catch(() => undefined)
              }
            >
              {launcher.microsoftVerificationUrl}
            </button>{' '}
            and enter code: <span className="font-mono">{launcher.microsoftUserCode}</span>
          </p>
        )}
      </div>
    </Flyout>
  );
}
