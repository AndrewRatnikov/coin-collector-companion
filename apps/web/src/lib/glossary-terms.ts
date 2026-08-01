import type { MessageKey } from '@/lib/i18n/locales/en';

export type GlossaryTier = 'app' | 'general';

export interface GlossaryTermEntry {
  id: string;
  tier: GlossaryTier;
  termKey: MessageKey;
  definitionKey: MessageKey;
}

export const GLOSSARY_TERMS: GlossaryTermEntry[] = [
  // App-grounded terms (tier: 'app') — alphabetical
  {
    id: 'canonical-set',
    tier: 'app',
    termKey: 'glossary.term.canonicalSet',
    definitionKey: 'glossary.definition.canonicalSet',
  },
  {
    id: 'cloning-a-set',
    tier: 'app',
    termKey: 'glossary.term.cloningASet',
    definitionKey: 'glossary.definition.cloningASet',
  },
  {
    id: 'completion-percentage',
    tier: 'app',
    termKey: 'glossary.term.completionPercentage',
    definitionKey: 'glossary.definition.completionPercentage',
  },
  {
    id: 'country',
    tier: 'app',
    termKey: 'glossary.term.country',
    definitionKey: 'glossary.definition.country',
  },
  {
    id: 'denomination',
    tier: 'app',
    termKey: 'glossary.term.denomination',
    definitionKey: 'glossary.definition.denomination',
  },
  {
    id: 'gap-view',
    tier: 'app',
    termKey: 'glossary.term.gapView',
    definitionKey: 'glossary.definition.gapView',
  },
  {
    id: 'mint-mark',
    tier: 'app',
    termKey: 'glossary.term.mintMark',
    definitionKey: 'glossary.definition.mintMark',
  },
  {
    id: 'ownership',
    tier: 'app',
    termKey: 'glossary.term.ownership',
    definitionKey: 'glossary.definition.ownership',
  },
  {
    id: 'public-set',
    tier: 'app',
    termKey: 'glossary.term.publicSet',
    definitionKey: 'glossary.definition.publicSet',
  },
  {
    id: 'user-set',
    tier: 'app',
    termKey: 'glossary.term.userSet',
    definitionKey: 'glossary.definition.userSet',
  },
  {
    id: 'variety',
    tier: 'app',
    termKey: 'glossary.term.variety',
    definitionKey: 'glossary.definition.variety',
  },

  // General numismatic terms (tier: 'general') — alphabetical
  {
    id: 'grade',
    tier: 'general',
    termKey: 'glossary.term.grade',
    definitionKey: 'glossary.definition.grade',
  },
  {
    id: 'key-date',
    tier: 'general',
    termKey: 'glossary.term.keyDate',
    definitionKey: 'glossary.definition.keyDate',
  },
  {
    id: 'mintage',
    tier: 'general',
    termKey: 'glossary.term.mintage',
    definitionKey: 'glossary.definition.mintage',
  },
  {
    id: 'numismatics',
    tier: 'general',
    termKey: 'glossary.term.numismatics',
    definitionKey: 'glossary.definition.numismatics',
  },
  {
    id: 'obverse',
    tier: 'general',
    termKey: 'glossary.term.obverse',
    definitionKey: 'glossary.definition.obverse',
  },
  {
    id: 'patina',
    tier: 'general',
    termKey: 'glossary.term.patina',
    definitionKey: 'glossary.definition.patina',
  },
  {
    id: 'proof',
    tier: 'general',
    termKey: 'glossary.term.proof',
    definitionKey: 'glossary.definition.proof',
  },
  {
    id: 'reverse',
    tier: 'general',
    termKey: 'glossary.term.reverse',
    definitionKey: 'glossary.definition.reverse',
  },
  {
    id: 'uncirculated',
    tier: 'general',
    termKey: 'glossary.term.uncirculated',
    definitionKey: 'glossary.definition.uncirculated',
  },
];
