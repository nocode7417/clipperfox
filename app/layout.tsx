import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const SITE_URL = "https://clipperfox.com";
const TITLE = "Clipperfox — Clip YouTube Videos Online Free, No Signup";
const DESCRIPTION =
  "Clip YouTube videos online for free with no signup or install. Paste a link, set precise in/out points on a frame-accurate timeline, and download a clean 720p MP4 in under 30 seconds. No watermark, no account required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | Clipperfox",
  },
  description: DESCRIPTION,
  keywords: [
    "clip youtube video online free",
    "clip youtube video no signup",
    "youtube video trimmer online",
    "download youtube clip mp4",
    "cut youtube video online free",
    "youtube video cutter no watermark",
    "trim youtube video browser",
    "youtube clip downloader free",
    "video clipper tool online",
    "extract clip from youtube",
  ],
  verification: {
    google: "FlHLLkzn92F4ySM0eB-u5MDP8lsxdr0EwM4UVWRxGV8",
  },
  authors: [{ name: "Clipperfox", url: SITE_URL }],
  creator: "Clipperfox",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Clipperfox",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@clipperfox",
  },
  icons: {
    icon: { url: "/images/favicon.png", sizes: "512x512", type: "image/png" },
    apple: { url: "/images/favicon.png", sizes: "512x512" },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Clipperfox",
      description: DESCRIPTION,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Clipperfox",
      url: SITE_URL,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      featureList: [
        "Trim YouTube videos to exact moments",
        "Export clean 720p MP4 clips",
        "No account or install required",
        "Frame-accurate timeline trimming",
        "Keyboard shortcuts for precision editing",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What platforms does Clipperfox support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipperfox currently supports YouTube, the world's largest video platform with over 800 million active videos. You can clip any public YouTube video by pasting its URL directly into the tool. Support for additional platforms is planned for future releases.",
          },
        },
        {
          "@type": "Question",
          name: "Is Clipperfox really free with no signup?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipperfox is 100% free with no signup, no account creation, and no credit card required. Unlike most video clipping tools that gate features behind paywalls or trial periods, Clipperfox provides full functionality — including 720p HD exports — at zero cost. There are no hidden fees, no watermarks on exported clips, and no premium tier.",
          },
        },
        {
          "@type": "Question",
          name: "How do I clip a YouTube video online?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipping a YouTube video with Clipperfox takes three steps and under 30 seconds. First, paste the YouTube video URL and click 'Start Clipping.' Second, use the frame-accurate timeline to set your start and end points — or press I and O on your keyboard for precision. Third, click 'Export Clip' and your trimmed MP4 downloads automatically. No software installation or browser extension is needed.",
          },
        },
        {
          "@type": "Question",
          name: "What video quality and format does Clipperfox export?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Every clip exported from Clipperfox is encoded at 1280×720 resolution (720p HD) using the H.264 video codec and AAC audio at 128 kbps. The output format is MP4, which is universally compatible with every major platform including iOS, Android, Windows, macOS, and social media services. Clips are compressed with a CRF value of 18, delivering near-lossless visual quality.",
          },
        },
        {
          "@type": "Question",
          name: "How long can a clip be?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipperfox supports clips of up to 10 minutes in length. Most clips process in under 30 seconds from the moment you click export. The tool uses server-side ffmpeg encoding to ensure consistent quality regardless of your device's processing power. Short clips under 60 seconds typically finish in 5–10 seconds.",
          },
        },
        {
          "@type": "Question",
          name: "Does Clipperfox store my data or clips?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipperfox does not store any user data, clips, or browsing history. Temporary files created during the export process are deleted from the server the instant your download completes. No cookies are used for tracking, no account data is collected, and no video content is cached or retained. Your privacy is protected by design.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use Clipperfox on my phone or tablet?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipperfox is fully responsive and works on any modern mobile browser including Safari on iOS and Chrome on Android. On mobile devices, you can double-tap the left or right side of the video preview to skip backward or forward by 10 seconds. The timeline handles are touch-optimized for precise start/end selection on smaller screens.",
          },
        },
        {
          "@type": "Question",
          name: "What keyboard shortcuts does Clipperfox offer?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipperfox provides professional-grade keyboard shortcuts inspired by non-linear video editors. Press I to set the clip start point and O to set the clip end point — the same convention used in Adobe Premiere Pro and DaVinci Resolve. Arrow keys skip forward or backward by 5 seconds. These shortcuts enable frame-accurate in/out points without touching the mouse.",
          },
        },
        {
          "@type": "Question",
          name: "Is Clipperfox safe to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Clipperfox is a browser-based tool that requires no software downloads, browser extensions, or system permissions. All processing happens server-side using industry-standard tools (ffmpeg and yt-dlp), and no executable code is run on your device beyond the web interface. The site is served over HTTPS with security headers including X-Content-Type-Options and X-Frame-Options.",
          },
        },
        {
          "@type": "Question",
          name: "How is Clipperfox different from other YouTube clippers?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Most YouTube clipping tools require account creation, inject watermarks, limit export quality behind paywalls, or require desktop software installation. Clipperfox eliminates all of these barriers — it is entirely browser-based, exports in full 720p HD quality, adds no watermark, and requires zero signup. Average time from URL to exported clip is under 45 seconds.",
          },
        },
      ],
    },
    {
      "@type": "HowTo",
      "@id": `${SITE_URL}/#howto`,
      name: "How to Clip a YouTube Video Online for Free",
      description:
        "Use Clipperfox to extract a specific moment from any public YouTube video and download it as a clean 720p MP4 file in under 30 seconds.",
      totalTime: "PT30S",
      tool: [
        { "@type": "HowToTool", name: "A modern web browser (Chrome, Firefox, Safari, or Edge)" },
      ],
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Paste the YouTube URL",
          text: "Copy the URL of any public YouTube video and paste it into the Clipperfox input field. Click 'Start Clipping' to load the video preview.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Set your clip boundaries",
          text: "Use the interactive timeline to drag the start and end handles to your desired moment. For precision, press I to mark the start and O to mark the end at the current playback position.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Export and download",
          text: "Click 'Export Clip' to process your selection. The clip is encoded at 720p HD and downloads automatically as an MP4 file — typically in under 30 seconds.",
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-0STBQRQPRV"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-0STBQRQPRV');
        `}} />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; height: 100%; }
          html {
            scroll-behavior: smooth;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          ::-webkit-scrollbar { display: none; }
          ::selection { background: rgba(225, 85, 53, 0.35); color: #ffffff; }
          ::-moz-selection { background: rgba(225, 85, 53, 0.35); color: #ffffff; }
        `}</style>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning className={inter.className}>
        <Script
          src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"
          strategy="afterInteractive"
        />
        <div
          style={{
            backgroundColor: "#121212",
            color: "#ffffff",
            WebkitFontSmoothing: "antialiased",
            minHeight: "100vh",
            margin: 0,
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
