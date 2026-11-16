import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { SEED_POSTS, WORKSPACE_ID } from '../data/mockPosts';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ContentPost, PostComment, PostStatus } from '../types/calendar';

const CLIENT_ID_STORAGE_KEY = 'podcasa_client_session_id';
const CLIENT_NAME_STORAGE_KEY = 'podcasa_client_display_name';

export function getOrCreateClientSessionId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,64}$/.test(existing)) {
      return existing;
    }
    const created = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `client_${Date.now()}`;
  }
}

export function getSavedClientName(): string {
  try {
    return localStorage.getItem(CLIENT_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveClientName(name: string): void {
  try {
    localStorage.setItem(CLIENT_NAME_STORAGE_KEY, name.trim().slice(0, 120));
  } catch {
    // ignore storage errors
  }
}

function sanitizePostPayload(post: ContentPost, actorId: string) {
  return {
    id: post.id.slice(0, 64),
    workspaceId: WORKSPACE_ID,
    day: Math.max(1, Math.min(31, Math.round(post.day))),
    weekNumber: Math.max(1, Math.min(5, Math.round(post.weekNumber))),
    title: (post.title.trim() || `Новий пост (${post.day} листопада)`).slice(0, 160),
    category: post.category,
    format: post.format,
    status: post.status,
    durationOrSlides: (post.durationOrSlides || '0:30').slice(0, 40),
    publishTime: (post.publishTime || '18:00').slice(0, 16),
    caption: (post.caption || '').slice(0, 4000),
    script: (post.script || '').slice(0, 8000),
    referenceNote: (post.referenceNote || '').slice(0, 2000),
    referenceUrl: (post.referenceUrl || '').slice(0, 1500),
    videoUrl: (post.videoUrl || '').slice(0, 1500),
    coverImage: (post.coverImage || '').slice(0, 1500),
    authorId: post.authorId || actorId,
  };
}

const CURRENT_SEED_VERSION = 2;

export async function initializeWorkspaceAndSeed(): Promise<void> {
  const actorId = getOrCreateClientSessionId();
  const workspacePath = `workspaces/${WORKSPACE_ID}`;
  const workspaceRef = doc(db, 'workspaces', WORKSPACE_ID);

  let workspaceSnap;
  try {
    workspaceSnap = await getDoc(workspaceRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, workspacePath);
  }

  if (!workspaceSnap.exists()) {
    try {
      await setDoc(workspaceRef, {
        id: WORKSPACE_ID,
        name: 'Podcasa Content Calendar',
        monthLabel: 'November 2026',
        seeded: false,
        seedVersion: CURRENT_SEED_VERSION,
        ownerId: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, workspacePath);
    }
  }

  let freshWorkspaceSnap;
  try {
    freshWorkspaceSnap = await getDoc(workspaceRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, workspacePath);
  }

  const workspaceData = freshWorkspaceSnap.exists()
    ? freshWorkspaceSnap.data()
    : undefined;
  const isSeeded = workspaceData?.seeded === true;
  const currentSeedVersion = Number(workspaceData?.seedVersion ?? 1);

  if (!isSeeded) {
    const postsCollectionRef = collection(
      db,
      'workspaces',
      WORKSPACE_ID,
      'posts'
    );
    const postsQuery = query(
      postsCollectionRef,
      where('workspaceId', '==', WORKSPACE_ID)
    );
    let existingPostsSnap;
    try {
      existingPostsSnap = await getDocs(postsQuery);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        `workspaces/${WORKSPACE_ID}/posts`
      );
    }

    if (existingPostsSnap.empty) {
      const batch = writeBatch(db);
      for (const seed of SEED_POSTS) {
        const postDocRef = doc(db, 'workspaces', WORKSPACE_ID, 'posts', seed.id);
        batch.set(postDocRef, {
          ...sanitizePostPayload(
            {
              ...seed,
              status: PostStatus.PendingApproval,
              workspaceId: WORKSPACE_ID,
              authorId: actorId,
            },
            actorId
          ),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.update(workspaceRef, {
        seeded: true,
        seedVersion: CURRENT_SEED_VERSION,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `workspaces/${WORKSPACE_ID}/posts`
        );
      }
    } else {
      const batch = writeBatch(db);
      for (const docSnap of existingPostsSnap.docs) {
        if (docSnap.data()?.status !== PostStatus.PendingApproval) {
          batch.update(docSnap.ref, {
            status: PostStatus.PendingApproval,
            updatedAt: serverTimestamp(),
          });
        }
      }
      batch.update(workspaceRef, {
        seeded: true,
        seedVersion: CURRENT_SEED_VERSION,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `workspaces/${WORKSPACE_ID}/posts`
        );
      }
    }
  } else if (currentSeedVersion < CURRENT_SEED_VERSION) {
    const postsCollectionRef = collection(
      db,
      'workspaces',
      WORKSPACE_ID,
      'posts'
    );
    const postsQuery = query(
      postsCollectionRef,
      where('workspaceId', '==', WORKSPACE_ID)
    );
    let existingPostsSnap;
    try {
      existingPostsSnap = await getDocs(postsQuery);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        `workspaces/${WORKSPACE_ID}/posts`
      );
    }

    const batch = writeBatch(db);
    for (const docSnap of existingPostsSnap.docs) {
      if (docSnap.data()?.status !== PostStatus.PendingApproval) {
        batch.update(docSnap.ref, {
          status: PostStatus.PendingApproval,
          updatedAt: serverTimestamp(),
        });
      }
    }
    batch.update(workspaceRef, {
      seedVersion: CURRENT_SEED_VERSION,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `workspaces/${WORKSPACE_ID}/posts`
      );
    }
  }
}

export function subscribeToPosts(
  onPosts: (posts: ContentPost[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = `workspaces/${WORKSPACE_ID}/posts`;
  const q = query(
    collection(db, 'workspaces', WORKSPACE_ID, 'posts'),
    where('workspaceId', '==', WORKSPACE_ID)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ContentPost[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as ContentPost;
        return {
          ...data,
          id: docSnap.id,
        };
      });
      items.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
      onPosts(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToComments(
  postId: string,
  onComments: (comments: PostComment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = `workspaces/${WORKSPACE_ID}/posts/${postId}/comments`;
  const q = query(
    collection(db, 'workspaces', WORKSPACE_ID, 'posts', postId, 'comments'),
    where('workspaceId', '==', WORKSPACE_ID)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: PostComment[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtField = data.createdAt;
        let createdAtMs = Date.now();
        if (createdAtField instanceof Timestamp) {
          createdAtMs = createdAtField.toMillis();
        } else if (
          createdAtField &&
          typeof createdAtField === 'object' &&
          'toMillis' in createdAtField &&
          typeof createdAtField.toMillis === 'function'
        ) {
          createdAtMs = createdAtField.toMillis();
        }

        return {
          id: docSnap.id,
          workspaceId: String(data.workspaceId ?? WORKSPACE_ID),
          postId: String(data.postId ?? postId),
          authorId: String(data.authorId ?? ''),
          authorName: String(data.authorName ?? 'Client'),
          authorPhotoUrl: String(data.authorPhotoUrl ?? ''),
          text: String(data.text ?? ''),
          createdAtMs,
        };
      });
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onComments(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function updatePostStatus(
  postId: string,
  status: PostStatus
): Promise<void> {
  const path = `workspaces/${WORKSPACE_ID}/posts/${postId}`;
  const postRef = doc(db, 'workspaces', WORKSPACE_ID, 'posts', postId);
  try {
    await updateDoc(postRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePostVideoUrl(
  postId: string,
  videoUrl: string
): Promise<void> {
  const path = `workspaces/${WORKSPACE_ID}/posts/${postId}`;
  const postRef = doc(db, 'workspaces', WORKSPACE_ID, 'posts', postId);
  try {
    await updateDoc(postRef, {
      videoUrl: videoUrl.slice(0, 1500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function savePostToFirestore(
  post: ContentPost,
  isNew: boolean
): Promise<void> {
  const actorId = getOrCreateClientSessionId();
  const path = `workspaces/${WORKSPACE_ID}/posts/${post.id}`;
  const postRef = doc(db, 'workspaces', WORKSPACE_ID, 'posts', post.id);
  const sanitized = sanitizePostPayload(post, actorId);

  if (isNew) {
    try {
      await setDoc(postRef, {
        ...sanitized,
        authorId: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(postRef, {
        day: sanitized.day,
        weekNumber: sanitized.weekNumber,
        title: sanitized.title,
        category: sanitized.category,
        format: sanitized.format,
        status: sanitized.status,
        durationOrSlides: sanitized.durationOrSlides,
        publishTime: sanitized.publishTime,
        caption: sanitized.caption,
        script: sanitized.script,
        referenceNote: sanitized.referenceNote,
        referenceUrl: sanitized.referenceUrl,
        videoUrl: sanitized.videoUrl,
        coverImage: sanitized.coverImage,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function deletePostFromFirestore(postId: string): Promise<void> {
  const path = `workspaces/${WORKSPACE_ID}/posts/${postId}`;
  const postRef = doc(db, 'workspaces', WORKSPACE_ID, 'posts', postId);
  try {
    await deleteDoc(postRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addPostComment(
  postId: string,
  text: string,
  authorNameInput: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const actorId = getOrCreateClientSessionId();
  const finalAuthorName = (authorNameInput.trim() || 'Client').slice(0, 120);
  saveClientName(finalAuthorName);

  const commentId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `workspaces/${WORKSPACE_ID}/posts/${postId}/comments/${commentId}`;
  const commentRef = doc(
    db,
    'workspaces',
    WORKSPACE_ID,
    'posts',
    postId,
    'comments',
    commentId
  );

  try {
    await setDoc(commentRef, {
      id: commentId,
      workspaceId: WORKSPACE_ID,
      postId,
      authorId: actorId,
      authorName: finalAuthorName,
      authorPhotoUrl: '',
      text: trimmed.slice(0, 2000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
