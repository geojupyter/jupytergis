import { ExternalLink } from 'lucide-react';
import * as React from 'react';

import { IMetadataField } from '../types';

interface IMetadataSectionProps {
  title: string;
  /** Shown next to the title, for counts and other one-word summaries. */
  summary?: string;
  /**
   * Hover tip rendered after the title, for explanations that a reader who
   * already knows the subject should not have to scroll past.
   */
  info?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A titled block of the Metadata tab.
 */
export const MetadataSection: React.FC<IMetadataSectionProps> = ({
  title,
  summary,
  info,
  children,
}) => (
  <section className="jgis-metadata-section flex flex-col gap-2">
    <h3 className="m-0 flex items-baseline gap-2 text-sm font-semibold text-foreground">
      {title}
      {summary ? (
        <span className="text-xs font-normal text-muted-foreground">
          {summary}
        </span>
      ) : null}
      {info}
    </h3>
    {children}
  </section>
);

/**
 * Label/value rows, laid out as a two-column grid so that the values line up
 * down the panel.
 */
export const FieldList: React.FC<{ fields: IMetadataField[] }> = ({
  fields,
}) => (
  <dl className="m-0 grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
    {fields.map(field => (
      <React.Fragment key={`${field.label}-${field.value}`}>
        <dt className="text-muted-foreground">{field.label}</dt>
        <dd className="m-0 min-w-0 break-words text-foreground">
          <FieldValue field={field} />
        </dd>
      </React.Fragment>
    ))}
  </dl>
);

const FieldValue: React.FC<{ field: IMetadataField }> = ({ field }) => {
  const className = field.mono ? 'font-mono text-xs' : undefined;

  if (field.href) {
    return (
      <a
        href={field.href}
        target="_blank"
        rel="noreferrer noopener"
        className={`inline-flex items-baseline gap-1 text-primary hover:underline ${className ?? ''}`}
      >
        <span className="min-w-0 break-all">{field.value}</span>
        <ExternalLink aria-hidden className="size-3 shrink-0 self-center" />
      </a>
    );
  }

  return <span className={className}>{field.value}</span>;
};
