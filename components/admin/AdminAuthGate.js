"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, firebaseConfigReady } from "@/lib/firebase";
import Link from "next/link";

export default function AdminAuthGate({ children }) {
  const [user, setUser] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(undefined);

  useEffect(() => {
    if (!firebaseConfigReady || !auth) {
      setUser(null);
      setIsAdmin(false);
      return undefined;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) return setIsAdmin(false);
      try { setIsAdmin(Boolean((await nextUser.getIdTokenResult()).claims.admin)); }
      catch { setIsAdmin(false); }
    });
  }, []);

  if (user === undefined || isAdmin === undefined) return <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] text-[var(--ink)]">Memuat sesi...</main>;
  if (!user) return <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 text-[var(--ink)]"><section className="w-full max-w-sm rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6 text-center shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">TokoSedes / Admin</p><h1 className="mt-2 font-display text-2xl font-semibold">Login diperlukan</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Masuk dengan akun admin Firebase untuk mengelola toko.</p><Link href="/admin/login" className="mt-5 inline-flex rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--paper)]">Masuk sebagai admin</Link></section></main>;
  if (!isAdmin) return <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 text-[var(--ink)]"><section className="w-full max-w-sm rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6 text-center shadow-sm"><h1 className="font-display text-xl font-semibold">Akun belum diberi akses admin</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Tambahkan custom claim <code>admin: true</code>, lalu keluar dan masuk kembali.</p><button type="button" onClick={() => signOut(auth)} className="mt-5 rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold">Keluar</button></section></main>;

  return <div className="relative"><div className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-xs shadow-sm"><span className="max-w-36 truncate">{user.email}</span><button type="button" onClick={() => signOut(auth)} className="font-semibold text-[var(--brick)]">Keluar</button></div>{children}</div>;
}
