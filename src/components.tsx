import { useId, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { ArrowUpRight, ChevronRight, X } from 'lucide-react'
import { providers, stopLabels } from '../shared/catalog'
import type { ProviderId, Run } from '../shared/types'

export function AerisMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? 'aeris-mark small' : 'aeris-mark'}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path d="M20 5 3 35h9l8-14 8 14h9L20 5Z" fill="currentColor" />
      <path d="m20 27-4.5 8h9L20 27Z" fill="currentColor" opacity=".45" />
    </svg>
  )
}

export function ProviderMark({
  provider,
  compact = false
}: {
  provider: ProviderId
  compact?: boolean
}) {
  const p = providers.find((item) => item.id === provider)!
  return (
    <span
      className={`provider-mark ${compact ? 'compact' : ''}`}
      title={p.name}
      aria-label={p.name}
    >
      <img
        src={
          '/providers/' +
          (provider === 'google' ? 'gemini' : provider === 'local' ? 'qwen' : provider) +
          '.svg'
        }
        alt=""
        width={compact ? 16 : 25}
        height={compact ? 16 : 25}
      />
    </span>
  )
}

export function Status({ run }: { run: Run }) {
  const label = {
    queued: 'En cola',
    running: 'En curso',
    completed: 'Completada',
    stopped: 'Detenida',
    failed: 'Error'
  }[run.status]
  return (
    <span
      className={`status ${run.status}`}
      title={run.stopReason ? stopLabels[run.stopReason] : label}
    >
      <i />
      {label}
    </span>
  )
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <SwitchPrimitive.Root
      className="toggle"
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
    >
      <SwitchPrimitive.Thumb className="toggle-thumb" />
    </SwitchPrimitive.Root>
  )
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  drawer = false,
  command = false
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  title: string
  description?: string
  children: ReactNode
  drawer?: boolean
  command?: boolean
}) {
  const id = useId()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`dialog-overlay ${command ? 'instant' : ''}`} />
        <Dialog.Content
          className={`dialog-content ${drawer ? 'drawer' : ''} ${command ? 'command-dialog instant' : ''}`}
          aria-describedby={description ? id : undefined}
        >
          <div className="dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description id={id}>{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="icon-button" aria-label="Cerrar">
              <X size={17} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SectionTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  )
}

export function Empty({
  title,
  text,
  action
}: {
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <AerisMark small />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ChevronRight size={14} />
    </button>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-link">
      {children}
      <ArrowUpRight size={13} />
    </a>
  )
}
