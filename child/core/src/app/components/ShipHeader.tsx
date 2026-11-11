import type { HeaderProps } from "../../customize/types";

/** The viewer's own header (the Header slot's default): the logo, the ship's name and a subtitle. */
export function ShipHeader({ ship, subtitle, logo }: HeaderProps) {
  return (
    <header data-ui="header" className="flex flex-none items-center gap-3 border-b border-line bg-panel px-4.5 py-2.5">
      <img src={logo} alt="" className="size-8" />
      <div>
        <p className="text-[15px] font-[650] text-heading">{ship.name}</p>
        <p className="text-[12px] text-muted">{subtitle}</p>
      </div>
    </header>
  );
}
