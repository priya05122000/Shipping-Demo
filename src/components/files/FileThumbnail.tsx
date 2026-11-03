import Image from "next/image";
import { CubeIcon, DocumentIcon, DiagramIcon } from "@/components/ui/icons";
import { fileKindFromExtension } from "@/lib/files";

const SIZES = {
  sm: { box: "size-12", icon: "size-5", sizes: "48px" },
  md: { box: "size-16", icon: "size-6", sizes: "64px" },
  lg: { box: "h-56 w-full sm:h-64", icon: "size-10", sizes: "(min-width: 640px) 640px, 100vw" },
};

const KIND_STYLES = {
  model3d: { bg: "bg-violet-50 text-violet-600 ring-violet-200", Icon: CubeIcon },
  pdf: { bg: "bg-red-50 text-red-600 ring-red-200", Icon: DocumentIcon },
  image: { bg: "bg-slate-50 text-slate-500 ring-slate-200", Icon: DiagramIcon },
};

interface FileThumbnailProps {
  /** File URL or blob URL; used only for images. */
  src: string | null;
  name: string;
  extension: string;
  size?: keyof typeof SIZES;
}

/** Image thumbnail for image files; a format icon + badge for 3D and PDF files. */
export function FileThumbnail({ src, name, extension, size = "sm" }: FileThumbnailProps) {
  const kind = fileKindFromExtension(extension) ?? "image";
  const s = SIZES[size];

  if (kind === "image" && src) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-lg bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-size-[16px_16px] ring-1 ring-slate-200 ${s.box}`}
      >
        <Image src={src} alt={name} fill sizes={s.sizes} unoptimized className="object-contain" />
      </div>
    );
  }

  const { bg, Icon } = KIND_STYLES[kind];
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg ring-1 ring-inset ${bg} ${s.box}`}
      role="img"
      aria-label={`${extension.toUpperCase()} file`}
    >
      <Icon className={s.icon} />
      <span className="text-[10px] leading-none font-semibold tracking-wide uppercase">{extension}</span>
    </div>
  );
}
