import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PreviewClient } from "./preview-client";

// Design preview of every screen with mock data. Development only.
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <PreviewClient />
    </Suspense>
  );
}
