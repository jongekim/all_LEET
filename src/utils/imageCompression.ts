interface CompressImageOptions {
  maxBytes: number;
  maxDimension?: number;
  minDimension?: number;
  initialQuality?: number;
  minQuality?: number;
  qualityStep?: number;
  maxAttempts?: number;
}

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxBytes: 5 * 1024 * 1024,
  maxDimension: 2400,
  minDimension: 720,
  initialQuality: 0.9,
  minQuality: 0.45,
  qualityStep: 0.08,
  maxAttempts: 10,
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };

    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 압축에 실패했습니다.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });

const toJpgFileName = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  return `${base}.jpg`;
};

export const compressImageFile = async (file: File, options: CompressImageOptions): Promise<File> => {
  const {
    maxBytes,
    maxDimension,
    minDimension,
    initialQuality,
    minQuality,
    qualityStep,
    maxAttempts,
  } = { ...DEFAULT_OPTIONS, ...options };

  if (file.type === 'image/gif') {
    if (file.size <= maxBytes) {
      return file;
    }
    throw new Error('GIF 파일은 5MB 이하만 업로드할 수 있습니다.');
  }

  if (file.size <= maxBytes && file.type === 'image/jpeg') {
    return file;
  }

  const image = await loadImage(file);
  const originWidth = image.naturalWidth;
  const originHeight = image.naturalHeight;

  const scale = Math.min(1, maxDimension / Math.max(originWidth, originHeight));
  let width = Math.max(1, Math.floor(originWidth * scale));
  let height = Math.max(1, Math.floor(originHeight * scale));

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('브라우저가 이미지 압축을 지원하지 않습니다.');
  }

  let bestBlob: Blob | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (let quality = initialQuality; quality >= minQuality; quality -= qualityStep) {
      const blob = await canvasToBlob(canvas, quality);

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }

      if (blob.size <= maxBytes) {
        return new File([blob], toJpgFileName(file.name), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }
    }

    const nextWidth = Math.floor(width * 0.85);
    const nextHeight = Math.floor(height * 0.85);
    if (nextWidth < minDimension && nextHeight < minDimension) {
      break;
    }

    width = Math.max(minDimension, nextWidth);
    height = Math.max(minDimension, nextHeight);
    attempts += 1;
  }

  if (bestBlob && bestBlob.size <= maxBytes) {
    return new File([bestBlob], toJpgFileName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  }

  throw new Error('압축 후에도 5MB를 초과합니다. 더 작은 이미지를 선택해주세요.');
};
