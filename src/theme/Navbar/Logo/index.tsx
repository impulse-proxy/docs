import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';

import BrandMark from '@site/src/components/BrandMark';

export default function NavbarLogo(): ReactNode {
  return (
    <Link className="navbar__brand impulse-navbar-brand" to="/" aria-label="Impulse documentation home">
      <BrandMark />
      <span className="navbar__title">Impulse</span>
      <span className="impulse-maturity-badge">Pre-GA</span>
    </Link>
  );
}
