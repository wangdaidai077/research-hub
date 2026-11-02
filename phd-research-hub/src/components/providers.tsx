"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ConfirmHost } from "./ui/confirm";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <ConfirmHost />
      <Toaster position="bottom-right" toastOptions={{ className: "!text-[13px] !rounded-lg !border !border-border !bg-card !text-foreground" }} />
    </ThemeProvider>
  );
}
