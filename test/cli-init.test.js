/**
 * Unit tests for lib/cli/init.js — markdown builders.
 *
 * runInit() is integration-heavy (interactive prompts, fs writes), so we
 * focus on the pure builder functions buildProjectMd / buildRulesMd which
 * encode the bulk of the conditional content. The runInit happy path is
 * covered by the existing setup.test.js + manual smoke tests.
 */
import { describe, it, expect } from 'vitest';
import { buildProjectMd, buildRulesMd } from '../lib/cli/init.js';

const empty = {
  name: '', description: '', stack: [], framework: '',
  hasTS: false, hasTailwind: false, hasI18n: false, hasAuth: false, hasDB: false,
  hasPayments: false, hasAI: false, deploy: '', dbName: '', authName: '', paymentName: '',
  components: [], apiRoutes: [], locales: [],
};

describe('buildProjectMd', () => {
  it('emits placeholder content for an empty project', () => {
    const md = buildProjectMd(empty);
    expect(md).toContain('# Project: my-project');
    expect(md).toContain('Describe what this project does');
    expect(md).toContain('Add your tech stack');
    expect(md).toContain('**TypeScript**: No');
    expect(md).toContain('**Database**: No');
  });

  it('emits Next.js + TS + Tailwind detection', () => {
    const md = buildProjectMd({
      ...empty,
      name: 'my-app',
      description: 'short desc',
      framework: 'Next.js',
      stack: ['Next.js', 'TypeScript', 'TailwindCSS'],
      hasTS: true, hasTailwind: true,
      deploy: 'Vercel',
    });
    expect(md).toContain('# Project: my-app');
    expect(md).toContain('short desc');
    expect(md).toContain('- Next.js');
    expect(md).toContain('- TypeScript');
    expect(md).toContain('**Deploy**: Vercel');
    expect(md).toContain('**TypeScript**: Yes');
    expect(md).toContain('**CSS**: TailwindCSS');
  });

  it('renders auth/db/payments labels by name', () => {
    const md = buildProjectMd({
      ...empty,
      hasAuth: true, authName: 'NextAuth',
      hasDB: true, dbName: 'Supabase',
      hasPayments: true, paymentName: 'Stripe',
    });
    expect(md).toContain('**Auth**: NextAuth');
    expect(md).toContain('**Database**: Supabase');
    expect(md).toContain('**Payments**: Stripe');
  });

  it('lists components and api routes when present', () => {
    const md = buildProjectMd({
      ...empty,
      components: ['Button', 'Card'],
      apiRoutes: ['/users', '/health'],
    });
    expect(md).toContain('- Button');
    expect(md).toContain('- Card');
    expect(md).toContain('`/api/users`');
    expect(md).toContain('`/api/health`');
  });

  it('joins locales when i18n detected', () => {
    const md = buildProjectMd({ ...empty, hasI18n: true, locales: ['en', 'ko'] });
    expect(md).toContain('**i18n**: Yes (en, ko)');
  });
});

describe('buildRulesMd', () => {
  it('always emits the no-default-export and no-console rules', () => {
    const md = buildRulesMd(empty);
    expect(md).toContain('No `console.log`');
    expect(md).toContain('No default exports');
    expect(md).toContain('npm run lint');
    expect(md).toContain('npm run build');
  });

  it('adds Next.js conventions when framework matches', () => {
    const md = buildRulesMd({ ...empty, framework: 'Next.js' });
    expect(md).toContain('App Router patterns');
    expect(md).toContain('Server components by default');
  });

  it('adds TS strict rule when TypeScript is detected', () => {
    const md = buildRulesMd({ ...empty, hasTS: true });
    expect(md).toContain('Strict TypeScript');
    expect(md).toContain('npx tsc --noEmit');
  });

  it('adds payment + auth review rules conditionally', () => {
    const md = buildRulesMd({
      ...empty,
      hasAuth: true, hasPayments: true, hasAI: true,
    });
    expect(md).toContain('All API routes must check authentication');
    expect(md).toContain('Payment mutations must be server-side');
    expect(md).toContain('AI-generated content treated as untrusted');
  });

  it('adds locale sync rule when locales detected', () => {
    const md = buildRulesMd({
      ...empty, hasI18n: true, locales: ['en', 'ko', 'ja'],
    });
    expect(md).toContain('All 3 locale files must be in sync');
  });
});
