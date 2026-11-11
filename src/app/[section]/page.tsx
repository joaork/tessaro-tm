// GitHub https://github.com/joaork

import type { Metadata } from 'next';
import { isSectionPath, sectionPaths, sectionTitles } from '../../shared/routes';

export const dynamicParams = false;

export function generateStaticParams() {
  return sectionPaths.filter((section) => section !== 'inicio').map((section) => ({ section }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return isSectionPath(section) ? { title: sectionTitles[section] } : {};
}

export default function Section() {
  return null;
}
