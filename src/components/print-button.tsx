"use client";

import { Printer } from "lucide-react";
import { Button } from "./ui";

export function PrintButton({ label = "Cetak" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} type="button">
      <Printer className="size-4" /> {label}
    </Button>
  );
}
