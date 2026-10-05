import { useState } from "react";
import { CommunityPostBody } from "../CommunityPostBody";
import { ChatMessageList } from "../ChatMessageList";
import {
  type DataDomain,
  type DataRow,
  FIELD_LABELS,
} from "../../../supabase/functions/_shared/user-data-contract";
import type { ChatMessage } from "../../types/chat";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
export function UserDataRecord(
  { domain, record, context = [], target }: {
    domain: DataDomain;
    record: DataRow;
    context?: DataRow[];
    target: string;
  },
) {
  const [image, setImage] = useState<string | null>(null);
  if (domain === "posts") {
    return (
      <>
        <section className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
          <div className="text-sm text-gray-500">
            {String(record.tag)} · 익명 · {String(record.created_at)}
          </div>
          <CommunityPostBody
            post={{
              title: String(record.title),
              content: String(record.content),
              imageUrls: Array.isArray(record.image_urls)
                ? record.image_urls as string[]
                : [],
            }}
            onViewImage={(index) =>
              setImage((record.image_urls as string[])[index])}
          />
          <p className="text-xs text-gray-500 mt-3">
            좋아요 {String(record.likes_count)} · 댓글{" "}
            {String(record.comments_count)} · 조회 {String(record.views_count)}
            {" "}
            · 신고 {String(record.reports_count)}
          </p>
        </section>
        <div className="space-y-3">
          {context.map((comment, i) => (
            <div
              key={String(comment.id) || i}
              className="bg-white border border-gray-200 rounded-lg p-3"
            >
              <p className="text-xs text-gray-500">
                익명 · {String(comment.created_at)}
                {comment.user_id !== target ? " · 관련 사용자" : ""}
              </p>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                {String(comment.content)}
              </p>
            </div>
          ))}
        </div>
        <Dialog
          open={!!image}
          onOpenChange={(open) => {
            if (!open) setImage(null);
          }}
        >
          <DialogContent
            closeLabel="닫기"
            className="admin-user-data-dialog bg-white sm:max-w-4xl"
            overlayClassName="admin-user-data-overlay"
          >
            <DialogTitle>첨부 이미지</DialogTitle>
            {image && (
              <img
                src={image}
                alt="첨부 이미지 미리보기"
                className="max-h-[70vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }
  if (domain === "storage_images") {
    return (
      <div className="space-y-3">
        <img
          src={String(record.url)}
          alt="사용자 저장 이미지"
          className="max-h-96 object-contain"
        />
        <p className="text-sm break-all">{String(record.name)}</p>
        <p className="text-xs text-gray-600">
          게시글에서 참조 중인 파일은 단독 삭제할 수 없습니다.
        </p>
      </div>
    );
  }
  if (domain === "chat") {
    return (
      <div className="bg-white rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-3">
          선택 메시지 전후 5분 · 가까운 대화 최대 100건 · 관련 사용자 내용은
          조회 전용
        </p>
        <ChatMessageList
          messages={(context.length
            ? context
            : [record]) as unknown as ChatMessage[]}
          viewerId={target}
        />
      </div>
    );
  }
  if (["comments", "announcement_comments"].includes(domain)) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500">
          {String(record.nickname || "익명")} · {String(record.created_at)}
        </p>
        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
          {String(record.content)}
        </p>
      </div>
    );
  }
  return (
    <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-2 text-sm break-words">
      {Object.entries(record).filter(([key]) => !key.startsWith("_")).map((
        [key, value],
      ) => (
        <div key={key} className="contents">
          <dt className="text-gray-600">{FIELD_LABELS[key] || key}</dt>
          <dd className="whitespace-pre-wrap min-w-0">
            {value !== null && typeof value === "object"
              ? (
                <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(value,null,2)}</pre>
              )
              : String(value ?? "—")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
