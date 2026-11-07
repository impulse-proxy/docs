import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {ThemeClassNames} from '@docusaurus/theme-common';
import clsx from 'clsx';
import type {Props} from '@theme/Footer/Layout';

import BrandMark from '@site/src/components/BrandMark';

export default function FooterLayout({style, links, copyright}: Props): ReactNode {
  return (
    <footer className={clsx(ThemeClassNames.layout.footer.container, 'footer', {'footer--dark': style === 'dark'})}>
      <div className="container container-fluid">
        <div className="impulse-footer-grid">
          <div className="impulse-footer-brand">
            <Link className="impulse-footer-home" to="/" aria-label="Impulse documentation home">
              <BrandMark inverse />
              <span>Impulse</span>
            </Link>
            <p>Open-source reverse proxy and edge runtime with production Pingora H1/H2 ingress and experimental HTTP/3.</p>
            <span className="impulse-footer-status">Pre-GA · Controlled production rollout</span>
          </div>
          <div className="impulse-footer-links">{links}</div>
        </div>
        {copyright && <div className="impulse-footer-bottom">{copyright}</div>}
      </div>
    </footer>
  );
}
