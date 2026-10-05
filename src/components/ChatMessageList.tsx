import type { ChatMessage } from "../types/chat";
import { formatTimeAgoKorean } from "../utils/timeAgo";
export function ChatMessageList(
  { messages, viewerId }: { messages: ChatMessage[]; viewerId?: string },
) {
  return (
    <>
      {messages.map((m, idx) => {
        const isMine = Boolean(viewerId && m.user_id === viewerId);
        const prev = idx > 0 ? messages[idx - 1] : null;
        const next = idx < messages.length - 1 ? messages[idx + 1] : null;
        const isFirstInStreak = !prev || prev.user_id !== m.user_id;
        const isLastInStreak = !next || next.user_id !== m.user_id;
        const marginTop = idx === 0 ? 0 : isFirstInStreak ? 12 : 4;

        return (
          <div
            key={m.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            style={{ marginTop }}
          >
            <div
              className="max-w-[85%]"
              style={{
                maxWidth: "85%",
                display: "inline-flex",
                flexDirection: "column",
                alignItems: isMine ? "flex-end" : "flex-start",
              }}
            >
              {!isMine && isFirstInStreak && (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {m.nickname}
                  </span>
                </div>
              )}

              <div
                className={`${
                  !isMine && isFirstInStreak ? "mt-1" : ""
                } px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${
                  isMine
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
                style={{ display: "inline-block" }}
              >
                {m.content}
              </div>

              {isLastInStreak && (
                <div
                  className={`mt-1 flex ${
                    isMine ? "justify-end" : "justify-start"
                  }`}
                >
                  <span className="text-xs text-gray-500">
                    {formatTimeAgoKorean(m.created_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
