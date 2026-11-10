import type { HeaderProps } from "../../customization";

/** The viewer's own header (the Header slot's default): the logo, the ship's name and a subtitle. */
export function ShipHeader({ ship, subtitle, logo }: HeaderProps) {
  return (
    <header data-ui="header" className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <img src={logo} alt="" className="size-8" />
      <div>
        <p className="text-sm font-semibold text-slate-900">{ship.name}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </header>
  );
}
