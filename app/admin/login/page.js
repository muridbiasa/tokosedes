"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@tokosedes.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (auth.currentUser) router.replace("/admin/dashboard"); }, [router]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await signInWithEmailAndPassword(auth, email.trim(), password); router.replace("/admin/dashboard"); }
    catch (err) { setError(err.code === "auth/invalid-credential" ? "Email atau password salah." : "Login gagal. Pastikan Email/Password aktif di Firebase."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 text-[var(--ink)]"><form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-sm"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">TokoSedes / Admin</p><h1 className="mt-2 font-display text-2xl font-semibold">Masuk ke control center</h1></div><label className="flex flex-col gap-2 text-sm font-semibold">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-normal" /></label><label className="flex flex-col gap-2 text-sm font-semibold">Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-normal" /></label>{error && <p role="alert" className="text-sm text-[var(--brick)]">{error}</p>}<button disabled={busy} className="rounded-md bg-[var(--marigold)] px-4 py-2 text-sm font-semibold disabled:opacity-60">{busy ? "Memeriksa..." : "Masuk"}</button></form></main>;
}
