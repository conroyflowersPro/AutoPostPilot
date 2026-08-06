"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const [uploading, setUploading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);
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

      setMessage("미디어 업로드 완료 — 이제 스케줄링 가능");
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

      // If API returned a URL, attach it automatically
      if (data.imageUrl) {
        const urls = [...(post.media_urls || []), data.imageUrl];
        await supabase
          .from("SeungContent")
          .update({ media_urls: urls })
          .eq("id", post.id);
        setMessage("AI 이미지 생성 후 첨부 완료");
        router.refresh();
      } else {
        setMessage(
          data.message ||
            "프롬프트가 준비되었습니다. 폰 촬영 또는 외부 생성 후 업로드하세요."
        );
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSchedule() {
    setScheduling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/fedica/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          content: post.content,
          pipelineId: post.pipeline_id,
          mediaUrls: post.media_urls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "스케줄 실패");

      const mediaNote =
        data.mediaIds && data.mediaIds.length > 0
          ? ` (미디어 ${data.mediaIds.length}개 첨부됨)`
          : " (텍스트만)";
      setMessage(`스케줄 완료 (Fedica ID: ${data.fedicaId})${mediaNote}`);
      router.refresh();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setScheduling(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        "이 포스트를 삭제할까요? (Fedica에 안 올린 draft만 삭제됩니다)"
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

  return (
    <div className="space-y-4">
      {/* Grok Review */}
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media Upload — gallery + camera */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h3 className="mb-3 text-sm font-medium">
          미디어 업로드 {hasMedia ? `(${post.media_urls!.length}개)` : ""}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-4 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "🖼 사진첩에서 선택"}
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-zinc-600 bg-zinc-800/50 px-3 py-4 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "📷 카메라로 촬영"}
          </button>
        </div>

        {/* Gallery: no capture → photo library */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        {/* Camera */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <p className="mt-2 text-[11px] text-zinc-500">
          사진첩 또는 카메라 모두 가능합니다. 업로드 후 스케줄 시 Fedica에
          첨부됩니다.
        </p>

        {/* Optional AI generate */}
        <button
          type="button"
          onClick={handleGenerateImage}
          disabled={generating}
          className="mt-3 w-full rounded-lg border border-indigo-800/60 bg-indigo-950/40 py-2.5 text-xs text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-50"
        >
          {generating
            ? "Grok 이미지 생성 중..."
            : "✨ Grok으로 이미지 생성 (선택)"}
        </button>

        {genResult?.prompt && !genResult.imageUrl && (
          <div className="mt-2 rounded-lg bg-zinc-800/80 p-2 text-[11px] text-zinc-400">
            <p className="mb-1 text-zinc-500">생성 프롬프트:</p>
            <p className="whitespace-pre-wrap">{genResult.prompt}</p>
          </div>
        )}
      </div>

      {/* Schedule */}
      <button
        onClick={handleSchedule}
        disabled={scheduling || post.status === "scheduled"}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
      >
        {scheduling
          ? "스케줄링 중... (미디어 업로드 포함)"
          : post.status === "scheduled"
          ? "이미 스케줄됨"
          : hasMedia
          ? "Fedica로 스케줄링 (미디어 포함)"
          : "Fedica로 스케줄링 (텍스트만)"}
      </button>

      {/* Delete */}
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
