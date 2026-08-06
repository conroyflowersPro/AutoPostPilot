"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Post = {
  id: string;
  content: string;
  status: string;
  pipeline_id: string | null;
  media_urls: string[] | null;
  scheduled_at: string | null;
  fedica_post_id: string | null;
};

export default function PostActions({ post }: { post: Post }) {
  const [review, setReview] = useState<any>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [applyingRevision, setApplyingRevision] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);
  const [selectingCandidate, setSelectingCandidate] = useState<number | null>(
    null
  );
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleReview() {
    setLoadingReview(true);
    setMessage(null);
    try {
      const res = await fetch("/api/grok/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: post.content,
          pipelineId: post.pipeline_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "검수 실패");
      setReview(data);

      await supabase
        .from("SeungContent")
        .update({ status: "reviewed" })
        .eq("id", post.id);
      router.refresh();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoadingReview(false);
    }
  }

  async function handleApplyRevision() {
    if (!review?.revisedContent) return;
    if (!confirm("수정 제안으로 본문을 바꿀까요?")) return;

    setApplyingRevision(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from("SeungContent")
        .update({
          content: review.revisedContent,
          status: "reviewed",
        })
        .eq("id", post.id);
      if (error) throw error;
      setMessage("수정 제안이 본문에 적용되었습니다.");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || "적용 실패");
    } finally {
      setApplyingRevision(false);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setMessage(null);

    try {
      const urls: string[] = post.media_urls || [];

      for (const file of list) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${post.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(path);

        urls.push(publicUrl);
      }

      await supabase
        .from("SeungContent")
        .update({ media_urls: urls })
        .eq("id", post.id);

      setMessage("미디어 업로드 완료");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
    e.target.value = "";
  }

  async function handleRemoveMedia(index: number) {
    if (post.status === "scheduled") {
      setMessage("이미 스케줄된 포스트의 미디어는 삭제할 수 없습니다.");
      return;
    }
    if (!post.media_urls || index < 0 || index >= post.media_urls.length) return;
    if (!confirm("이 미디어를 삭제할까요?")) return;

    setRemovingIndex(index);
    setMessage(null);
    try {
      const next = post.media_urls.filter((_, i) => i !== index);
      const { error } = await supabase
        .from("SeungContent")
        .update({ media_urls: next })
        .eq("id", post.id);
      if (error) throw error;
      setMessage("미디어 삭제됨");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || "미디어 삭제 실패");
    } finally {
      setRemovingIndex(null);
    }
  }

  async function handleGenerateImage() {
    setGenerating(true);
    setMessage(null);
    setGenResult(null);
    try {
      const prompt =
        review?.suggestedMedia ||
        `Natural photo matching this post: ${post.content.slice(0, 200)}`;

      const res = await fetch("/api/grok/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          postContent: post.content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");

      setGenResult(data);

      if (data.candidates?.length) {
        setMessage(
          `샘플 ${data.candidates.length}장 준비됨 — 원하는 이미지를 선택하세요.`
        );
      } else if (data.imageUrl) {
        setMessage("이미지 1장 생성됨 — 아래에서 선택하세요.");
      } else {
        setMessage(
          data.message ||
            "생성 제한. 폰으로 촬영해 업로드하거나 프롬프트를 사용하세요."
        );
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectCandidate(url: string, index: number) {
    if (post.status === "scheduled") return;
    setSelectingCandidate(index);
    setMessage(null);
    try {
      const urls = [...(post.media_urls || []), url];
      const { error } = await supabase
        .from("SeungContent")
        .update({ media_urls: urls })
        .eq("id", post.id);
      if (error) throw error;
      setMessage("선택한 이미지가 첨부되었습니다.");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || "첨부 실패");
    } finally {
      setSelectingCandidate(null);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        "이 포스트를 삭제할까요? (Fedica에 안 올린 글만 삭제 권장)"
      )
    ) {
      return;
    }
    setDeleting(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from("SeungContent")
        .delete()
        .eq("id", post.id);
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || "삭제 실패");
      setDeleting(false);
    }
  }

  const hasMedia = post.media_urls && post.media_urls.length > 0;
  const mediaLocked = post.status === "scheduled";
  const candidates: string[] =
    genResult?.candidates?.length > 0
      ? genResult.candidates
      : genResult?.imageUrl
      ? [genResult.imageUrl]
      : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">특화 Grok 검수 · 관리</h3>
          <button
            onClick={handleReview}
            disabled={loadingReview}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loadingReview ? "검수 중..." : "검수 요청"}
          </button>
        </div>

        {review && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">종합 점수</span>
              <span
                className={`text-lg font-semibold ${
                  review.score >= 8
                    ? "text-emerald-400"
                    : review.score >= 7
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {review.score?.toFixed?.(1) ?? review.score}
              </span>
            </div>

            {review.scores && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Conversation: {review.scores.conversation}</div>
                <div>Velocity: {review.scores.velocity}</div>
                <div>Profile: {review.scores.profile}</div>
                <div>Authenticity: {review.scores.authenticity}</div>
                <div>Media: {review.scores.media}</div>
              </div>
            )}

            {review.feedback && (
              <p className="rounded-lg bg-zinc-800/80 p-3 text-xs leading-relaxed text-zinc-300">
                {review.feedback}
              </p>
            )}

            {review.suggestedMedia && (
              <p className="text-xs text-amber-300">
                📷 추천 미디어: {review.suggestedMedia}
              </p>
            )}

            {review.revisedContent && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <p className="mb-1 text-xs text-zinc-400">수정 제안</p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed">
                  {review.revisedContent}
                </p>
                <button
                  type="button"
                  onClick={handleApplyRevision}
                  disabled={applyingRevision || mediaLocked}
                  className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
                >
                  {applyingRevision
                    ? "적용 중..."
                    : "✓ 수정 제안 적용 (본문 교체)"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h3 className="mb-3 text-sm font-medium">
          미디어 {hasMedia ? `(${post.media_urls!.length}개)` : ""}
        </h3>

        {hasMedia && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {post.media_urls!.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="relative aspect-square overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`media-${i}`}
                  className="h-full w-full object-cover"
                />
                {!mediaLocked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(i)}
                    disabled={removingIndex === i}
                    className="absolute right-1.5 top-1.5 rounded-md bg-black/75 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {removingIndex === i ? "…" : "✕ 삭제"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading || mediaLocked}
            className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-4 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "🖼 사진첩에서 선택"}
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading || mediaLocked}
            className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-4 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "📷 카메라로 촬영"}
          </button>
        </div>

        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <p className="mt-2 text-[11px] text-zinc-500">
          일괄 스케줄에는 미디어 + 검수(reviewed) 필요.
        </p>

        <button
          type="button"
          onClick={handleGenerateImage}
          disabled={generating || mediaLocked}
          className="mt-3 w-full rounded-lg border border-indigo-800/60 bg-indigo-950/40 py-2.5 text-xs text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-50"
        >
          {generating
            ? "Grok 샘플 생성 중 (최대 4장)..."
            : "✨ Grok 이미지 샘플 생성"}
        </button>

        {candidates.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-zinc-400">
              샘플 중 원하는 이미지를 탭해서 첨부 ({candidates.length}장)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {candidates.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectCandidate(url, i)}
                  disabled={selectingCandidate !== null || mediaLocked}
                  className="relative aspect-square overflow-hidden rounded-lg border border-indigo-700/50 bg-zinc-900 ring-offset-2 ring-offset-zinc-950 hover:ring-2 hover:ring-indigo-500 disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`candidate-${i}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    {selectingCandidate === i ? "첨부 중…" : `선택 ${i + 1}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-center">
        <p className="text-xs text-emerald-200/90">
          Fedica 스케줄은 <strong>홈 화면 일괄 스케줄</strong>만 사용합니다.
          (단건 스케줄 제거됨)
        </p>
        <Link
          href="/"
          className="mt-2 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium hover:bg-emerald-600"
        >
          홈에서 일괄 스케줄 →
        </Link>
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting || post.status === "scheduled"}
        className="w-full rounded-xl border border-red-900/60 bg-red-950/40 py-2.5 text-sm text-red-300 hover:bg-red-900/40 disabled:opacity-40"
      >
        {deleting ? "삭제 중..." : "포스트 삭제"}
      </button>

      {message && (
        <p className="rounded-lg bg-zinc-800 px-3 py-2 text-center text-xs text-zinc-300">
          {message}
        </p>
      )}
    </div>
  );
}
