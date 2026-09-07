import { splitBioLinks } from '@/lib/plusDisplay';
import { safeHref } from '@/lib/safeHref';

export function BioText({ text, plus }: { text: string; plus?: boolean }) {
  if (!plus) {
    return <p className="whitespace-pre-wrap break-words text-base text-text">{text}</p>;
  }

  return (
    <p className="whitespace-pre-wrap break-words text-base text-text">
      {splitBioLinks(text).map((part, index) => {
        const href = part.type === 'link' ? safeHref(part.value) : undefined;
        return href ? (
          <a
            key={`${part.value}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-link hover:underline"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        );
      })}
    </p>
  );
}
