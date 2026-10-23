"use client";

import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

const ModalCloseContext = createContext<(() => void) | null>(null);
export const useModalClose = () => useContext(ModalCloseContext);

export function Modal({
  trigger,
  title,
  desc,
  children,
  wide,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: (open: () => void) => ReactNode;
  title: string;
  desc?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  wide?: boolean;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = controlledOpen ?? inner;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o));
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {trigger?.(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={close} />
          <div className={cn("relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white text-left shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                {desc && <p className="text-sm text-slate-500">{desc}</p>}
              </div>
              <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-xl hover:bg-slate-100" aria-label="Tutup">
                <X className="size-5" />
              </button>
            </div>
            <ModalCloseContext.Provider value={close}>
              <div className="p-6">{typeof children === "function" ? children(close) : children}</div>
            </ModalCloseContext.Provider>
          </div>
        </div>
      )}
    </>
  );
}

/** Versi aman untuk Server Component: tombol pemicu + isi dialog. */
export function DialogButton({
  label,
  title,
  desc,
  wide,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  label: ReactNode;
  title: string;
  desc?: string;
  wide?: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      title={title}
      desc={desc}
      wide={wide}
      trigger={(open) => (
        <Button type="button" variant={variant} size={size} className={className} onClick={open}>
          {label}
        </Button>
      )}
    >
      {children}
    </Modal>
  );
}
