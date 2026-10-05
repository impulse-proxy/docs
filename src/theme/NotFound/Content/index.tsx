import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import type {Props} from '@theme/NotFound/Content';
import Heading from '@theme/Heading';

export default function NotFoundContent({className}: Props): ReactNode {
  return (
    <main className={`container margin-vert--xl ${className ?? ''}`}>
      <div className="row">
        <div className="col col--6 col--offset-3">
          <Heading as="h1">Page not found</Heading>
          <p>This page does not exist in the Impulse documentation.</p>
          <Link className="button button--primary" to="/">
            Back to docs
          </Link>
        </div>
      </div>
    </main>
  );
}
