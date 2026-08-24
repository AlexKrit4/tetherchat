import { splitBioLinks } from '@/lib/plusDisplay';

export function BioText({ text, plus }: { text: string; plus?: boolean }) {
  if (!plus) {
    return <p className="whitespace-pre-wrap break-words text-base text-text">{text}</p>;
  }

  return (
    <p className="whitespace-pre-wrap break-words text-base text-text">
      {splitBioLinks(text).map((part, index) =>
        part.type === 'link' ? (
          <a
            key={`${part.value}-${index}`}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-link hover:underline"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}
