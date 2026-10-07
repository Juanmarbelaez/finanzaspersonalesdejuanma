import { useEffect, useLayoutEffect, useRef, type TouchEvent } from "react";
import { FileUp, Plus, Settings2, SlidersHorizontal, X } from "lucide-react";
import { TABS, useStore, useUI, type Tab } from "./store";
import { useToast } from "./hooks";
import { haptic } from "./lib/haptic";
import { Dashboard } from "./screens/Dashboard";
import { Transactions } from "./screens/Transactions";
import { Categories } from "./screens/Categories";
import { Recurrings } from "./screens/Recurrings";
import { CashFlow } from "./screens/CashFlow";
import { Accounts } from "./screens/Accounts";
import { Welcome } from "./screens/Welcome";
import { SheetHost } from "./sheets/SheetHost";

const SCREENS: Record<Tab, () => React.JSX.Element> = {
  dashboard: Dashboard,
  transactions: Transactions,
  categories: Categories,
  recurrings: Recurrings,
  cashflow: CashFlow,
  accounts: Accounts,
};

function TabPills() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const ref = useRef<HTMLDivElement>(null);

  // La pestaña activa siempre queda a la vista, centrada
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>("button.active");
    el?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [tab]);

  return (
    <nav className="tabs" ref={ref} aria-label="Secciones">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={tab === t.id ? "active" : ""}
          aria-current={tab === t.id ? "page" : undefined}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function Fab() {
  const tab = useUI((s) => s.tab);
  const openSheet = useUI((s) => s.openSheet);
  const add = () => {
    if (tab === "recurrings") openSheet({ name: "recurringEdit" });
    else if (tab === "accounts") openSheet({ name: "accountEdit" });
    else openSheet({ name: "tx" });
  };
  return (
    <div className="fab">
      {tab === "categories" && (
        <button
          onClick={() => openSheet({ name: "categoriesManage" })}
          aria-label="Editar categorías"
        >
          <SlidersHorizontal size={20} />
        </button>
      )}
      <button className="primary" onClick={add} aria-label="Agregar">
        <Plus size={24} />
      </button>
    </div>
  );
}

function Toast() {
  const message = useToast((s) => s.message);
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
}

/** Deslizar a los lados cambia de pestaña, como en Copilot (sin pelear con los carruseles). */
function useSwipeTabs() {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        ".rings, .upcoming, .acct-scroll, .tabs, .chart, input, select, .suggest",
      )
    ) {
      start.current = null;
      return;
    }
    start.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
    };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || useUI.getState().sheets.length) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50 || Date.now() - s.t > 600)
      return;
    const { tab, setTab } = useUI.getState();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[i + (dx < 0 ? 1 : -1)];
    if (next) {
      haptic();
      setTab(next.id);
    }
  };
  return { onTouchStart, onTouchEnd };
}

export function App() {
  const onboarded = useStore((s) => s.onboarded);
  const theme = useStore((s) => s.settings.theme);
  const demo = useStore((s) => s.demo);
  const tab = useUI((s) => s.tab);
  const openSheet = useUI((s) => s.openSheet);
  const sheetOpen = useUI((s) => s.sheets.length > 0);
  const appRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeTabs();

  // Efecto de hoja de iOS: la pantalla de atrás se encoge desde lo que estás viendo
  useLayoutEffect(() => {
    if (sheetOpen && appRef.current)
      appRef.current.style.transformOrigin = `50% ${window.scrollY + 40}px`;
  }, [sheetOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Los pagos recurrentes que ya vencieron se registran solos al abrir la app
  useEffect(() => {
    const run = () =>
      document.visibilityState === "visible" &&
      useStore.getState().processRecurrings();
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [onboarded]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (!onboarded) return <Welcome />;

  const Screen = SCREENS[tab];

  return (
    <>
      <div className={`app ${sheetOpen ? "pushed" : ""}`} ref={appRef}>
        {demo && (
          <div className="demo-banner">
            Estás en modo demo
            <button
              aria-label="Salir del modo demo"
              onClick={() => {
                if (
                  confirm(
                    "Salir del modo demo borra los datos de ejemplo para que empieces con los tuyos. ¿Seguir?",
                  )
                )
                  useStore.getState().resetAll();
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <header className="app-header">
          <div className="title-row">
            <button
              className="hbtn"
              onClick={() => openSheet({ name: "settings" })}
              aria-label="Ajustes"
            >
              <Settings2 size={21} />
            </button>
            <h1 className="wordmark">
              Plata de Juanma<i>.</i>
            </h1>
            <button
              className="hbtn"
              onClick={() => openSheet({ name: "import" })}
              aria-label="Importar extracto"
            >
              <FileUp size={21} />
            </button>
          </div>
          <TabPills />
        </header>
        <main onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
          <Screen key={tab} />
        </main>
        <Fab />
      </div>
      <SheetHost />
      <Toast />
    </>
  );
}
