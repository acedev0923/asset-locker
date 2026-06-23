import {
  createRootRouteWithContext,
  Outlet,
  ScrollRestoration,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import type { ReactNode } from "react";
import "../styles.css";

type RouterContext = {
  queryClient: QueryClient;
};

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Asset Locker</title>
        <HeadContent />
      </head>
      <body className="bg-gray-50 min-h-screen antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </body>
    </html>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <RootDocument>
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 hover:text-indigo-600 transition-colors">
                <span className="text-lg">🎬</span>
                <span>Asset Locker</span>
              </Link>
              <nav className="flex items-center gap-1">
                <Link
                  to="/library"
                  className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  activeProps={{ className: "text-sm text-indigo-600 font-medium px-3 py-1.5 rounded-lg bg-indigo-50" }}
                >
                  Library
                </Link>
              </nav>
            </div>
            <span className="text-xs text-gray-300 font-mono hidden sm:block">Lottie Asset Manager</span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </RootDocument>
    </QueryClientProvider>
  );
}
