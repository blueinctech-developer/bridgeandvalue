import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Admin – Bridge and Value", template: "%s – Admin – Bridge and Value" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `document.body.className="admin";` }} />
      {children}
    </>
  );
}
