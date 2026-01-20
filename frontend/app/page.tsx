import JudoManager from "@/components/features/JudoManager";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div>Chargement...</div>}>
        <JudoManager />
      </Suspense>
    </main>
  );
}