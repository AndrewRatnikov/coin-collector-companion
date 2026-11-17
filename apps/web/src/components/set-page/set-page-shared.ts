// Constants and types shared by the set page (/sets/[id]) and its section components.

export const PAGE_WRAPPER_CLASSNAME =
  'mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 max-[899px]:py-6';

export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

export type SetFilter = 'all' | 'missing' | 'upgrade';
