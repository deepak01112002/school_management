export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-blue-50 dark:from-primary/10 dark:via-background dark:to-blue-950/20" />

      {/* Decorative blobs */}
      <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white" aria-hidden="true">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" fill="currentColor" opacity="0.9" />
              <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">School ERP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise School Management Platform
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
