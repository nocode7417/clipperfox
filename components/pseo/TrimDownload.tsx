import type { KeywordRow } from "@/lib/getKeywords";
import PseoLayout from "./PseoLayout";
import ClipTool from "@/components/ClipTool";

const ICONS = ["lucide:scissors", "lucide:download", "lucide:zap"];

export default function TrimDownload({ data }: { data: KeywordRow }) {
  return (
    <PseoLayout data={data}>
      <section className="pseo-hero">
        <h1 className="pseo-h1">{data.h1}</h1>
        <p className="pseo-intro">{data.pageIntro}</p>
        <div className="pseo-tool-embed">
          <ClipTool defaultAction={data.primaryAction || "trim"} />
        </div>
      </section>

      <div className="pseo-divider" />

      <section className="pseo-faq-section">
        <p className="pseo-section-label">Why ClipperFox</p>
        <h2 className="pseo-section-title">Trim smarter, download faster</h2>
        <div className="pseo-features" style={{ marginTop: 40 }}>
          {data.featureBullets.slice(0, 3).map((bullet, i) => (
            <div key={i} className="pseo-feature-card">
              <div className="pseo-feature-icon">
                <iconify-icon icon={ICONS[i] || ICONS[0]} style={{ fontSize: "20px" }} />
              </div>
              <p className="pseo-feature-text">{bullet}</p>
            </div>
          ))}
        </div>
      </section>
    </PseoLayout>
  );
}
