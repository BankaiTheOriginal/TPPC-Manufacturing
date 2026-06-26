import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-black/[0.09] bg-white px-2.5 py-1 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/20 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-400/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
