import { NotFoundContent } from '@/components/ui/not-found-content';

/** Unknown, deleted or malformed public set id: the page calls notFound(), Next.js sends the 404 status. */
export default function PublicSetNotFound() {
  return (
    <main
      data-testid="public-set-not-found-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-[clamp(20px,5vw,48px)] py-10"
    >
      <NotFoundContent variant="set" />
    </main>
  );
}
