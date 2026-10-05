import { Images } from "lucide-react";
import type { CommunityPost } from "../types/community";
export function CommunityPostBody(
  { post, onViewImage }: {
    post: Pick<CommunityPost, "title" | "content" | "imageUrls">;
    onViewImage: (index: number) => void;
  },
) {
  return (
    <>
      <h1 className="text-lg sm:text-xl font-bold text-gray-900 mt-3">
        {post.title}
      </h1>
      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
        {post.content}
      </p>

      {post.imageUrls.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
              <Images className="w-4 h-4" />
              첨부 이미지 {post.imageUrls.length}장
            </span>
            <span>눌러서 크게 보기</span>
          </div>

          {post.imageUrls.length === 1
            ? (
              <button
                type="button"
                onClick={() => onViewImage(0)}
                className="w-full max-w-2xl mx-auto h-64 sm:h-80 rounded-lg overflow-hidden border border-gray-200 bg-white"
              >
                <img
                  src={post.imageUrls[0]}
                  alt="첨부 이미지 1"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
              </button>
            )
            : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {post.imageUrls.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onViewImage(index)}
                    className="relative aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 bg-white"
                  >
                    <img
                      src={url}
                      alt={`첨부 이미지 ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
    </>
  );
}
