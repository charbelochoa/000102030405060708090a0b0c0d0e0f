import { useEffect, useRef, useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Check, ChevronDown, Radio } from 'lucide-react'
import { useWorkspace, formatTokens } from './lib'
import { AerisMark } from './components'
import { money, stopLabels } from '../shared/catalog'
import type { Run } from '../shared/types'

export function DynamicIsland({
  onSelect,
  onNew,
  onActivity
}: {
  onSelect: (run: Run) => void
  onNew: () => void
  onActivity: () => void
}) {
  const { snapshot, connected } = useWorkspace()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()
  const active = snapshot?.runs.filter((run) => ['running', 'queued'].includes(run.status)) || []
  const latest = [...(snapshot?.runs || [])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )[0]
  const run = active[0] || latest
  const event = [...(snapshot?.events || [])].reverse().find((item) => item.runId === run?.id)
  const demo = active.length > 0 && active.every((item) => item.mode === 'demo')
  const status = !connected
    ? 'Conectando con tu espacio'
    : active.length
      ? `${active.length} ${active.length === 1 ? 'misión' : 'misiones'}${demo ? ' demo' : ''} en curso`
      : 'Tu equipo está listo'
  useEffect(() => {
    if (!open) return
    function pointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', pointer)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', pointer)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div className="island-anchor" ref={root}>
      <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
        <motion.div
          layout={!reduce}
          className={`dynamic-island ${open ? 'expanded' : ''}`}
          style={{ borderRadius: open ? 28 : 26 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        >
          <Collapsible.Trigger asChild>
            <motion.button
              layout={!reduce ? 'position' : false}
              ref={trigger}
              className="island-trigger"
              aria-label={`${open ? 'Cerrar' : 'Abrir'} isla de actividad`}
            >
              <span className="island-symbol">
                <AerisMark small />
              </span>
              <span className="island-status" role="status">
                {status}
              </span>
              {active.length ? (
                <span className="island-wave" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <span className="island-idle" aria-hidden="true" />
              )}
              <ChevronDown size={13} className="island-chevron" />
            </motion.button>
          </Collapsible.Trigger>
          <AnimatePresence initial={false}>
            {open && (
              <Collapsible.Content forceMount asChild>
                <motion.div
                  className="island-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="island-detail-label">
                    <button
                      onClick={() => {
                        setOpen(false)
                        onActivity()
                      }}
                      aria-label="Ver historial de actividad"
                    >
                      <Radio size={12} />
                      {active.length ? 'ACTIVIDAD EN CURSO' : 'ÚLTIMA ACTIVIDAD'}
                      <ArrowUpRight size={11} />
                    </button>
                    {run && <span>{run.mode === 'demo' ? 'DEMO' : 'API'}</span>}
                  </div>
                  <h2>{run?.title || 'El siguiente paso empieza contigo.'}</h2>
                  {event && event.type !== 'finished' && <p>{event.text}</p>}
                  {run && (
                    <div className="island-metrics">
                      <span>
                        <strong>
                          {run.iterations.length}
                          <small> / {run.maxIterations}</small>
                        </strong>
                        Iteraciones
                      </span>
                      <span>
                        <strong>{formatTokens(run.usage.input + run.usage.output)}</strong>
                        {run.unknownUsage
                          ? 'Tokens parciales'
                          : run.mode === 'demo'
                            ? 'Tokens de ejemplo'
                            : 'Tokens'}
                      </span>
                      <span>
                        <strong>{money(run.costNano, 4)}</strong>
                        {run.unknownUsage
                          ? 'USD parciales'
                          : run.mode === 'demo'
                            ? 'USD simulados'
                            : 'USD contabilizados'}
                      </span>
                    </div>
                  )}
                  <div className="island-bottom">
                    <span>
                      <Check size={12} />
                      {run?.stopReason
                        ? stopLabels[run.stopReason]
                        : active.length
                          ? 'Trabajo en curso'
                          : 'Todo a tu ritmo'}
                    </span>
                    <button
                      onClick={() => {
                        setOpen(false)
                        run ? onSelect(run) : onNew()
                      }}
                    >
                      {run ? 'Ver misión' : 'Crear misión'}
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </motion.div>
              </Collapsible.Content>
            )}
          </AnimatePresence>
        </motion.div>
      </Collapsible.Root>
    </div>
  )
}
