import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Deze component omhult elke webpagina met de <html>-structuur.
// Hier zetten we de PWA- en iOS-instellingen zodat de app schermvullend
// op het iPhone-beginscherm kan.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* PWA / iOS home-screen app */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Funpoints" />
        <meta name="theme-color" content="#10B981" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-180.png" />
        <link rel="icon" href="/favicon-48.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: achtergrond }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const achtergrond = `
html, body { background-color: #FFF8F0; }
`;
