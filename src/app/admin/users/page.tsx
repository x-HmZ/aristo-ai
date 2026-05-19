"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams }        from "next/navigation";
import { Search, RefreshCw, Eye, Check, X }  from "lucide-react";
import { PageHeader }        from "@/components/admin/PageHeader";
import { BrandCard }         from "@/components/admin/ui/BrandCard";
import { BrandButton }       from "@/components/admin/ui/BrandButton";
import { BrandBadge, EXPERTISE_COLOR, STATUS_COLOR } from "@/components/admin/ui/BrandBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserDetailDrawer } from "./_components/UserDetailDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id:                  string;
  email:               string | null;
  full_name:           string | null;
  goal:                string | null;
  daily_time_minutes:  number | null;
  is_admin:            boolean;
  approval_status:     "pending" | "approved" | "rejected";
  approved_at:         string | null;
  created_at:          string;
  expertise_level:     string | null;
  pace:                string | null;
  engagement_pattern:  string | null;
  last_quiz_at?:       string | null;
  quiz_attempt_count?: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  // useSearchParams() must be used inside a Suspense boundary in Next 15.
  return (
    <Suspense fallback={<div className="text-xs text-aristo-brown/50">Loading…</div>}>
      <UsersPageInner />
    </Suspense>
  );
}

function UsersPageInner() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const selectedId    = searchParams?.get("userId") ?? null;

  const [search, setSearch]         = useState("");
  const [expertise, setExpertise]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [users, setUsers]           = useState<UserRow[] | null>(null);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [busyId, setBusyId]         = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search)                 qs.set("search", search);
    if (expertise !== "all")    qs.set("expertise", expertise);
    if (statusFilter !== "all") qs.set("status", statusFilter);
    qs.set("limit", "200");
    const res = await fetch(`/api/admin/users?${qs.toString()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [search, expertise, statusFilter]);

  const setApprovalStatus = useCallback(
    async (id: string, next: "approved" | "rejected") => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approval_status: next }),
        });
        if (res.ok) fetchUsers();
      } finally {
        setBusyId(null);
      }
    },
    [fetchUsers]
  );

  useEffect(() => {
    const t = setTimeout(fetchUsers, 250);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const openUser  = (id: string) => router.push(`/admin/users?userId=${id}`, { scroll: false });
  const closeUser = ()           => router.push("/admin/users", { scroll: false });

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Manage learners, inspect deep mastery + behavioral profiles, promote admins, or wipe accounts."
        actions={
          <BrandButton
            variant="secondary"
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </BrandButton>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-aristo-brown/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-72 text-sm bg-white/60 border border-white/60 rounded-xl pl-9 pr-3 py-2 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40"
              />
            </div>
            <Select value={expertise} onValueChange={setExpertise}>
              <SelectTrigger className="w-44 bg-white/60 border-white/60">
                <SelectValue placeholder="Expertise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All expertise levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 bg-white/60 border-white/60">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-aristo-brown/50">
              {users === null ? "Loading…" : `${users.length} of ${total} shown`}
            </span>
          </div>
        }
      />

      <BrandCard padding="none">
        {users === null ? (
          <div className="p-8 text-center text-xs text-aristo-brown/50">
            Loading users…
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs text-aristo-brown/50">
            No users match your filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Expertise</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Quizzes</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer"
                  onClick={() => openUser(u.id)}
                >
                  <TableCell className="font-medium text-aristo-brown">
                    <div>{u.full_name ?? "—"}</div>
                    <div className="text-[10px] text-aristo-brown/40 font-normal truncate max-w-[260px]">
                      {u.email ?? u.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <BrandBadge variant={STATUS_COLOR[u.approval_status] ?? "neutral"}>
                      {u.approval_status}
                    </BrandBadge>
                  </TableCell>
                  <TableCell className="text-xs text-aristo-brown/70 capitalize">
                    {u.goal?.replace(/_/g, " ") ?? "—"}
                  </TableCell>
                  <TableCell>
                    {u.expertise_level ? (
                      <BrandBadge variant={EXPERTISE_COLOR[u.expertise_level] ?? "neutral"}>
                        {u.expertise_level}
                      </BrandBadge>
                    ) : (
                      <span className="text-xs text-aristo-brown/30">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-aristo-brown/70 capitalize">
                    {u.engagement_pattern ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-aristo-brown/70 tabular-nums">
                    {u.quiz_attempt_count ?? 0}
                  </TableCell>
                  <TableCell className="text-xs text-aristo-brown/50">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {u.is_admin ? (
                      <BrandBadge variant="orange" size="md">Admin</BrandBadge>
                    ) : (
                      <span className="text-xs text-aristo-brown/40">Learner</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.approval_status === "pending" && (
                        <>
                          <BrandButton
                            variant="success"
                            size="sm"
                            disabled={busyId === u.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setApprovalStatus(u.id, "approved");
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </BrandButton>
                          <BrandButton
                            variant="destructive"
                            size="sm"
                            disabled={busyId === u.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setApprovalStatus(u.id, "rejected");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </BrandButton>
                        </>
                      )}
                      <BrandButton
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUser(u.id);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </BrandButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </BrandCard>

      <UserDetailDrawer
        userId={selectedId}
        open={!!selectedId}
        onClose={closeUser}
        onMutated={fetchUsers}
      />
    </>
  );
}
