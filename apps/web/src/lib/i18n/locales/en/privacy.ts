// English dictionary, privacy area: the `/privacy` page (what the app stores, Sentry, PostHog).
// Merged into the full dictionary by `./index.ts` (see that file for the typing).
const privacy = {
  'privacy.title': 'Privacy',
  'privacy.intro': 'What Coin Collector Companion keeps about you, and what it sends to other services.',
  'privacy.storedHeading': 'What the app stores',
  'privacy.storedBody':
    'Your account email and a hash of your password, the sets you build, and the coins you mark as owned with their grades. Nothing else.',
  'privacy.errorsHeading': 'Error reports',
  'privacy.errorsBody':
    'When something breaks, an error report goes to Sentry. It carries no email, IP address, cookies, form contents or page addresses with their query part. Some visits also send a replay of the page layout with all text, inputs and images hidden.',
  'privacy.analyticsHeading': 'Visit counts',
  'privacy.analyticsBody':
    'PostHog counts visits and a few actions (signing up, creating or copying a set, marking coins owned, printing or downloading a want list, and catalog searches that find nothing). For a catalog search that finds nothing it receives only the filters and the search text, shortened to 40 characters. It sets no cookies, stores nothing in your browser, and never receives your email, account id or set names.',
} as const;

export default privacy;
