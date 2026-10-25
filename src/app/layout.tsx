import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ToastProvider";
import { NotificationsProvider } from "@/context/NotificationsContext";

export const metadata: Metadata = {
  title: "دفترچه اشتراکی کلاس پایتون",
  description: "پلتفرم مشارکتی برای کلاس‌های آموزش پایتون",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans antialiased">
        <ToastProvider>
          <AuthProvider>
            <NotificationsProvider>{children}</NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
