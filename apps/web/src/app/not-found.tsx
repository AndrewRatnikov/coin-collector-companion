import { NotFoundContent } from '@/components/ui/not-found-content';

/** Unknown URLs. Rendered inside the root layout (nav and footer); Next.js sends the 404 status. */
export default function NotFound() {
  return (
    <main
      data-testid="not-found-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-[clamp(20px,5vw,48px)] py-10"
    >
      <NotFoundContent variant="page" />
    </main>
  );
}
