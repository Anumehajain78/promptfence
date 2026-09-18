"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  USE_MOCK,
  agentChat,
  attackRun,
  authorize,
  getSession,
  mockAttackRun,
  resetSession,
  type AgentToolCall,
  type AttackRunResult,
  type DecisionRecord,
} from "@/lib/api";
import { rowNumber } from "./decision";

export type Busy = "idle" | "authorize" | "attack" | "reset" | "chat";

export interface ChatTurn {
  role: "customer" | "agent" | "error";
  text: string;
  ts: string;
  toolCalls?: AgentToolCall[];
}

export interface ManualRequest {
  agent: string;
  action: string;
  amount: string; // raw digits from the input
}

const SESSION_KEY = "promptfence.session";
const REVEAL_INTERVAL_MS = 120;
const DEMO_RESOURCES: Record<string, string> = {
  refund: "order-4474",
  delete_customer: "cust-9821",
  export_customer_data: "customers-export",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function newSessionId(): string {
  const hex = Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `sess-${hex}`;
}

function loadSessionId(): string {
  try {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = newSessionId();
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError || err instanceof Error) return err.message;
  return "Something went wrong.";
}

// If GET /v1/sessions fails after an attack run, rebuild rows from the results alone.
function recordsFromResults(sessionId: string, results: AttackRunResult[], amount: number): DecisionRecord[] {
  let before = 0;
  return results.map((r, i) => {
    const record: DecisionRecord = {
      session_id: sessionId,
      seq: r.seq,
      agent: "support-agent",
      action: "refund",
      resource: `order-${4401 + i}`,
      amount,
      decision: r.decision,
      policy: r.policy,
      reason: "",
      session_total_before: before,
      session_total_after: r.session_total_after,
      ts: "",
    };
    before = r.session_total_after;
    return record;
  });
}

export function useControlRoom(reducedMotion: boolean) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rows, setRows] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  // Bumped to cancel an in-progress reveal (reset, unmount).
  const runToken = useRef(0);

  useEffect(() => {
    const id = loadSessionId();
    setSessionId(id);
    let cancelled = false;
    getSession(id)
      .then((s) => {
        if (!cancelled) setRows(s.decisions);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setRows([]);
        else setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      runToken.current += 1;
    };
  }, []);

  const append = useCallback((record: DecisionRecord) => {
    setRows((prev) => {
      const next = [...prev, record];
      setSelected(rowNumber(record, next.length - 1));
      return next;
    });
  }, []);

  const submit = useCallback(
    async ({ agent, action, amount }: ManualRequest) => {
      if (!sessionId || busy !== "idle") return;
      setBusy("authorize");
      try {
        const body = {
          agent,
          session: sessionId,
          action,
          resource: DEMO_RESOURCES[action] ?? "order-4474",
          ...(action === "refund" && amount !== "" ? { amount: Number(amount) } : {}),
        };
        const res = await authorize(body);
        const amt = body.amount ?? 0;
        append({
          session_id: sessionId,
          seq: res.seq,
          agent,
          action,
          resource: body.resource,
          amount: amt,
          decision: res.decision,
          policy: res.policy,
          reason: res.reason,
          session_total_before: res.session_total,
          session_total_after: res.decision === "ALLOW" && action === "refund" ? res.session_total + amt : res.session_total,
          ts: res.ts,
        });
        setError(null);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setBusy("idle");
      }
    },
    [append, busy, sessionId],
  );

  const sendChat = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!sessionId || busy !== "idle" || !text) return;
      setBusy("chat");
      setTranscript((prev) => [...prev, { role: "customer", text, ts: new Date().toISOString() }]);
      try {
        const answer = await agentChat({ session: sessionId, message: text });
        setTranscript((prev) => [
          ...prev,
          { role: "agent", text: answer.reply, ts: new Date().toISOString(), toolCalls: answer.tool_calls },
        ]);
        setError(null);

        // A tool call becomes a ledger decision: re-read the session so the row
        // slides in, the chart steps and the total moves.
        if (answer.tool_calls.length > 0) {
          const session = await getSession(sessionId);
          setRows(session.decisions);
          const last = session.decisions[session.decisions.length - 1];
          if (last) setSelected(rowNumber(last, session.decisions.length - 1));
        }
      } catch (err) {
        setError(messageOf(err));
        setTranscript((prev) => [
          ...prev,
          { role: "error", text: "The agent couldn't respond. Try again.", ts: new Date().toISOString() },
        ]);
      } finally {
        setBusy("idle");
      }
    },
    [busy, sessionId],
  );

  const runAttack = useCallback(async () => {
    if (!sessionId || busy !== "idle") return;
    const token = ++runToken.current;
    const live = () => runToken.current === token;
    setBusy("attack");
    setError(null);
    try {
      // Replay always starts from an empty session.
      await resetSession(sessionId);
      if (!live()) return;
      setRows([]);
      setSelected(null);

      if (USE_MOCK) {
        const collected: DecisionRecord[] = [];
        for await (const record of mockAttackRun({ session: sessionId })) {
          if (!live()) return;
          if (reducedMotion) collected.push(record);
          else append(record);
        }
        if (reducedMotion && live()) {
          setRows(collected);
          setSelected(collected.length ? rowNumber(collected[collected.length - 1], collected.length - 1) : null);
        }
        return;
      }

      const amount = 9000;
      const run = await attackRun({ session: sessionId, amount });
      if (!live()) return;
      let records: DecisionRecord[];
      try {
        const session = await getSession(run.session_id);
        const wanted = new Set(run.results.map((r) => r.seq));
        records = session.decisions.filter((d) => wanted.has(d.seq));
        if (records.length !== run.results.length) records = recordsFromResults(run.session_id, run.results, amount);
      } catch {
        records = recordsFromResults(run.session_id, run.results, amount);
      }
      if (!live()) return;

      if (reducedMotion) {
        setRows(records);
        setSelected(records.length ? rowNumber(records[records.length - 1], records.length - 1) : null);
        return;
      }
      // The API returns everything at once; reveal row by row to match the mock.
      for (const record of records) {
        await sleep(REVEAL_INTERVAL_MS);
        if (!live()) return;
        append(record);
      }
    } catch (err) {
      if (live()) setError(messageOf(err));
    } finally {
      if (live()) setBusy("idle");
    }
  }, [append, busy, reducedMotion, sessionId]);

  const reset = useCallback(async () => {
    if (!sessionId || busy !== "idle") return;
    runToken.current += 1;
    setBusy("reset");
    try {
      await resetSession(sessionId);
      setRows([]);
      setSelected(null);
      setTranscript([]);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy("idle");
    }
  }, [busy, sessionId]);

  return { sessionId, rows, loading, busy, error, selected, setSelected, submit, runAttack, reset, transcript, sendChat };
}
