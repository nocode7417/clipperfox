import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllKeywords, getKeywordBySlug } from "@/lib/getKeywords";
import CropOnline from "@/components/pseo/CropOnline";
import TrimDownload from "@/components/pseo/TrimDownload";
import GenericCutter from "@/components/pseo/GenericCutter";
import ClipMaker from "@/components/pseo/ClipMaker";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const keywords = getAllKeywords();
  return keywords.map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = getKeywordBySlug(slug);
  if (!data) return {};

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: {
      canonical: `https://clipperfox.com/${data.slug}`,
    },
    openGraph: {
      title: data.metaTitle,
      description: data.metaDescription,
      url: `https://clipperfox.com/${data.slug}`,
      siteName: "Clipperfox",
      type: "website",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PseoPage({ params }: PageProps) {
  const { slug } = await params;
  const data = getKeywordBySlug(slug);
  if (!data) notFound();

  switch (data.templateId) {
    case "crop-online":
      return <CropOnline data={data} />;
    case "trim-download":
      return <TrimDownload data={data} />;
    case "clip-maker":
      return <ClipMaker data={data} />;
    case "generic-cutter":
    default:
      return <GenericCutter data={data} />;
  }
}
