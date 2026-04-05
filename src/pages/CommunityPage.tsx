import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, Tag, Send, Heart, Eye, MessageCircle, ImagePlus, X } from 'lucide-react';
import { supabase, useAuth } from '../contexts/AuthContext';
import type { CommunityPost, CommunityTag } from '../types/community';
import { COMMUNITY_TAGS } from '../types/community';
import { formatTimeAgoKorean } from '../utils/timeAgo';
import { compressImageFile } from '../utils/imageCompression';

const MAX_POST_IMAGES = 5;
const MAX_INPUT_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function CommunityPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [tagFilter, setTagFilter] = useState<'all' | CommunityTag>('all');
  const [myFilter, setMyFilter] = useState<'all' | 'posts' | 'comments'>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [newTag, setNewTag] = useState<CommunityTag>(COMMUNITY_TAGS[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const imagePreviewUrls = useMemo(
    () => images.map((file) => URL.createObjectURL(file)),
    [images]
  );

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('community_posts')
        .select(
          'id,user_id,tag,title,content,image_urls,created_at,likes_count,views_count,reports_count,comments_count,community_comments(id,user_id,content,created_at,likes_count,reports_count)'
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load community posts:', error);
        setPosts([]);
        return;
      }

      const mapped = (data || []).map((row) => {
        const comments = (row.community_comments || []).map((comment) => ({
          id: comment.id,
          postId: row.id,
          author: comment.user_id,
          content: comment.content,
          createdAt: Date.parse(comment.created_at),
          likes: comment.likes_count ?? 0,
          reports: comment.reports_count ?? 0,
        }));

        return {
          id: row.id,
          tag: row.tag as CommunityTag,
          title: row.title,
          content: row.content,
          imageUrls: row.image_urls ?? [],
          author: row.user_id,
          createdAt: Date.parse(row.created_at),
          comments,
          commentsCount: row.comments_count ?? comments.length,
          likes: row.likes_count ?? 0,
          views: row.views_count ?? 0,
          reports: row.reports_count ?? 0,
        } as CommunityPost;
      });

      setPosts(mapped);
    };

    fetchPosts();
  }, []);

  useEffect(() => {
    const fetchLiked = async () => {
      if (!currentUser) {
        setLikedIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from('community_post_likes')
        .select('post_id')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Failed to load post likes:', error);
        setLikedIds(new Set());
        return;
      }

      setLikedIds(new Set((data || []).map((row) => row.post_id)));
    };

    fetchLiked();
  }, [currentUser]);

  const currentUserId = currentUser?.id || '';

  const filteredPosts = useMemo(() => {
    const baseByTag = tagFilter === 'all' ? posts : posts.filter((post) => post.tag === tagFilter);
    let base = baseByTag;

    if (myFilter === 'posts') {
      base = currentUserId ? base.filter((post) => post.author === currentUserId) : [];
    } else if (myFilter === 'comments') {
      base = currentUserId
        ? base.filter((post) => post.comments.some((comment) => comment.author === currentUserId))
        : [];
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      base = base.filter((post) => {
        const haystack = `${post.title} ${post.content}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    return [...base].sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, tagFilter, myFilter, currentUserId, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [tagFilter, myFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paginatedPosts = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, pageSafe]);

  const handleCreatePost = async () => {
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    if (!currentUserId) {
      navigate('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUserId,
          tag: newTag,
          title: trimmedTitle,
          content: trimmedContent,
          image_urls: [],
        })
        .select('id,user_id,tag,title,content,image_urls,created_at,likes_count,views_count,reports_count,comments_count')
        .single();

      if (error || !data) {
        console.error('Failed to create post:', error);
        const message = (error as { message?: string } | null)?.message || '';
        if (message.includes('rate_limited_post')) {
          alert('글 작성은 1분에 1회만 가능합니다. 잠시 후 다시 시도해주세요.');
        } else {
          alert('글 작성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
        return;
      }

      const uploadedImageUrls: string[] = [];
      let failedUploads = 0;

      if (images.length > 0) {
        for (const image of images) {
          let uploadFile = image;

          try {
            uploadFile = await compressImageFile(image, {
              maxBytes: MAX_IMAGE_SIZE_BYTES,
              maxDimension: 2400,
              minDimension: 720,
            });
          } catch (compressionError) {
            console.error('Failed to compress image:', compressionError);
            failedUploads += 1;
            continue;
          }

          const safeFileName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const objectPath = `${currentUserId}/${data.id}/${crypto.randomUUID()}-${safeFileName}`;

          const { error: uploadError } = await supabase.storage
            .from('community-post-images')
            .upload(objectPath, uploadFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: uploadFile.type,
            });

          if (uploadError) {
            failedUploads += 1;
            continue;
          }

          const { data: publicUrlData } = supabase.storage
            .from('community-post-images')
            .getPublicUrl(objectPath);

          if (publicUrlData.publicUrl) {
            uploadedImageUrls.push(publicUrlData.publicUrl);
          }
        }

        if (uploadedImageUrls.length > 0) {
          const { error: updateImageError } = await supabase
            .from('community_posts')
            .update({ image_urls: uploadedImageUrls })
            .eq('id', data.id);

          if (updateImageError) {
            console.error('Failed to update post images:', updateImageError);
            alert('이미지 저장에 실패했습니다. 텍스트 글만 등록되었습니다.');
          }
        }

        if (failedUploads > 0) {
          alert(`${failedUploads}개 이미지 업로드에 실패했습니다.`);
        }
      }

      const nextPost: CommunityPost = {
        id: data.id,
        tag: data.tag as CommunityTag,
        title: data.title,
        content: data.content,
        imageUrls: uploadedImageUrls,
        author: data.user_id,
        createdAt: Date.parse(data.created_at),
        comments: [],
        commentsCount: data.comments_count ?? 0,
        likes: data.likes_count ?? 0,
        views: data.views_count ?? 0,
        reports: data.reports_count ?? 0,
      };

      setPosts((prev) => [nextPost, ...prev]);
      setTitle('');
      setContent('');
      setImages([]);
      setIsWriteOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';

    if (incoming.length === 0) return;

    const valid = incoming.filter((file) => {
      if (!file.type.startsWith('image/')) return false;
      if (file.size > MAX_INPUT_IMAGE_SIZE_BYTES) return false;
      return true;
    });

    if (valid.length !== incoming.length) {
      alert('이미지 파일만 업로드할 수 있으며, 원본 파일당 최대 20MB까지 선택할 수 있습니다. 업로드 시 자동 압축됩니다.');
    }

    setImages((prev) => {
      const merged = [...prev, ...valid].slice(0, MAX_POST_IMAGES);
      if (prev.length + valid.length > MAX_POST_IMAGES) {
        alert(`이미지는 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);
      }
      return merged;
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUserId) {
      navigate('/login');
      return;
    }

    const isLiked = likedIds.has(postId);
    if (isLiked) {
      const { error } = await supabase
        .from('community_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Failed to unlike post:', error);
        alert('추천 취소에 실패했습니다.');
        return;
      }
    } else {
      const { error } = await supabase.from('community_post_likes').insert({
        post_id: postId,
        user_id: currentUserId,
      });

      if (error) {
        console.error('Failed to like post:', error);
        alert('추천에 실패했습니다.');
        return;
      }
    }

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, likes: Math.max(0, post.likes + (isLiked ? -1 : 1)) }
          : post
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <MessagesSquare className="w-6 h-6" />
                  커뮤니티 게시판
                </h1>
                <p className="text-sm text-gray-600 mt-1">태그별로 글을 보고 댓글을 남겨보세요.</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isWriteOpen && (
          <section className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">새 글 작성</h2>
              <p className="text-sm text-gray-600">필수 항목을 입력하고 등록하세요.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-sm font-semibold text-gray-700">태그</label>
                  <select
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value as CommunityTag)}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {COMMUNITY_TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">제목</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="제목을 입력하세요"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="게시글 내용을 입력하세요"
                  rows={6}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">이미지 첨부 (선택)</label>
                  <span className="text-xs text-gray-500">최대 {MAX_POST_IMAGES}장, 원본 20MB 이하, 업로드 시 5MB 이하로 자동 압축</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    이미지 추가
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-gray-500">{images.length} / {MAX_POST_IMAGES}</span>
                </div>

                {images.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={url} className="relative group border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <img src={url} alt={`첨부 이미지 ${index + 1}`} className="w-full h-24 object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-90 hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  태그는 필수입니다.
                </span>
                <button
                  onClick={handleCreatePost}
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    isSubmitting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">게시글 목록</h2>
              <button
                onClick={() => setIsWriteOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                <Send className="w-4 h-4" />
                {isWriteOpen ? '작성 닫기' : '새 글 작성'}
              </button>
            </div>
            <div className="w-full sm:w-80">
              <div className="flex gap-2">
                <input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setSearchQuery(searchDraft);
                    }
                  }}
                  placeholder="제목/내용/작성자 검색"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <button
                  onClick={() => setSearchQuery(searchDraft)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                >
                  검색
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTagFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  tagFilter === 'all'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                전체
              </button>
              {COMMUNITY_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    tagFilter === tag
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMyFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  myFilter === 'all'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setMyFilter('posts')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  myFilter === 'posts'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                나의 글
              </button>
              <button
                onClick={() => setMyFilter('comments')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  myFilter === 'comments'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                나의 댓글
              </button>
            </div>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
              아직 작성된 글이 없습니다. 첫 글을 작성해보세요.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y">
              {paginatedPosts.map((post) => {
                const isLiked = likedIds.has(post.id);
                return (
                  <article key={post.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/community/${post.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') navigate(`/community/${post.id}`);
                      }}
                      className="px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-blue-600">{post.tag}</div>
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mt-1">{post.title}</h3>
                          <p
                            className="text-sm text-gray-600 mt-1"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {post.content}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLike(post.id);
                              }}
                              className={`inline-flex items-center gap-1 ${
                                isLiked ? 'text-red-600' : 'text-gray-500'
                              }`}
                            >
                              <Heart className="w-3.5 h-3.5" />
                              {post.likes}
                            </button>
                            <span className="inline-flex items-center gap-1 text-cyan-600">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {post.commentsCount}
                            </span>
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <Eye className="w-3.5 h-3.5" />
                              {post.views}
                            </span>
                            <span>{formatTimeAgoKorean(post.createdAt)} · 익명</span>
                          </div>
                        </div>
                        {post.imageUrls.length > 0 && (
                          <div className="flex-shrink-0" style={{ paddingTop: 4 }}>
                            <div
                              className="relative rounded-md overflow-hidden border border-gray-200 bg-white"
                              style={{ width: 96, height: 72 }}
                            >
                              <img
                                src={post.imageUrls[0]}
                                alt="첨부 이미지 미리보기"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                                style={{ display: 'block' }}
                              />
                              {post.imageUrls.length > 1 && (
                                <div
                                  className="absolute rounded text-white font-semibold"
                                  style={{
                                    right: 4,
                                    bottom: 4,
                                    padding: '1px 5px',
                                    fontSize: 10,
                                    lineHeight: 1.2,
                                    backgroundColor: 'rgba(0, 0, 0, 0.68)',
                                  }}
                                >
                                  +{post.imageUrls.length - 1}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {filteredPosts.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <div className="text-xs text-gray-500">
                총 {filteredPosts.length}개 · {pageSafe}/{totalPages} 페이지
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={pageSafe === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                    pageSafe === 1
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  이전
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={pageSafe === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                    pageSafe === totalPages
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
