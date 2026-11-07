import React, {type ReactNode} from 'react';

export default function BrandMark({inverse = false}: {inverse?: boolean}): ReactNode {
  return (
    <span className={`impulse-brand-mark${inverse ? ' impulse-brand-mark--inverse' : ''}`} aria-hidden="true">
      <span className="impulse-brand-mark__line impulse-brand-mark__line--down" />
      <span className="impulse-brand-mark__line impulse-brand-mark__line--up" />
      <span className="impulse-brand-mark__dot" />
    </span>
  );
}
