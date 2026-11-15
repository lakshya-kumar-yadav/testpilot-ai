import { Activity, Bot, ClipboardCheck, FolderKanban, Gauge, ShieldCheck } from "lucide-react";
const features = [
  { icon: ClipboardCheck, title: "Requirement Analyzer", description: "Turn product requirements into clear, reviewable quality insights." },
  { icon: Bot, title: "Test Generator", description: "Generate structured test cases with AI assistance and human review." },
  { icon: Activity, title: "Automation Studio", description: "Prepare maintainable Playwright automation from approved test cases." },
  { icon: ShieldCheck, title: "Safe Execution", description: "Keep test execution separate from the API and protect your environment." }
];
export default function App() {
 return <main className="min-h-screen bg-slate-50 text-slate-900">
  <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 lg:block">
   <div className="flex items-center gap-3 text-lg font-bold"><span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white"><Gauge size={20}/></span>TestPilot AI</div>
   <p className="mt-2 text-xs text-slate-500">QUALITY ENGINEERING PLATFORM</p>
   <nav className="mt-10 space-y-2 text-sm"><div className="flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 font-medium text-blue-700"><Gauge size={17}/>Overview</div><div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-500"><FolderKanban size={17}/>Projects</div><div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-500"><ClipboardCheck size={17}/>Test cases</div><div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-500"><Activity size={17}/>Test executions</div></nav>
   <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold">Local AI runtime</p><p className="mt-1 text-xs text-amber-600">Not connected yet</p></div>
  </aside>
  <section className="lg:pl-64"><header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 lg:px-10"><div><p className="text-sm text-slate-500">Workspace / Overview</p><h1 className="mt-1 text-xl font-semibold">Quality Engineering Overview</h1></div><span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500">Foundation build</span></header>
   <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10"><div className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-600 p-8 text-white shadow-sm"><p className="text-sm font-medium text-blue-100">WELCOME TO TESTPILOT AI</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">Make quality engineering more intelligent.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">A unified workspace for requirement analysis, test design, automation and reliable execution.</p></div>
    <div className="mt-9"><h2 className="text-lg font-semibold">Core capabilities</h2><p className="mt-1 text-sm text-slate-500">The initial product modules we will build incrementally.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{features.map(({icon:Icon,title,description})=><article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon size={20}/></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><span className="mt-4 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">Planned</span></article>)}</div></div>
   </div>
  </section>
 </main>;
}
