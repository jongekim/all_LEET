import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Eye, Flag, Trash2, Images, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, useAuth } from '../contexts/AuthContext';
import type { CommunityPost } from '../types/community';
import { formatTimeAgoKorean } from '../utils/timeAgo';

const COMMUNITY_IMAGE_PUBLIC_PREFIX = '/storage/v1/object/public/community-post-images/';

const getStorageObjectPathFromPublicUrl = (url: string) => {
  const markerIndex = url.indexOf(COMMUNITY_IMAGE_PUBLIC_PREFIX);
  if (markerIndex < 0) return null;
  return decodeURIComponent(url.slice(markerIndex + COMMUNITY_IMAGE_PUBLIC_PREFIX.length));
};

export function CommunityPostPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id || '';

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('community_posts')
        .select(
          'id,user_id,tag,title,content,image_urls,created_at,likes_count,views_count,reports_count,comments_count,community_comments(id,user_id,content,created_at,likes_count,reports_count)'
        )
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Failed to load post:', error);
        setPost(null);
        setLoading(false);
        return;
      }

      const comments = (data.community_comments || []).map((comment) => ({
        id: comment.id,
        postId: data.id,
        author: comment.user_id,
        content: comment.content,
        createdAt: Date.parse(comment.created_at),
        likes: comment.likes_count ?? 0,
        reports: comment.reports_count ?? 0,
      }));

      setPost({
        id: data.id,
        tag: data.tag,
        title: data.title,
        content: data.content,
        imageUrls: data.image_urls ?? [],
        author: data.user_id,
        createdAt: Date.parse(data.created_at),
        comments,
        commentsCount: data.comments_count ?? comments.length,
        likes: data.likes_count ?? 0,
        views: data.views_count ?? 0,
        reports: data.reports_count ?? 0,
      });

      setLoading(false);

      await supabase.rpc('increment_community_post_view', { post_id: data.id });
      setPost((prev) => (prev ? { ...prev, views: prev.views + 1 } : prev));
    };

    fetchPost();
  }, [id]);

  useEffect(() => {
    const fetchLikes = async () => {
      if (!currentUserId || !id) {
        setLikedIds(new Set());
        setLikedCommentIds(new Set());
        return;
      }

      const { data: postLikes } = await supabase
        .from('community_post_likes')
        .select('post_id')
        .eq('user_id', currentUserId)
        .eq('post_id', id);

      setLikedIds(new Set((postLikes || []).map((row) => row.post_id)));

      if (post && post.comments.length > 0) {
        const { data: commentLikes } = await supabase
          .from('community_comment_likes')
          .select('comment_id')
          .eq('user_id', currentUserId)
          .in('comment_id', post.comments.map((comment) => comment.id));

        setLikedCommentIds(new Set((commentLikes || []).map((row) => row.comment_id)));
      } else {
        setLikedCommentIds(new Set());
      }
    };

    fetchLikes();
  }, [currentUserId, id, post]);

  useEffect(() => {
    if (viewerIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!post || post.imageUrls.length === 0) return;

      if (event.key === 'Escape') {
        setViewerIndex(null);
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setViewerIndex((prev) => {
          if (prev === null) return prev;
          return (prev - 1 + post.imageUrls.length) % post.imageUrls.length;
        });
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setViewerIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % post.imageUrls.length;
        });
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [viewerIndex, post]);

  const handleToggleLike = () => {
    if (!id) return;
    if (!currentUserId) {
      navigate('/login');
      return;
    }

    const isLiked = likedIds.has(id);

    const run = async () => {
      if (isLiked) {
        const { error } = await supabase
          .from('community_post_likes')
          .delete()
          .eq('post_id', id)
          .eq('user_id', currentUserId);
        if (error) {
          alert('추천 취소에 실패했습니다.');
          return;
        }
      } else {
        const { error } = await supabase.from('community_post_likes').insert({
          post_id: id,
          user_id: currentUserId,
        });
        if (error) {
          alert('추천에 실패했습니다.');
          return;
        }
      }

      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(id);
        else next.add(id);
        return next;
      });
      setPost((prev) => (prev ? { ...prev, likes: Math.max(0, prev.likes + (isLiked ? -1 : 1)) } : prev));
    };

    run();
  };

  const handleReport = () => {
    if (!id) return;
    if (!currentUserId) {
      navigate('/login');
      return;
    }
    const ok = window.confirm('이 글을 신고하시겠습니까?');
    if (!ok) return;
    supabase
      .from('community_post_reports')
      .insert({ post_id: id, user_id: currentUserId })
      .then(({ error }) => {
        if (error) {
          alert('이미 신고한 글입니다.');
          return;
        }
        setPost((prev) => (prev ? { ...prev, reports: prev.reports + 1 } : prev));
        alert('신고가 접수되었습니다.');
      });
  };

  const handleAddComment = async () => {
    if (!id) return;
    if (!currentUserId) {
      navigate('/login');
      return;
    }
    const text = commentDraft.trim();
    if (!text) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }
    if (commentSubmitting) return;
    setCommentSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('community_comments')
        .insert({ post_id: id, user_id: currentUserId, content: text })
        .select('id,post_id,user_id,content,created_at,likes_count,reports_count')
        .single();

      if (error || !data) {
        const message = (error as { message?: string } | null)?.message || '';
        if (message.includes('rate_limited_comment')) {
          alert('댓글은 5초에 1회만 가능합니다. 잠시 후 다시 시도해주세요.');
        } else {
          alert('댓글 등록에 실패했습니다.');
        }
        return;
      }

      const nextComment = {
        id: data.id,
        postId: data.post_id,
        author: data.user_id,
        content: data.content,
        createdAt: Date.parse(data.created_at),
        likes: data.likes_count ?? 0,
        reports: data.reports_count ?? 0,
      };

      setPost((prev) =>
        prev
          ? {
              ...prev,
              comments: [...prev.comments, nextComment],
              commentsCount: prev.commentsCount + 1,
            }
          : prev
      );
      setCommentDraft('');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeletePost = () => {
    if (!post) return;
    if (!currentUserId) return;
    const ok = window.confirm('이 글을 삭제하시겠습니까?');
    if (!ok) return;

    const run = async () => {
      const paths = post.imageUrls
        .map((url) => getStorageObjectPathFromPublicUrl(url))
        .filter((path): path is string => Boolean(path));

      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage
          .from('community-post-images')
          .remove(paths);
        if (removeError) {
          console.error('Failed to remove post images:', removeError);
        }
      }

      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', post.id);

      if (error) {
        alert('삭제에 실패했습니다.');
        return;
      }

      navigate('/community');
    };

    run();
  };

  const handleDeleteComment = (commentId: string) => {
    if (!post) return;
    if (!currentUserId) return;
    const ok = window.confirm('이 댓글을 삭제하시겠습니까?');
    if (!ok) return;
    supabase
      .from('community_comments')
      .delete()
      .eq('id', commentId)
      .then(({ error }) => {
        if (error) {
          alert('댓글 삭제에 실패했습니다.');
          return;
        }
        setPost((prev) =>
          prev
            ? {
                ...prev,
                comments: prev.comments.filter((comment) => comment.id !== commentId),
                commentsCount: Math.max(0, prev.commentsCount - 1),
              }
            : prev
        );
      });
  };

  const handleToggleCommentLike = (commentId: string) => {
    if (!post) return;
    if (!currentUserId) {
      navigate('/login');
      return;
    }

    const isLiked = likedCommentIds.has(commentId);

    const run = async () => {
      if (isLiked) {
        const { error } = await supabase
          .from('community_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId);

        if (error) {
          alert('공감 취소에 실패했습니다.');
          return;
        }
      } else {
        const { error } = await supabase.from('community_comment_likes').insert({
          comment_id: commentId,
          user_id: currentUserId,
        });

        if (error) {
          alert('공감에 실패했습니다.');
          return;
        }
      }

      setLikedCommentIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(commentId);
        else next.add(commentId);
        return next;
      });

      setPost((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map((comment) =>
                comment.id === commentId
                  ? { ...comment, likes: Math.max(0, comment.likes + (isLiked ? -1 : 1)) }
                  : comment
              ),
            }
          : prev
      );
    };

    run();
  };

  const handleReportComment = (commentId: string) => {
    if (!post) return;
    if (!currentUserId) {
      navigate('/login');
      return;
    }
    const ok = window.confirm('이 댓글을 신고하시겠습니까?');
    if (!ok) return;
    supabase
      .from('community_comment_reports')
      .insert({ comment_id: commentId, user_id: currentUserId })
      .then(({ error }) => {
        if (error) {
          alert('이미 신고한 댓글입니다.');
          return;
        }
        setPost((prev) =>
          prev
            ? {
                ...prev,
                comments: prev.comments.map((comment) =>
                  comment.id === commentId ? { ...comment, reports: comment.reports + 1 } : comment
                ),
              }
            : prev
        );
        alert('신고가 접수되었습니다.');
      });
  };

  const anonMap = useMemo(() => {
    if (!post) return new Map<string, number>();
    const map = new Map<string, number>();
    let counter = 1;

    const pushAuthor = (author: string) => {
      if (!map.has(author)) {
        map.set(author, counter);
        counter += 1;
      }
    };

    pushAuthor(post.author);
    const sortedComments = [...post.comments].sort((a, b) => a.createdAt - b.createdAt);
    sortedComments.forEach((comment) => pushAuthor(comment.author));

    return map;
  }, [post]);

  const getAnonLabel = (author: string) => {
    const id = anonMap.get(author) ?? 0;
    return `익명${id || 1}`;
  };

  const getAuthorLabel = (author: string, isPostAuthorLabel: boolean) => {
    if (author === post?.author && !isPostAuthorLabel) {
      return '글쓴이';
    }
    return isPostAuthorLabel ? '익명' : getAnonLabel(author);
  };

  const closeViewer = () => setViewerIndex(null);

  const moveViewer = (delta: number) => {
    if (!post || post.imageUrls.length === 0) return;

    setViewerIndex((prev) => {
      if (prev === null) return prev;
      return (prev + delta + post.imageUrls.length) % post.imageUrls.length;
    });
  };

  if (!post && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => navigate('/community')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              돌아가기
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center text-gray-600">
          존재하지 않는 글입니다.
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => navigate('/community')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              목록
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center text-gray-600">
          불러오는 중…
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => navigate('/community')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              돌아가기
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center text-gray-600">
          존재하지 않는 글입니다.
        </main>
      </div>
    );
  }

  const isLiked = likedIds.has(post.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/community')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            목록
          </button>
          <div className="text-sm text-gray-500">{post.tag}</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <section className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
                {post.tag}
              </span>
              <span>익명</span>
            </div>
            <div className="flex items-center gap-3">
              <span>{formatTimeAgoKorean(post.createdAt)}</span>
              {post.author === currentUserId && (
                <button
                  onClick={handleDeletePost}
                  className="inline-flex items-center gap-1 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  삭제
                </button>
              )}
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-bold text-gray-900 mt-3">{post.title}</h1>
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{post.content}</p>

          {post.imageUrls.length > 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                  <Images className="w-4 h-4" />
                  첨부 이미지 {post.imageUrls.length}장
                </span>
                <span>눌러서 크게 보기</span>
              </div>

              {post.imageUrls.length === 1 ? (
                <button
                  type="button"
                  onClick={() => setViewerIndex(0)}
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
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {post.imageUrls.map((url, index) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setViewerIndex(index)}
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

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-4">
            <button
              onClick={handleToggleLike}
              className={`inline-flex items-center gap-1 ${isLiked ? 'text-red-600' : 'text-gray-500'}`}
            >
              <Heart className="w-3.5 h-3.5" /> {post.likes}
            </button>
            <span className="inline-flex items-center gap-1 text-cyan-600">
              <MessageCircle className="w-3.5 h-3.5" /> {post.comments.length}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {post.views}
            </span>
            <button
              onClick={handleReport}
              className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
            >
              <Flag className="w-3.5 h-3.5" /> 신고 {post.reports}
            </button>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">댓글 {post.comments.length}</h2>
          </div>

          {post.comments.length === 0 ? (
            <div className="text-sm text-gray-500">첫 댓글을 남겨보세요.</div>
          ) : (
            <div className="space-y-3">
              {post.comments.map((comment) => {
                const isCommentLiked = likedCommentIds.has(comment.id);
                return (
                <div key={comment.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">
                      {getAuthorLabel(comment.author, false)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{formatTimeAgoKorean(comment.createdAt)}</span>
                      {comment.author === currentUserId && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="inline-flex items-center gap-1 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{comment.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <button
                      onClick={() => handleToggleCommentLike(comment.id)}
                      className={`inline-flex items-center gap-1 ${
                        isCommentLiked ? 'text-red-600' : 'text-gray-500'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5" /> {comment.likes}
                    </button>
                    <button
                      onClick={() => handleReportComment(comment.id)}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                    >
                      <Flag className="w-3.5 h-3.5" /> 신고 {comment.reports}
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
          )}

          <div className="space-y-2">
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              placeholder="댓글을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={commentSubmitting}
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddComment}
                disabled={commentSubmitting}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  commentSubmitting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                {commentSubmitting ? '등록 중…' : '댓글 등록'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {viewerIndex !== null && post.imageUrls[viewerIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeViewer}
        >
          <button
            type="button"
            onClick={closeViewer}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>

          {post.imageUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  moveViewer(-1);
                }}
                className="absolute left-3 sm:left-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  moveViewer(1);
                }}
                className="absolute right-3 sm:right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <img
            src={post.imageUrls[viewerIndex]}
            alt={`첨부 이미지 크게 보기 ${viewerIndex + 1}`}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg border border-white/20 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />

          <div className="absolute bottom-4 px-3 py-1.5 rounded-full bg-black/60 text-white text-sm">
            {viewerIndex + 1} / {post.imageUrls.length}
          </div>
        </div>
      )}
    </div>
  );
}
