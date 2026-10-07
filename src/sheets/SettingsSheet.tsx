import { useRef } from 'react'
import { Share } from 'lucide-react'
import { useStore, useUI, type Data } from '../store'
import { toast, useLocale } from '../hooks'
import { todayISO } from '../lib/dates'
import { toCSV } from '../lib/csv'
import { isStandalone, readFile, saveFile } from '../lib/download'
import type { Theme } from '../lib/types'
import { Sheet } from '../components/Sheet'
import { ListItem, Segmented } from '../components/ui'
import { ask, tell } from '../components/Dialog'
import { signOut, useAuth } from '../lib/cloud'

const CURRENCIES = [
  { code: 'COP', label: 'Peso colombiano (COP)' },
  { code: 'USD', label: 'Dólar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'MXN', label: 'Peso mexicano (MXN)' },
]

const SYNC_LABEL = {
  idle: 'Al día',
  saving: 'Guardando…',
  saved: 'Guardado',
  offline: 'Sin internet: se guarda al volver',
  error: 'No se pudo guardar, reintentando',
} as const

export function SettingsSheet() {
  const settings = useStore((s) => s.settings)
  const demo = useStore((s) => s.demo)
  const count = useStore((s) => s.transactions.length)
  const { setSettings, restore, resetAll, start } = useStore.getState()
  const { openSheet, closeAll, setTab } = useUI.getState()
  const locale = useLocale()
  const fileRef = useRef<HTMLInputElement>(null)
  const auth = useAuth()
  const cloud = auth.status === 'signedIn'

  const daysSinceBackup = settings.lastBackup ? Math.floor((Date.now() - settings.lastBackup) / 86_400_000) : null

  const exportBackup = async () => {
    const s = useStore.getState()
    const data: Data & { app: string; exportedAt: string } = {
      app: 'plata',
      exportedAt: new Date().toISOString(),
      onboarded: true,
      demo: s.demo,
      settings: s.settings,
      accounts: s.accounts,
      categories: s.categories,
      transactions: s.transactions,
      recurrings: s.recurrings,
      merchantRules: s.merchantRules,
    }
    const ok = await saveFile(`plata-respaldo-${todayISO()}.json`, 'application/json', JSON.stringify(data))
    if (ok) {
      setSettings({ lastBackup: Date.now() })
      toast('Respaldo listo')
    }
  }

  const exportCSV = async () => {
    const s = useStore.getState()
    const cats = new Map(s.categories.map((c) => [c.id, c.name]))
    const accs = new Map(s.accounts.map((a) => [a.id, a.name]))
    const type = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' }
    const rows = [
      ['Fecha', 'Descripción', 'Categoría', 'Cuenta', 'Tipo', 'Monto', 'Nota'],
      ...[...s.transactions]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((t) => [
          t.date,
          t.name,
          cats.get(t.categoryId ?? '') ?? '',
          t.type === 'transfer' ? `${accs.get(t.accountId)} → ${accs.get(t.toAccountId ?? '')}` : (accs.get(t.accountId) ?? ''),
          type[t.type],
          t.type === 'expense' ? -t.amount : t.amount,
          t.note ?? '',
        ]),
    ]
    await saveFile(`plata-movimientos-${todayISO()}.csv`, 'text/csv', toCSV(rows))
  }

  const onRestore = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = JSON.parse(await readFile(file)) as Partial<Data>
      if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.categories)) {
        tell({
          title: 'No es un respaldo de Plata',
          message: 'Elige el .json que exportaste desde Ajustes → Exportar respaldo.',
        })
        return
      }
      const ok = await ask({
        title: 'Restaurar respaldo',
        message: `Lo que tienes ahora se reemplaza por el respaldo (${data.transactions.length} movimientos).`,
        confirm: 'Reemplazar con el respaldo',
        destructive: true,
      })
      if (!ok) return
      restore(data as Data)
      toast('Respaldo restaurado')
      closeAll()
    } catch {
      tell({ title: 'No pude leer el archivo', message: 'Verifica que sea el .json del respaldo, sin editar.' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Sheet title="Ajustes" full>
      <div className="list-group">
        {cloud ? (
          <>
            <div className="kv">
              <span className="k">Cuenta</span>
              <span className="v">{auth.email}</span>
            </div>
            <div className="kv">
              <span className="k">En la nube</span>
              <span className={`v sync ${auth.sync}`}>{SYNC_LABEL[auth.sync]}</span>
            </div>
          </>
        ) : (
          !demo && (
            <ListItem label="Crear cuenta o entrar" value="Guarda tus datos en la nube" onClick={() => openSheet({ name: 'auth' })} />
          )
        )}
      </div>

      <div className="list-group" style={{ marginTop: 12 }}>
        <div className="kv">
          <label className="k" htmlFor="set-name">
            Tu nombre
          </label>
          <input id="set-name" value={settings.name} onChange={(e) => setSettings({ name: e.target.value })} placeholder="Juanma" />
        </div>
        <div className="kv">
          <label className="k" htmlFor="set-cur">
            Moneda
          </label>
          <select id="set-cur" value={settings.currency} onChange={(e) => setSettings({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="eyebrow gray group-title">Apariencia</div>
      <Segmented<Theme>
        value={settings.theme}
        onChange={(theme) => setSettings({ theme })}
        options={[
          { value: 'dark', label: 'Negro' },
          { value: 'light', label: 'Blanco' },
          { value: 'system', label: 'Automático' },
        ]}
      />

      {!isStandalone() && (
        <>
          <div className="eyebrow gray group-title">Instálala en tu iPhone</div>
          <div className="note good">
            <Share size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              En Safari toca <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>. Abre a pantalla completa, sin barra de Safari, y
              funciona sin internet.
            </span>
          </div>
        </>
      )}

      <div className="eyebrow gray group-title">Tus datos</div>
      <div className="list-group">
        <ListItem
          label="Cuentas"
          onClick={() => {
            setTab('accounts')
            closeAll()
          }}
        />
        <ListItem label="Categorías" onClick={() => openSheet({ name: 'categoriesManage' })} />
        <ListItem
          label="Recurrentes"
          onClick={() => {
            setTab('recurrings')
            closeAll()
          }}
        />
        <ListItem label="Importar extracto (CSV)" onClick={() => openSheet({ name: 'import' })} />
      </div>

      <div className="eyebrow gray group-title">Respaldo</div>
      <div className={`note ${daysSinceBackup === null || daysSinceBackup > 30 ? 'warn' : ''}`} style={{ marginBottom: 10 }}>
        <span>
          {cloud ? (
            <>Tus datos se guardan solos en tu cuenta. El respaldo es una copia extra en un archivo. </>
          ) : (
            <>
              Tus datos viven <b>solo en este dispositivo</b>. Si borras Safari o cambias de celular, se pierden sin respaldo.{' '}
            </>
          )}
          {daysSinceBackup === null
            ? 'Todavía no has hecho ninguno.'
            : daysSinceBackup === 0
              ? 'Último respaldo: hoy.'
              : `Último respaldo: hace ${daysSinceBackup} días.`}
        </span>
      </div>
      <div className="list-group">
        <ListItem label="Exportar respaldo" value={`${count} mov.`} onClick={exportBackup} />
        <ListItem label="Restaurar respaldo" onClick={() => fileRef.current?.click()} />
        <ListItem label="Exportar movimientos (CSV)" onClick={exportCSV} />
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onRestore(e.target.files?.[0])} />

      <div className="eyebrow gray group-title">Otros</div>
      <div className="list-group">
        {cloud && (
          <ListItem
            label="Cerrar sesión"
            onClick={async () => {
              const ok = await ask({
                title: 'Cerrar sesión',
                message: 'Tus datos quedan guardados en la nube y este iPhone queda limpio.',
                confirm: 'Cerrar sesión',
              })
              if (!ok) return
              closeAll()
              await signOut()
            }}
          />
        )}
        {!demo && (
          <ListItem
            label="Probar con datos de ejemplo"
            onClick={async () => {
              if (
                count &&
                !(await ask({
                  title: 'Probar con datos de ejemplo',
                  message: 'Tus datos se reemplazan por los de ejemplo. Si los quieres conservar, exporta un respaldo antes.',
                  confirm: 'Reemplazar por datos de ejemplo',
                  destructive: true,
                }))
              )
                return
              start('demo')
              closeAll()
            }}
          />
        )}
        <ListItem
          danger
          label="Borrar todo"
          onClick={async () => {
            const ok = await ask({
              title: 'Borrar todo',
              message: 'Se borran tus movimientos, cuentas y categorías de este iPhone. No se puede deshacer.',
              confirm: 'Borrar todo',
              destructive: true,
            })
            if (!ok) return
            resetAll()
            closeAll()
          }}
        />
      </div>

      <p className="caption" style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        Plata de Juanma · v{__APP_VERSION__} · {new Date().toLocaleDateString(locale, { year: 'numeric' })}
      </p>
    </Sheet>
  )
}
