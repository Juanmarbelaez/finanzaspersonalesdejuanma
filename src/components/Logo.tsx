/** Símbolo de Plata (diseño de Juanma): blanco en tema oscuro, negro en tema claro. */
export function Logo({ size = 24, className = '', onDark = false }: { size?: number; className?: string; onDark?: boolean }) {
  return (
    <span className={`logo-mark ${onDark ? 'on-dark' : ''} ${className}`} style={{ width: size, height: size }} aria-hidden>
      <img className="lm-white" src="./logo/simbolo-blanco.svg" width={size} height={size} alt="" draggable={false} />
      <img className="lm-black" src="./logo/simbolo-negro.svg" width={size} height={size} alt="" draggable={false} />
    </span>
  )
}
