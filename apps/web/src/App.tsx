import { useEffect, useState, type FormEvent } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Bot, CheckCircle2, ClipboardCheck, FolderKanban, Gauge, LogOut, Plus, ShieldCheck, X } from "lucide-react";
import { apiRequest } from "./api";
import { AuthProvider, useAuth } from "./auth";

type Project = { id: string; name: string; description: string | null; status: "ACTIVE" | "ARCHIVED"; createdAt: string; updatedAt: string };
type ProjectsResponse = { data: { projects: Project[]; pagination: { limit: number; offset: number; count: number } } };
type ProjectResponse = { data: { project: Project } };

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Loading your workspace…</div>;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(displayName, email, password);
      navigate("/", { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
    <section className="hidden flex-col justify-between bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-700 p-12 text-white lg:flex">
      <div className="flex items-center gap-3 text-xl font-bold"><span className="grid size-10 place-items-center rounded-xl bg-white/15"><Gauge size={22}/></span>TestPilot AI</div>
      <div className="max-w-lg"><p className="text-sm font-semibold tracking-widest text-blue-200">QUALITY ENGINEERING, REIMAGINED</p><h1 className="mt-5 text-4xl font-semibold leading-tight">Build confidence into every release.</h1><p className="mt-5 leading-7 text-blue-100">A focused workspace for requirements, test design, automation and execution.</p></div>
      <p className="text-sm text-blue-200">AI-assisted. Engineer-approved.</p>
    </section>
    <section className="flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 lg:hidden"><div className="flex items-center gap-2 font-bold"><Gauge className="text-blue-700"/>TestPilot AI</div></div>
        <p className="text-sm font-semibold text-blue-700">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{mode === "login" ? "Sign in to your workspace" : "Create your account"}</h2>
        <p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Continue where your quality work left off." : "Set up your TestPilot AI workspace."}</p>
        {mode === "register" && <label className="mt-6 block text-sm font-medium text-slate-700">Display name<input required maxLength={120} value={displayName} onChange={e=>setDisplayName(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Your name"/></label>}
        <label className="mt-6 block text-sm font-medium text-slate-700">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="you@example.com"/></label>
        <label className="mt-5 block text-sm font-medium text-slate-700">Password<input required type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : 1} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"}/></label>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={16}/></button>
        <p className="mt-6 text-center text-sm text-slate-500">{mode === "login" ? "New to TestPilot AI?" : "Already have an account?"} <Link className="font-semibold text-blue-700 hover:text-blue-800" to={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Create an account" : "Sign in"}</Link></p>
      </form>
    </section>
  </main>;
}

function ProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (project: Project) => void }) {
  const { accessToken } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await apiRequest<ProjectResponse>("/api/projects", { method: "POST", body: JSON.stringify({ name, description: description || null }) }, accessToken);
      onCreated(result.data.project);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create project"); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Create a project</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
    <label className="mt-6 block text-sm font-medium">Project name<input required maxLength={150} value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="e.g. Customer Portal QA"/></label>
    <label className="mt-4 block text-sm font-medium">Description <span className="font-normal text-slate-400">(optional)</span><textarea maxLength={5000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="What are you testing?"/></label>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create project"}</button></div>
  </form></div>;
}

function Dashboard() {
  const { user, accessToken, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadProjects() {
    setError("");
    try {
      const query = filter === "ALL" ? "" : `?status=${filter}`;
      const result = await apiRequest<ProjectsResponse>(`/api/projects${query}`, {}, accessToken);
      setProjects(result.data.projects);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load projects"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadProjects(); }, [filter, accessToken]);

  async function toggleArchive(project: Project) {
    setNotice(""); setError("");
    try {
      await apiRequest<ProjectResponse>(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ status: project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }) }, accessToken);
      setNotice(project.status === "ACTIVE" ? "Project archived." : "Project restored.");
      await loadProjects();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update project"); }
  }

  const activeCount = projects.filter(p => p.status === "ACTIVE").length;
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 lg:block">
      <div className="flex items-center gap-3 text-lg font-bold"><span className="grid size-9 place-items-center rounded-xl bg-blue-700 text-white"><Gauge size={20}/></span>TestPilot AI</div>
      <p className="mt-2 text-[10px] font-semibold tracking-widest text-slate-400">QUALITY ENGINEERING</p>
      <nav className="mt-10 space-y-2 text-sm"><div className="flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 font-semibold text-blue-700"><Gauge size={17}/>Overview</div><div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-500"><FolderKanban size={17}/>Projects</div><div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400"><ClipboardCheck size={17}/>Test cases <span className="ml-auto text-[10px]">SOON</span></div><div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400"><Activity size={17}/>Executions <span className="ml-auto text-[10px]">SOON</span></div></nav>
      <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={15} className="text-emerald-600"/>Workspace secured</div><p className="mt-1 text-xs text-slate-500">Authenticated session</p></div>
    </aside>
    <section className="lg:pl-64">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 lg:px-10"><div><p className="text-xs text-slate-400">Workspace / Overview</p><h1 className="mt-1 text-lg font-semibold">Overview</h1></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-600 sm:block">{user?.displayName}</span><button onClick={logout} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><LogOut size={15}/>Sign out</button></div></header>
      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="rounded-2xl bg-gradient-to-r from-blue-800 to-indigo-700 p-7 text-white"><p className="text-xs font-semibold tracking-widest text-blue-200">TESTPILOT AI WORKSPACE</p><h2 className="mt-3 text-2xl font-semibold">Good to see you, {user?.displayName.split(" ")[0]}.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Organize your QA projects and build a reliable foundation for AI-assisted quality engineering.</p></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3"><Stat icon={FolderKanban} label="Projects shown" value={String(projects.length)} /><Stat icon={CheckCircle2} label="Active projects" value={String(activeCount)} /><Stat icon={Bot} label="AI modules" value="Coming soon" /></div>
        <div className="mt-9 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Your projects</h2><p className="mt-1 text-sm text-slate-500">Manage the workspaces for your applications and test initiatives.</p></div><button onClick={()=>setShowDialog(true)} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"><Plus size={17}/>New project</button></div>
        <div className="mt-5 flex gap-2">{(["ALL","ACTIVE","ARCHIVED"] as const).map(value=><button key={value} onClick={()=>setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter===value?"bg-blue-100 text-blue-800":"bg-white text-slate-500 ring-1 ring-slate-200"}`}>{value === "ALL" ? "All projects" : value === "ACTIVE" ? "Active" : "Archived"}</button>)}</div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading projects…</p> : projects.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700"><FolderKanban size={22}/></span><h3 className="mt-4 font-semibold">No projects yet</h3><p className="mt-2 text-sm text-slate-500">Create your first project to start organizing requirements and tests.</p><button onClick={()=>setShowDialog(true)} className="mt-5 text-sm font-semibold text-blue-700 hover:text-blue-800">Create your first project <ArrowRight className="ml-1 inline" size={15}/></button></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{projects.map(project=><article key={project.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><FolderKanban size={19}/></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${project.status==="ACTIVE"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{project.status}</span></div><h3 className="mt-4 font-semibold">{project.name}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{project.description || "No description added."}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs text-slate-400">Created {new Date(project.createdAt).toLocaleDateString()}</span><button onClick={()=>void toggleArchive(project)} className="text-xs font-semibold text-blue-700 hover:text-blue-800">{project.status==="ACTIVE"?"Archive":"Restore"}</button></div></article>)}</div>}
      </main>
    </section>
    {showDialog && <ProjectDialog onClose={()=>setShowDialog(false)} onCreated={project=>{setProjects(current=>[project,...current]);setShowDialog(false);setFilter("ALL");setNotice("Project created successfully.");}}/>}
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof FolderKanban; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">{label}</p><Icon size={17} className="text-blue-600"/></div><p className="mt-3 text-xl font-semibold">{value}</p></div>;
}

function ProtectedDashboard() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Dashboard/> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Routes><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/register" element={<AuthPage mode="register"/>}/><Route path="/" element={<ProtectedDashboard/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes/></AuthProvider></BrowserRouter>;
}
