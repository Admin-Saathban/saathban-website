/* ════════════════════════════════════════════════
   /app/admin/content — what people have put up, newest first.

   admin_recent_content (0153), support or super, audited each load.
   Three lists: community posts, group posts, and message reports.
   Admins cannot read direct messages — a message report shows only the
   snapshot the reporter's own client took.

   HIDE is moderate_content (0125): reversible, audited, and the only
   way hidden_at ever changes. REMOVE is admin_remove_content (0153):
   not reversible, super-admin only, audited BEFORE the delete with a
   snapshot (never a DM body). Files attached to what was removed are
   then deleted through the Storage API, and the database says what is
   really gone.
   ════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { APP_COLORS as C } from "../../../shared/tokens.js";
import { useI18n } from "../../lib/i18n.jsx";
import { Card, AdminBtn, fmtDateTime } from "./ui.jsx";
import { PageTitle, Chip, Notice, inputStyle } from "./adminBits.jsx";
import * as api from "./accountsApi.js";

export default function ContentPage() {
  const { t } = useI18n();
  const { admin } = useOutletContext();
  const isSuper = admin.level === "super";
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState("posts");

  const load = useCallback(async () => {
    try {
      setData(await api.recentContent());
    } catch (e) {
      setMsg({ kind: "err", text: t(api.refusalKey(e) || "admin.content.loadFailed") });
      setData({ posts: [], group_posts: [], message_reports: [] });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs = [
    { key: "posts", label: t("admin.content.posts"), n: data?.posts?.length },
    { key: "group_posts", label: t("admin.content.groupPosts"), n: data?.group_posts?.length },
    { key: "message_reports", label: t("admin.content.messageReports"), n: data?.message_reports?.length },
  ];

  return (
    <div style={{ maxWidth: 980 }}>
      <PageTitle title={t("admin.content.title")} intro={t("admin.content.intro")} />
      <p style={{ color: C.textMuted, fontSize: 16, margin: "-10px 0 16px" }}>
        {isSuper ? t("admin.content.removeWhoSuper") : t("admin.content.removeWhoSupport")}
      </p>
      <Notice msg={msg} />

      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {tabs.map((x) => (
          <button
            key={x.key}
            role="tab"
            type="button"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            style={{
              minHeight: 48,
              padding: "0 16px",
              borderRadius: 50,
              border: `2px solid ${C.green}`,
              background: tab === x.key ? C.green : C.white,
              color: tab === x.key ? C.cream : C.green,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {x.label}
            {x.n != null ? ` (${x.n})` : ""}
          </button>
        ))}
      </div>

      {data === null ? (
        <p role="status">{t("admin.content.loading")}</p>
      ) : (
        <Card>
          {(data[tab] || []).length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted }}>{t("admin.content.empty")}</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {data[tab].map((item) =>
                tab === "message_reports" ? (
                  <MessageReport key={item.id} r={item} isSuper={isSuper} onDone={load} onNotice={setMsg} />
                ) : (
                  <ContentItem
                    key={item.id}
                    kind={tab === "posts" ? "post" : "group_post"}
                    item={item}
                    isSuper={isSuper}
                    onDone={load}
                    onNotice={setMsg}
                  />
                )
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* A removal's result is shown at the top of the page, not in the item:
   the refetch that follows takes the removed item — and anything drawn
   inside it — off the screen, so the confirmation and the file count
   used to vanish before anyone could read them. */
function useAct(onDone, onNotice) {
  const { t } = useI18n();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const act = async (fn, ok, { lift = false } = {}) => {
    setBusy(true);
    setMsg(null);
    if (lift && onNotice) onNotice(null);
    try {
      const out = await fn();
      let text = ok;
      if (out && out.batch && (out.files || []).length) {
        const f = await api.removeQueuedFiles(out.batch, out.files).catch(() => null);
        text += " " + (f ? t("admin.files.removed", { n: f.removed, total: out.files.length }) : t("admin.files.unchecked"));
        if (f && f.remaining?.length) text += " " + t("admin.files.remaining", { n: f.remaining.length });
      }
      if (lift && onNotice) {
        onNotice({ kind: "ok", text });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setMsg({ kind: "ok", text });
      }
      await onDone();
    } catch (e) {
      const key = api.refusalKey(e);
      setMsg({ kind: "err", text: key ? t(key) : e.message || t("admin.people.failed") });
    } finally {
      setBusy(false);
    }
  };
  return { msg, busy, act, setMsg };
}

function Frame({ children, hidden }) {
  return (
    <div
      style={{
        border: `1px solid ${C.warmGray}`,
        borderInlineStart: `4px solid ${hidden ? C.brown : C.olive}`,
        borderRadius: 10,
        padding: "14px 18px",
      }}
    >
      {children}
    </div>
  );
}

function Actions({ reason, setReason, children }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("admin.content.reason")}
        aria-label={t("admin.content.reason")}
        style={{ ...inputStyle, flex: "1 1 220px", width: "auto" }}
      />
      {children}
    </div>
  );
}

function ContentItem({ kind, item, isSuper, onDone, onNotice }) {
  const { t } = useI18n();
  const { msg, busy, act, setMsg } = useAct(onDone, onNotice);
  const [reason, setReason] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const hidden = Boolean(item.hidden_at);
  const r = reason.trim();

  const hide = () => {
    if (r.length < 3) return setMsg({ kind: "err", text: t("admin.people.errReason") });
    return act(() => api.hideContent(kind, item.id, !hidden, r), hidden ? t("admin.content.unhidden") : t("admin.content.hidden"));
  };
  const remove = () => {
    if (r.length < 5) return setMsg({ kind: "err", text: t("admin.people.errReason") });
    if (!confirmRemove) return setConfirmRemove(true);
    setConfirmRemove(false);
    return act(() => api.removeContent(kind, item.id, r), t("admin.content.removed"), { lift: true });
  };

  return (
    <Frame hidden={hidden}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
        <Link to={`/app/admin/people/${item.author_id}`} style={{ color: C.green, fontWeight: 700 }}>
          {item.author_name || t("admin.people.unnamed")}
        </Link>
        {item.author_is_test && <Chip kind="test">{t("admin.people.status.test")}</Chip>}
        <span style={{ color: C.textMuted, fontSize: 15 }}>{fmtDateTime(item.created_at)}</span>
        {item.group_name && (
          <span style={{ fontSize: 15 }}>{t("admin.content.inGroup", { name: item.group_name })}</span>
        )}
        {item.open_reports > 0 && <Chip kind="paused">{t("admin.content.openReports", { n: item.open_reports })}</Chip>}
        {hidden && (
          <Chip kind="hidden">
            {t("admin.content.hiddenBy", {
              name: item.hidden_by_name || t("admin.content.someone"),
              when: fmtDateTime(item.hidden_at),
            })}
          </Chip>
        )}
      </div>
      <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {item.body || <em style={{ color: C.textMuted }}>{t("admin.content.noText")}</em>}
      </p>
      {(item.has_image || item.has_audio || item.comments > 0) && (
        <p style={{ margin: "6px 0 0", color: C.textMuted, fontSize: 15 }}>
          {[
            item.has_image && t("admin.content.hasImage"),
            item.has_audio && t("admin.content.hasAudio"),
            item.comments > 0 && t("admin.content.comments", { n: item.comments }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <Notice msg={msg} />
      <Actions reason={reason} setReason={setReason}>
        <AdminBtn kind="ghost" disabled={busy} onClick={hide}>
          {hidden ? t("admin.content.unhide") : t("admin.content.hide")}
        </AdminBtn>
        {isSuper && (
          <AdminBtn kind="danger" disabled={busy} onClick={remove}>
            {confirmRemove ? t("admin.content.removeConfirm") : t("admin.content.remove")}
          </AdminBtn>
        )}
      </Actions>
    </Frame>
  );
}

function MessageReport({ r, isSuper, onDone, onNotice }) {
  const { t } = useI18n();
  const { msg, busy, act, setMsg } = useAct(onDone, onNotice);
  const [reason, setReason] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const canRemove = isSuper && r.target_kind === "dm_message" && r.message_exists;

  const remove = () => {
    if (reason.trim().length < 5) return setMsg({ kind: "err", text: t("admin.people.errReason") });
    if (!confirmRemove) return setConfirmRemove(true);
    setConfirmRemove(false);
    return act(() => api.removeContent("dm_message", r.target_id, reason.trim(), r.id), t("admin.content.removed"), { lift: true });
  };

  return (
    <Frame hidden={r.status !== "open"}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
        <Chip>{t(`admin.mod.surface.${r.target_kind}`)}</Chip>
        <Chip kind={r.status === "open" ? "paused" : "active"}>{t(`admin.content.reportStatus.${r.status}`)}</Chip>
        <span style={{ color: C.textMuted, fontSize: 15 }}>{fmtDateTime(r.created_at)}</span>
      </div>
      {r.target_excerpt ? (
        <p style={{ margin: 0, fontStyle: "italic", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>“{r.target_excerpt}”</p>
      ) : (
        <p style={{ margin: 0, color: C.textMuted }}>{t("admin.mod.noExcerpt")}</p>
      )}
      <p style={{ margin: "6px 0 0", fontSize: 16, color: C.textMuted }}>
        {t("admin.content.snapshotNote")}
        {" · "}
        {t("admin.content.author")}{" "}
        {r.target_author_id ? (
          <Link to={`/app/admin/people/${r.target_author_id}`} style={{ color: C.green, fontWeight: 700 }}>
            {r.author_name || t("admin.people.unnamed")}
          </Link>
        ) : (
          t("admin.content.someone")
        )}
        {" · "}
        {t("admin.mod.reportedBy", { name: r.reporter_name || t("admin.content.someone") })}
        {r.reason ? ` · ${t("admin.mod.reasonLabel")} ${r.reason}` : ""}
      </p>
      {r.target_kind === "dm_message" && !r.message_exists && (
        <p style={{ margin: "6px 0 0", color: C.textMuted }}>{t("admin.content.messageGone")}</p>
      )}
      <Notice msg={msg} />
      {canRemove ? (
        <Actions reason={reason} setReason={setReason}>
          <AdminBtn kind="danger" disabled={busy} onClick={remove}>
            {confirmRemove ? t("admin.content.removeConfirm") : t("admin.content.removeMessage")}
          </AdminBtn>
        </Actions>
      ) : (
        <p style={{ margin: "8px 0 0", fontSize: 15 }}>
          <Link to="/app/admin/moderation" style={{ color: C.green, fontWeight: 700 }}>
            {t("admin.content.toModeration")}
          </Link>
        </p>
      )}
    </Frame>
  );
}
