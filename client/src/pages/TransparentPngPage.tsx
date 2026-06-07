import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Download,
  RotateCcw,
  ArrowLeft,
  ImageDown,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const CHECKER_BG =
  'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 20px 20px';

export function TransparentPngPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [tolerance, setTolerance] = useState(30);
  const [feather, setFeather] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImgUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setFile(f);
  }, []);

  // Decode image whenever imgUrl changes
  useEffect(() => {
    if (!imgUrl) {
      setImage(null);
      return;
    }
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError('Could not decode that image.');
    img.src = imgUrl;
  }, [imgUrl]);

  // Process pixels whenever image / tolerance / feather change
  useEffect(() => {
    if (!image) return;
    const src = sourceCanvasRef.current;
    const dst = resultCanvasRef.current;
    if (!src || !dst) return;

    setProcessing(true);
    // Use rAF so the UI can show the processing state before a heavy decode
    const handle = requestAnimationFrame(() => {
      try {
        src.width = image.naturalWidth;
        src.height = image.naturalHeight;
        dst.width = image.naturalWidth;
        dst.height = image.naturalHeight;

        const sctx = src.getContext('2d');
        const dctx = dst.getContext('2d');
        if (!sctx || !dctx) {
          setError('Canvas is not supported in this browser.');
          setProcessing(false);
          return;
        }

        sctx.clearRect(0, 0, src.width, src.height);
        sctx.drawImage(image, 0, 0);

        const imageData = sctx.getImageData(0, 0, src.width, src.height);
        const data = imageData.data;
        const tol = tolerance;
        const featherRange = feather ? 20 : 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Distance from white = how far the darkest channel is from 255
          const dist = 255 - Math.min(r, g, b);
          if (dist <= tol) {
            data[i + 3] = 0;
          } else if (featherRange > 0 && dist <= tol + featherRange) {
            const t = (dist - tol) / featherRange; // 0..1
            data[i + 3] = Math.round(data[i + 3] * t);
          }
        }

        dctx.putImageData(imageData, 0, 0);

        dst.toBlob((blob) => {
          if (!blob) {
            setError('Failed to encode PNG.');
            setProcessing(false);
            return;
          }
          setResultUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
          setProcessing(false);
        }, 'image/png');
      } catch (e) {
        console.error(e);
        setError('Something went wrong while processing the image.');
        setProcessing(false);
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [image, tolerance, feather]);

  const downloadName = useMemo(() => {
    if (!file) return 'image-transparent.png';
    const base = file.name.replace(/\.[^.]+$/, '');
    return `${base}-transparent.png`;
  }, [file]);

  const handleReset = () => {
    setFile(null);
    setImage(null);
    setError(null);
    setImgUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 px-3 py-1 text-gray-600 hover:text-amber-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-xl sm:text-3xl font-bold text-amber-800 flex items-center gap-2 whitespace-nowrap">
            <ImageDown className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            Transparent PNG
          </h1>
          <div className="w-12 sm:w-16" />
        </div>

        {!file && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`block bg-white rounded-2xl shadow-lg p-10 text-center cursor-pointer border-2 border-dashed transition-colors ${
              isDragging
                ? 'border-amber-500 bg-amber-50'
                : 'border-amber-200 hover:border-amber-400'
            }`}
          >
            <Upload className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700 mb-1">
              Drop an image here, or click to choose
            </p>
            <p className="text-sm text-gray-500">
              We'll remove the white background and give you a transparent PNG.
            </p>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
              }}
            />
          </label>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-700 rounded-lg p-3">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {file && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Preview title="Original" url={imgUrl} />
                <Preview
                  title="Transparent"
                  url={resultUrl}
                  loading={processing}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    White tolerance
                  </label>
                  <span className="text-sm text-gray-500 tabular-nums">
                    {tolerance}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher = more off-white pixels become transparent.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feather}
                  onChange={(e) => setFeather(e.target.checked)}
                  className="accent-amber-500"
                />
                Feather edges (softer transitions)
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={resultUrl ?? '#'}
                download={downloadName}
                onClick={(e) => {
                  if (!resultUrl) e.preventDefault();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                  resultUrl
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                Download PNG
              </a>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Try another image
              </button>
            </div>
          </div>
        )}

        {/* Hidden working canvases */}
        <canvas ref={sourceCanvasRef} className="hidden" />
        <canvas ref={resultCanvasRef} className="hidden" />
      </div>
    </div>
  );
}

function Preview({
  title,
  url,
  loading = false,
}: {
  title: string;
  url: string | null;
  loading?: boolean;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      <div
        className="relative rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center min-h-[200px]"
        style={{ background: CHECKER_BG }}
      >
        {url ? (
          <img
            src={url}
            alt={title}
            className="max-w-full max-h-[400px] object-contain"
          />
        ) : (
          <div className="text-gray-400 text-sm p-6">No image yet</div>
        )}
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
