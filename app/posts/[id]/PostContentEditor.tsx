"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function PostContentEditor({
  postId,
  content,
  status,
}: {
  postId: string;
  content: string;
  status: string;
}) {
  const locked = status === "scheduled" || status === "published";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleSave() {
    const next = value.trim();
    if (!next) {
      setMsg("본문이 비어 있습니다");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("SeungContent")
        .update({ content: next })
        .eq("id", postId);
      if (error) throw error;
      setEditing(false);
      setMsg("저장됨");
      router.refresh();
    } catch (e: any) {
      setMsg(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setValue(content);
    setEditing(false);
    setMsg(null);
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">본문</span>
          {!locked && (
            <button
              type="button"
              onClick={() => {
                setValue(content);
                setEditing(true);
                setMsg(null);
              }}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
            >
              ✏️ 수정
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-800/50 bg-zinc-900/60 p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-indigo-300">본문 수정</span>
        <span className="text-[10px] text-zinc-500">{value.length}자</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-relaxed outline-none focus:border-indigo-500"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs hover:bg-zinc-700 disabled:opacity-50"
        >
          취소
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}
