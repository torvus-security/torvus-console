// Overview landing page – simple "in production" notice
// Renders with inline styles to avoid extra dependencies

export const metadata = {
  title: "Overview · In Production",
};

export default function OverviewPage() {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        background: "#0b1020",
        backgroundImage: "linear-gradient(180deg, #0b1020 0%, #0d1328 100%)",
        color: "#e7eaf3",
        padding: "2rem",
      }}
   >
      <section
        aria-labelledby="overview-title"
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          padding: 28,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 9999,
            background: "rgba(255, 193, 7, 0.12)",
            border: "1px solid rgba(255, 193, 7, 0.35)",
            color: "#ffcd38",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            margin: "0 auto 12px",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: "#ffcd38",
              boxShadow: "0 0 0 4px rgba(255, 193, 7, 0.18)",
              display: "inline-block",
            }}
          />
          In Production
        </div>

        <h1
          id="overview-title"
          style={{
            margin: "6px 0 8px",
            fontSize: 28,
            lineHeight: 1.2,
            color: "#f1f5fb",
          }}
        >
          Overview is on the way
        </h1>
        <p
          style={{
            margin: "0 0 18px",
            color: "rgba(231, 234, 243, 0.78)",
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          We’re building this page. Thanks for your patience — check back
          soon.
        </p>

        <div style={{ opacity: 0.9, fontSize: 12, color: "#9aa3b2" }}>
          Need something now? Contact support.
        </div>
      </section>
    </main>
  );
}

