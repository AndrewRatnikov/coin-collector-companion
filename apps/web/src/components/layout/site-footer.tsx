export function SiteFooter() {
  return (
    <footer className="mt-auto py-4 text-center text-xs text-gray-500 dark:text-gray-400">
      Catalog data derived from{' '}
      <a
        href="https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Wikipedia
      </a>
      , used under CC BY-SA 4.0.
    </footer>
  );
}
