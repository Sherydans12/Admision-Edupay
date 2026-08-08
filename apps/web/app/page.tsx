export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
          Entorno sintético de desarrollo
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
          Fundación técnica de Admisión
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
          Esta pantalla verifica Next.js 16, React 19, TypeScript y Tailwind. No
          contiene flujos funcionales del MVP ni datos reales.
        </p>
        <div className="mt-8 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          E4-A · Scaffolding técnico
        </div>
      </section>
    </main>
  );
}
