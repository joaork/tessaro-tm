// GitHub https://github.com/joaork

import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource/saira-condensed/latin-600.css';
import '@fontsource/saira-condensed/latin-700.css';
import '../client/styles.css';
import '../client/workspace.css';
import { App } from '../client/App';
import { BrandMark } from '../client/ui';

export const metadata: Metadata = {
  title: { default: 'Tessaro T&M | Engenharia de Tempos e Métodos', template: '%s | Tessaro T&M' },
  description: 'Engenharia de Tempos e Métodos. Calcule tempos, emita fichas PO e planeje a produção.',
};

export const viewport: Viewport = { themeColor: '#f5f5f1' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR">
    <body>
      <Suspense fallback={<div className="workspace-loading" role="status"><BrandMark /> <span>Carregando Tessaro T&amp;M…</span></div>}>
        <App />
      </Suspense>
      {children}
    </body>
  </html>;
}
