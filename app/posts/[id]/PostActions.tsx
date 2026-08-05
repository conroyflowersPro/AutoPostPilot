"use client";

import { useState } from "react";
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
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

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

      // Update status to reviewed
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage(null);

    try {
      const urls: string[] = post.media_urls || [];

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
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

      setMessage(`스케줄 완료 (Fedica ID: ${data.fedicaId})`);
      router.refresh();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Grok Review */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">특화 Grok 검수</h3>
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
                {review.score.toFixed(1)}
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

      {/* Media Upload */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h3 className="mb-3 text-sm font-medium">미디어 업로드</h3>
        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-600 bg-zinc-800/50 px-4 py-6 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            capture="environment"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
          {uploading ? "업로드 중..." : "📷 사진/영상 선택 (폰 카메라 가능)"}
        </label>
      </div>

      {/* Schedule */}
      <button
        onClick={handleSchedule}
        disabled={scheduling || post.status === "scheduled"}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
      >
        {scheduling
          ? "스케줄링 중..."
          : post.status === "scheduled"
          ? "이미 스케줄됨"
          : "Fedica로 스케줄링"}
      </button>

      {message && (
        <p className="rounded-lg bg-zinc-800 px-3 py-2 text-center text-xs text-zinc-300">
          {message}
        </p>
      )}
    </div>
  );
}
