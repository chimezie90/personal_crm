import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal CRM",
  description: "Your personal relationship management tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-warmGray-100 border-r-2 border-warmGray-900 p-4">
            <h1 className="font-display text-xl font-bold text-warmGray-900 mb-8">
              Personal CRM
            </h1>
            <nav className="space-y-2">
              <a
                href="/"
                className="block px-3 py-2 font-display text-warmGray-900 hover:bg-terracotta hover:text-white transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/contacts"
                className="block px-3 py-2 font-display text-warmGray-900 hover:bg-terracotta hover:text-white transition-colors"
              >
                Contacts
              </a>
              <a
                href="/settings"
                className="block px-3 py-2 font-display text-warmGray-900 hover:bg-terracotta hover:text-white transition-colors"
              >
                Settings
              </a>
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
