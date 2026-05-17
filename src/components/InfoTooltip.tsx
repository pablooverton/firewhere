'use client';

interface Props {
  text: string;
  /** Where to anchor the tooltip popup relative to the icon. Defaults to "top". */
  position?: 'top' | 'bottom';
}

export function InfoTooltip({ text, position = 'top' }: Props) {
  const popupPosition =
    position === 'top'
      ? 'bottom-full mb-2'
      : 'top-full mt-2';

  return (
    <span className="relative inline-block group ml-1 align-middle" aria-label={text}>
      <span
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-600 text-gray-500 text-[9px] font-semibold cursor-help hover:border-gray-400 hover:text-gray-300 transition-colors"
        aria-hidden="true"
      >
        i
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-20 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity ${popupPosition} left-1/2 -translate-x-1/2 w-64 p-3 rounded-md bg-gray-950 border border-gray-700 text-xs text-gray-300 shadow-xl whitespace-normal text-left font-normal leading-snug`}
      >
        {text}
      </span>
    </span>
  );
}
