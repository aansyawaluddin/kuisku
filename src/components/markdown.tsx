import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-content text-[15px] text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

/** Ubah URL YouTube biasa jadi embed. */
export function VideoEmbed({ url }: { url: string }) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (m) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl bg-black">
        <iframe
          className="size-full"
          src={`https://www.youtube.com/embed/${m[1]}`}
          title="Video materi"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600 underline">
      Buka video materi ↗
    </a>
  );
}
