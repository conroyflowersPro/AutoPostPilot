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

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    let { width, height } = bitmap;
    if (width > maxSide || height > maxSide) {
      const scale = maxSide / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.78);
    });
  } catch {
    return file;
  }
}

export default function PostActions({
  post,
  nextId,
  prevId,
}: {
  post: Post;
  nextId?: string | null;
  prevId?: string | null;
}) {
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
  const [movingNext, setMovingNext] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const hasMedia = !!(post.media_urls && post.media_urls.length > 0);
  const mediaLocked = post.status === "scheduled";

  /** Next = mark reviewed (if media) then navigate */
  async function goNext(forceWithoutMedia = false) {
    if (movingNext) return;
    setMovingNext(true);
    setMessage(null);

    try {
      if (post.status !== "scheduled" && post.status !== "published") {
        if (hasMedia) {
          const { error } = await supabase
            .from("SeungContent")
            .update({ status: "reviewed" })
            .eq("id", post.id);
          if (error) throw error;
        } else if (!forceWithoutMedia) {
          setMessage("미디어를 올린 뒤 다음을 누르면 reviewed로 들어갑니다.");
          setMovingNext(false);
          return;
        }
      }

      if (nextId) {
        router.push(`/posts/${nextId}`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || "다음 이동 실패");
      setMovingNext(false);
    }
  }

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
      const urls: string[] = [...(post.media_urls || [])];

      for (const file of list) {
        setMessage(`압축·업로드 중… (${file.name.slice(0, 20)})`);
        const blob = await compressImage(file);
        const path = `${post.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, blob, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(path);

        urls.push(publicUrl);
      }

      const { error } = await supabase
        .from("SeungContent")
        .update({ media_urls: urls })
        .eq("id", post.id);
      if (error) throw error;

      setMessage("미디어 업로드 완료 — 다음을 누르면 reviewed");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message || "업로드 실패 — 사진 용량을 줄여 다시 시도");
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
        setMessage(`샘플 ${data.candidates.length}장 — 탭해서 첨부`);
      } else {
        setMessage(
          data.message ||
            "생성 시간초과/실패. 폰 사진첩에서 직접 올려주세요."
        );
      }
    } catch (err: any) {
      setMessage(
        err.message || "이미지 생성 실패 — 폰에서 직접 업로드하세요"
      );
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

  const candidates: string[] =
    genResult?.candidates?.length > 0
      ? genResult.candidates
      : genResult?.imageUrl
      ? [genResult.imageUrl]
      : [];

  return (
    <div className="space-y-4 pb-24">
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
                    {removingIndex === i ? "…" : "✕"}
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
            {uploading ? "압축·업로드 중..." : "🖼 사진첩"}
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading || mediaLocked}
            className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-4 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {uploading ? "압축·업로드 중..." : "📷 촬영"}
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
          미디어 후 아래 <strong>다음</strong> → reviewed → 큐에서 선택 일괄 스케줄
        </p>
      </div>

      <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <summary className="cursor-pointer text-sm text-zinc-400">Grok 검수 (선택)</summary>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">점수·수정 제안이 필요할 때만.</p>
          <button
            onClick={handleReview}
            disabled={loadingReview}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loadingReview ? "검수 중..." : "검수 요청"}
          </button>
        </div>
        {review && (
          <div className="mt-3 space-y-3 text-sm">
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
            {review.feedback && (
              <p className="rounded-lg bg-zinc-800/80 p-3 text-xs leading-relaxed text-zinc-300">
                {review.feedback}
              </p>
            )}
            {review.suggestedMedia && (
              <p className="text-xs text-amber-300">📷 추천 미디어: {review.suggestedMedia}</p>
            )}
            {review.revisedContent && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <p className="mb-1 text-xs text-zinc-400">수정 제안</p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed">{review.revisedContent}</p>
                <button
                  type="button"
                  onClick={handleApplyRevision}
                  disabled={applyingRevision || mediaLocked}
                  className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
                >
                  {applyingRevision ? "적용 중..." : "✓ 수정 제안 적용"}
                </button>
              </div>
            )}
          </div>
        )}
      </details>

      <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <summary className="cursor-pointer text-sm text-zinc-400">Grok 이미지 샘플 (선택)</summary>
        <button
          type="button"
          onClick={handleGenerateImage}
          disabled={generating || mediaLocked}
          className="mt-3 w-full rounded-lg border border-indigo-800/60 bg-indigo-950/40 py-2.5 text-xs text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-50"
        >
          {generating ? "샘플 생성 중 (최대 2장)..." : "✨ Grok 이미지 샘플"}
        </button>
        {candidates.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {candidates.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectCandidate(url, i)}
                disabled={selectingCandidate !== null || mediaLocked}
                className="relative aspect-square overflow-hidden rounded-lg border border-indigo-700/50 bg-zinc-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`c-${i}`}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] text-white">
                  {selectingCandidate === i ? "…" : `선택 ${i + 1}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </details>

      <p className="text-center text-[11px] text-zinc-500">
        Fedica 스케줄은 큐에서 <strong className="text-emerald-400">선택 일괄</strong>
      </p>

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

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3">
          {prevId ? (
            <Link
              href={`/posts/${prevId}`}
              className="flex-1 rounded-lg border border-zinc-700 py-3 text-center text-sm"
            >
              ← 이전
            </Link>
          ) : (
            <span className="flex-1 rounded-lg border border-zinc-800 py-3 text-center text-sm text-zinc-600">
              ← 이전
            </span>
          )}
          <button
            type="button"
            onClick={() => goNext()}
            disabled={movingNext}
            className="flex-[1.4] rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            {movingNext
              ? "…"
              : nextId
              ? "다음 → (reviewed)"
              : "홈 · 일괄 스케줄"}
          </button>
        </div>
      </div>
    </div>
  );
}
