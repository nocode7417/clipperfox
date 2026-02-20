import type { KeywordRow } from "@/lib/getKeywords";

interface PseoLayoutProps {
  data: KeywordRow;
  children: React.ReactNode;
}

export default function PseoLayout({ data, children }: PseoLayoutProps) {
  return (
    <>
      <style>{`
        .pseo-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        /* ── Navbar ── */
        .pseo-navbar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 24px 0;
        }
        .pseo-navbar .pseo-nav-links { justify-self: center; }

        .pseo-logo {
          display: flex;
          align-items: center;
          gap: 9px;
          user-select: none;
          text-decoration: none;
          color: #ffffff;
        }
        .pseo-logo-mark {
          width: 32px;
          height: 32px;
          border-radius: 17px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pseo-logo-mark img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        .pseo-logo-wordmark {
          font-weight: 600;
          font-size: 16px;
          line-height: 1;
          color: #ffffff;
          letter-spacing: 0.02em;
        }
        .pseo-nav-links {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        .pseo-nav-item {
          color: #a1a1aa;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
          font-weight: 500;
          letter-spacing: 0.01em;
          transition: color 0.15s ease;
        }
        .pseo-nav-item:hover { color: #ffffff; }

        /* ── Hero ── */
        .pseo-hero {
          padding: 80px 0 64px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .pseo-h1 {
          font-size: clamp(32px, 6vw, 56px);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin: 0 0 20px 0;
          color: #ffffff;
          max-width: 800px;
        }
        .pseo-intro {
          font-size: 17px;
          line-height: 1.7;
          color: #71717a;
          max-width: 600px;
          margin: 0 0 48px 0;
          font-weight: 400;
        }

        /* ── Feature Cards ── */
        .pseo-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
        }
        .pseo-feature-card {
          background: #161616;
          border: 1px solid #1f1f1f;
          border-radius: 10px;
          padding: 24px;
          text-align: left;
        }
        .pseo-feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(225, 85, 53, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          color: #e15535;
        }
        .pseo-feature-text {
          font-size: 14px;
          line-height: 1.6;
          color: #a1a1aa;
          margin: 0;
        }

        /* ── Tool Embed ── */
        .pseo-tool-embed {
          width: 100%;
          max-width: 600px;
          display: flex;
          justify-content: center;
          margin-top: 32px;
        }
        .pseo-tool-bottom {
          display: flex;
          justify-content: center;
          padding: 48px 0;
        }

        /* ── Tutorial ── */
        .pseo-tutorial {
          padding: 80px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .pseo-tutorial-wrap {
          width: 100%;
          max-width: 860px;
          margin-top: 48px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
          background: #0e0e0e;
        }
        .pseo-tutorial-wrap video {
          width: 100%;
          display: block;
          border-radius: 0;
          outline: none;
        }
        @media (max-width: 1024px) {
          .pseo-tutorial { padding: 60px 0; }
        }
        @media (max-width: 768px) {
          .pseo-tutorial { padding: 48px 0; }
          .pseo-tutorial-wrap { border-radius: 10px; }
        }

        /* ── Divider ── */
        .pseo-divider {
          width: 100%;
          height: 1px;
          background: #1f1f1f;
          margin: 0;
        }

        /* ── FAQ ── */
        .pseo-faq-section {
          padding: 80px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .pseo-section-label {
          font-size: 11px;
          font-weight: 600;
          color: #e15535;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .pseo-section-title {
          font-size: clamp(24px, 5vw, 36px);
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin: 0 0 12px 0;
          line-height: 1.1;
        }
        .pseo-faq-list {
          width: 100%;
          max-width: 640px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 40px;
          text-align: left;
        }
        .pseo-faq-item {
          background: #161616;
          border: 1px solid #1f1f1f;
          border-radius: 10px;
        }
        .pseo-faq-item[open] { border-color: #2a2a2a; }
        .pseo-faq-summary {
          padding: 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          list-style: none;
          font-size: 14px;
          font-weight: 500;
          color: #e4e4e7;
        }
        .pseo-faq-summary::-webkit-details-marker { display: none; }
        .pseo-faq-icon {
          transition: transform 150ms ease;
          flex-shrink: 0;
          color: #52525b;
          display: flex;
        }
        .pseo-faq-item[open] .pseo-faq-icon { transform: rotate(45deg); }
        .pseo-faq-answer {
          padding: 0 20px 18px;
          font-size: 13px;
          color: #52525b;
          line-height: 1.65;
          margin: 0;
        }

        /* ── Footer ── */
        .pseo-footer {
          padding: 72px 0 56px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-top: 1px solid #1a1a1a;
        }
        .pseo-footer-logo {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .pseo-footer-logo-mark {
          width: 20px;
          height: 20px;
          border-radius: 9px;
          overflow: hidden;
          opacity: 0.5;
          flex-shrink: 0;
        }
        .pseo-footer-logo-mark img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pseo-footer-logo-text {
          font-size: 13px;
          font-weight: 600;
          color: #52525b;
          letter-spacing: 0.06em;
        }
        .pseo-footer-sep {
          font-size: 12px;
          color: #2a2a2a;
          user-select: none;
        }
        .pseo-footer-text {
          font-size: 12px;
          color: #3f3f46;
          font-weight: 400;
        }

        /* ── Tablet ── */
        @media (max-width: 1024px) {
          .pseo-hero { padding: 60px 0 48px; }
          .pseo-faq-section { padding: 60px 0; }
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .pseo-container { padding: 0 16px; }
          .pseo-navbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            gap: 12px;
          }
          .pseo-navbar .pseo-nav-links {
            justify-self: auto;
            gap: 16px;
            flex-shrink: 0;
          }
          .pseo-nav-item { font-size: 13px; padding: 6px 0; }
          .pseo-logo-mark { width: 28px; height: 28px; }
          .pseo-logo-wordmark { font-size: 15px; }
          .pseo-hero { padding: 40px 0 32px; }
          .pseo-intro { font-size: 15px; line-height: 1.6; }
          .pseo-features {
            grid-template-columns: 1fr;
            max-width: 100%;
          }
          .pseo-tool-bottom { padding: 32px 0; }
          .pseo-faq-section { padding: 48px 0; }
          .pseo-faq-summary { padding: 16px; }
          .pseo-faq-answer { padding: 0 16px 16px; }
          .pseo-footer { padding: 40px 0 32px 0; }
        }
      `}</style>

      <div className="pseo-container">
        {/* Navbar */}
        <nav className="pseo-navbar">
          <a href="/" className="pseo-logo">
            <div className="pseo-logo-mark">
              <img src="/images/favicon.png" alt="Clipperfox" draggable={false} />
            </div>
            <span className="pseo-logo-wordmark">clipperfox</span>
          </a>
          <div className="pseo-nav-links">
            <a href="/#how-to-use" className="pseo-nav-item">How to Use</a>
            <a href="/#faq" className="pseo-nav-item">FAQ</a>
          </div>
        </nav>

        {/* Template content */}
        {children}

        {/* FAQ */}
        {data.faq.length > 0 && (
          <>
            <div className="pseo-divider" />
            <section className="pseo-faq-section">
              <p className="pseo-section-label">FAQ</p>
              <h2 className="pseo-section-title">Common questions</h2>
              <div className="pseo-faq-list">
                {data.faq.map((item, i) => (
                  <details key={i} className="pseo-faq-item">
                    <summary className="pseo-faq-summary">
                      {item.question}
                      <iconify-icon icon="lucide:plus" className="pseo-faq-icon" style={{ fontSize: "16px" }} />
                    </summary>
                    <p className="pseo-faq-answer">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Footer */}
        <footer className="pseo-footer">
          <span className="pseo-footer-logo">
            <span className="pseo-footer-logo-mark">
              <img src="/images/favicon.png" alt="" draggable={false} />
            </span>
            <span className="pseo-footer-logo-text">clipperfox</span>
          </span>
          <span className="pseo-footer-sep">&middot;</span>
          <span className="pseo-footer-text">Free forever</span>
        </footer>
      </div>
    </>
  );
}
