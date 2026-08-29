/* ════════════════════════════════════════════════
   My Circle — data layer for the signed-in Icon (migration 0005).

   Real reads/writes against circle_members and circle_invites; RLS is
   the boundary (every policy keys on icon_id = auth.uid()), this hook
   only reflects it. Member and requester names come from safe_profiles
   (the Icon cannot read another person's profiles row — that view is
   the only lawful source), fetched in a second query and merged by id.

   Permissions default OFF at the database (SPEC.md, My Circle). Toggles
   here are optimistic for immediacy, reconciled against the server and
   rolled back on error, so the screen never shows a grant the database
   did not accept.

   SOS ordering is kept 1..N among SOS contacts, compacted on removal
   and swapped on reorder — the schema stores sos_order but leaves the
   sequencing to the app.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../../lib/supabase.js";

const MEMBER_COLS =
  "id, member_id, is_sos_contact, sos_order, can_see_mood, can_see_health, can_manage_reminders, can_configure_daily_log, location_access, created_at";

/* Attach display fields from safe_profiles to a set of rows keyed by
   the given id field. Names the Icon is allowed to see; nothing more. */
async function withProfiles(rows, idField) {
  const ids = [...new Set(rows.map((r) => r[idField]).filter(Boolean))];
  if (ids.length === 0) return rows.map((r) => ({ ...r, person: null }));
  const { data, error } = await supabase
    .from("safe_profiles")
    .select("id, full_name, city, is_org")
    .in("id", ids);
  if (error) throw error;
  const byId = Object.fromEntries((data || []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, person: byId[r[idField]] || null }));
}

export function useCircle(iconId) {
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const alive = useRef(true);

  const markBusy = (id, on) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });

  const refetch = useCallback(async () => {
    if (!iconId) return;
    try {
      const [{ data: mRows, error: mErr }, { data: iRows, error: iErr }] = await Promise.all([
        supabase
          .from("circle_members")
          .select(MEMBER_COLS)
          .eq("icon_id", iconId)
          .order("created_at", { ascending: true }),
        supabase
          .from("circle_invites")
          .select("id, created_by, created_at, expires_at, invitee_email")
          .eq("icon_id", iconId)
          .eq("direction", "member_to_icon")
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: true }),
      ]);
      if (mErr) throw mErr;
      if (iErr) throw iErr;

      const [withM, withI] = await Promise.all([
        withProfiles(mRows || [], "member_id"),
        withProfiles(iRows || [], "created_by"),
      ]);
      if (!alive.current) return;
      // SOS contacts first (by order), then everyone else by join time.
      withM.sort((a, b) => {
        if (a.is_sos_contact !== b.is_sos_contact) return a.is_sos_contact ? -1 : 1;
        if (a.is_sos_contact) return (a.sos_order ?? 99) - (b.sos_order ?? 99);
        return new Date(a.created_at) - new Date(b.created_at);
      });
      setMembers(withM);
      setRequests(withI);
      setError(null);
    } catch (e) {
      if (alive.current) setError(e.message || "Something went wrong");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [iconId]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    refetch();
    return () => {
      alive.current = false;
    };
  }, [refetch]);

  /* Persist a partial change to one membership row, optimistically.
     patch is applied to local state first; on failure we reload from
     the server so the UI can never keep a grant the DB rejected. */
  const patchMember = useCallback(
    async (rowId, patch) => {
      const prev = members;
      setMembers((cur) => cur.map((m) => (m.id === rowId ? { ...m, ...patch } : m)));
      markBusy(rowId, true);
      const { error: upErr } = await supabase
        .from("circle_members")
        .update(patch)
        .eq("id", rowId)
        .eq("icon_id", iconId);
      markBusy(rowId, false);
      if (upErr) {
        setMembers(prev); // immediate rollback
        setError(upErr.message);
        refetch(); // and reconcile with the truth
      }
    },
    [members, iconId, refetch]
  );

  const setPermission = (rowId, column, value) => patchMember(rowId, { [column]: value });

  const setLocation = (rowId, value /* 'never' | 'sos_only' */) =>
    patchMember(rowId, { location_access: value });

  /* SOS on/off, keeping order compact. Toggling on appends after the
     current SOS contacts; toggling off renumbers the rest 1..N. */
  const toggleSos = useCallback(
    async (rowId) => {
      const row = members.find((m) => m.id === rowId);
      if (!row) return;
      const sos = members.filter((m) => m.is_sos_contact);
      if (row.is_sos_contact) {
        await patchMember(rowId, { is_sos_contact: false, sos_order: null });
        // recompact remaining SOS contacts
        const rest = sos.filter((m) => m.id !== rowId).sort((a, b) => a.sos_order - b.sos_order);
        for (let i = 0; i < rest.length; i++) {
          if (rest[i].sos_order !== i + 1) await patchMember(rest[i].id, { sos_order: i + 1 });
        }
      } else {
        await patchMember(rowId, { is_sos_contact: true, sos_order: sos.length + 1 });
      }
    },
    [members, patchMember]
  );

  /* Swap this SOS contact's order with its neighbour in the given
     direction (-1 earlier, +1 later). */
  const moveSos = useCallback(
    async (rowId, dir) => {
      const sos = members
        .filter((m) => m.is_sos_contact)
        .sort((a, b) => a.sos_order - b.sos_order);
      const i = sos.findIndex((m) => m.id === rowId);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= sos.length) return;
      const a = sos[i];
      const b = sos[j];
      await Promise.all([
        patchMember(a.id, { sos_order: b.sos_order }),
        patchMember(b.id, { sos_order: a.sos_order }),
      ]);
    },
    [members, patchMember]
  );

  /* One tap, no confirmation, no notice to the removed person. */
  const removeMember = useCallback(
    async (rowId) => {
      const prev = members;
      setMembers((cur) => cur.filter((m) => m.id !== rowId));
      const { error: delErr } = await supabase
        .from("circle_members")
        .delete()
        .eq("id", rowId)
        .eq("icon_id", iconId);
      if (delErr) {
        setMembers(prev);
        setError(delErr.message);
      } else {
        refetch(); // recompact SOS ordering if an SOS contact was removed
      }
    },
    [members, iconId, refetch]
  );

  /* Approve a pending join request with one tap (RPC owns the move). */
  const approveRequest = useCallback(
    async (inviteId) => {
      markBusy(inviteId, true);
      const { error: rpcErr } = await supabase.rpc("approve_circle_request", {
        p_invite_id: inviteId,
      });
      markBusy(inviteId, false);
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      await refetch();
    },
    [refetch]
  );

  /* Create an invite the Icon can share — returns the 6-digit code, or
     null on error (message lands in `error`). */
  const createInvite = useCallback(async ({ email, phone } = {}) => {
    const { data, error: rpcErr } = await supabase.rpc("create_circle_invite", {
      p_email: email || null,
      p_phone: phone || null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      return null;
    }
    return data?.[0]?.code ?? null;
  }, []);

  return {
    members,
    requests,
    loading,
    error,
    busyIds,
    actions: {
      setPermission,
      setLocation,
      toggleSos,
      moveSos,
      removeMember,
      approveRequest,
      createInvite,
      refetch,
    },
  };
}
