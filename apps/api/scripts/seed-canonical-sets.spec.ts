/**
 * Tests for: apps/api/scripts/seed-canonical-sets.ts
 * Contract source: runs/run_20260720_121716/plan.md § Interface Contract
 *                   (Script: apps/api/scripts/seed-canonical-sets.ts)
 *                   runs/run_20261121_222133/plan.md § Step D, Step E (latestTemplateVersions)
 *                   runs/run_20261126_213654/plan.md § Interface Contract (seedTemplateFile)
 * Covers criteria: #3, #4, #5, #6 (from runs/run_20260720_121716/prd.md)
 *                  #6 (from runs/run_20261121_222133/prd.md)
 *                  #11, #12 (from runs/run_20261126_213654/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * SeedPrismaClient is mocked entirely (coin.findUnique, canonicalSet.findFirst/create/update,
 * canonicalSetCoin.findMany/createMany/update) — no real DB or network call. node:fs's
 * readFileSync/readdirSync are mocked via jest.mock('node:fs') — no real filesystem access.
 */

import { readFileSync, readdirSync } from 'node:fs';
import {
  latestTemplateVersions,
  resolveTemplatePaths,
  parseTemplateVersion,
  loadTemplate,
  seedTemplateFile,
  SeedPrismaClient,
  SeedTemplate,
} from './seed-canonical-sets';

jest.mock('node:fs');

const mockedReadFileSync = readFileSync as unknown as jest.Mock;
const mockedReaddirSync = readdirSync as unknown as jest.Mock;

function makeMockPrisma(): {
  coin: { findUnique: jest.Mock };
  canonicalSet: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  canonicalSetCoin: { findMany: jest.Mock; createMany: jest.Mock; update: jest.Mock };
} {
  return {
    coin: { findUnique: jest.fn() },
    canonicalSet: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    canonicalSetCoin: { findMany: jest.fn(), createMany: jest.fn(), update: jest.fn() },
  };
}

describe('seed-canonical-sets', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('criterion 3: parseTemplateVersion extracts the template-version suffix', () => {
    it('extracts the version suffix from a simple filename', () => {
      expect(parseTemplateVersion('lincoln-wheat-cents.v1.json')).toBe('v1');
    });

    it('extracts the version suffix when the path includes directories', () => {
      expect(
        parseTemplateVersion('/repo/seed/templates/lincoln-wheat-cents-key-dates.v1.json'),
      ).toBe('v1');
    });

    it('throws when the filename has no version suffix', () => {
      expect(() => parseTemplateVersion('lincoln-wheat-cents.json')).toThrow();
    });
  });

  describe('loadTemplate reads and parses a template file', () => {
    it('returns the parsed template', () => {
      const template: SeedTemplate = {
        name: 'Lincoln Wheat Cents',
        coins: [{ country: 'USA', denomination: 'Cent', year: 1909, mintMark: '', variety: 'VDB' }],
      };
      mockedReadFileSync.mockReturnValue(JSON.stringify(template));

      const result = loadTemplate('/repo/seed/templates/lincoln-wheat-cents.v1.json');

      expect(mockedReadFileSync).toHaveBeenCalledWith(
        '/repo/seed/templates/lincoln-wheat-cents.v1.json',
        'utf-8',
      );
      expect(result).toEqual(template);
    });
  });

  describe('latestTemplateVersions', () => {
    it('keeps v2 over v1 of the same template', () => {
      expect(
        latestTemplateVersions(['/t/a.v1.json', '/t/a.v2.json']),
      ).toEqual(['/t/a.v2.json']);
      expect(
        latestTemplateVersions(['/t/a.v2.json', '/t/a.v1.json']),
      ).toEqual(['/t/a.v2.json']);
    });

    it('compares versions as numbers, so v10 beats v2', () => {
      expect(
        latestTemplateVersions(['/t/a.v2.json', '/t/a.v10.json']),
      ).toEqual(['/t/a.v10.json']);
      expect(
        latestTemplateVersions(['/t/a.v10.json', '/t/a.v2.json']),
      ).toEqual(['/t/a.v10.json']);
    });

    it('keeps different slugs that share a prefix', () => {
      const result = latestTemplateVersions([
        '/t/lincoln-wheat-cents.v1.json',
        '/t/lincoln-wheat-cents-key-dates.v1.json',
      ]);
      expect(result).toHaveLength(2);
      expect(result).toContain('/t/lincoln-wheat-cents.v1.json');
      expect(result).toContain('/t/lincoln-wheat-cents-key-dates.v1.json');
    });

    it('keeps the input order of the kept paths', () => {
      expect(
        latestTemplateVersions(['/t/b.v1.json', '/t/a.v1.json', '/t/c.v3.json', '/t/c.v1.json']),
      ).toEqual(['/t/b.v1.json', '/t/a.v1.json', '/t/c.v3.json']);
    });

    it('keeps a path with no version suffix', () => {
      const result = latestTemplateVersions(['/t/a.v1.json', '/t/notes.json']);
      expect(result).toContain('/t/notes.json');
      expect(result).toContain('/t/a.v1.json');
      expect(result).toHaveLength(2);
    });

    it('returns an empty list for no paths', () => {
      expect(latestTemplateVersions([])).toEqual([]);
    });
  });

  describe('resolveTemplatePaths', () => {
    it('resolves explicit argv paths when given', () => {
      const result = resolveTemplatePaths(['seed/templates/a.v1.json', 'seed/templates/b.v1.json']);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('a.v1.json');
      expect(result[1]).toContain('b.v1.json');
    });

    it('falls back to every .json file under the templates directory when no args are given', () => {
      mockedReaddirSync.mockReturnValue([
        'lincoln-wheat-cents.v1.json',
        'lincoln-wheat-cents-key-dates.v1.json',
        'README.md',
      ]);

      const result = resolveTemplatePaths([]);

      expect(result).toHaveLength(2);
      expect(result.some((p) => p.endsWith('lincoln-wheat-cents.v1.json'))).toBe(true);
      expect(result.some((p) => p.endsWith('lincoln-wheat-cents-key-dates.v1.json'))).toBe(true);
      expect(result.some((p) => p.endsWith('README.md'))).toBe(false);
    });

    it('with no args returns only the newest version of each template', () => {
      mockedReaddirSync.mockReturnValue(['x.v1.json', 'x.v2.json', 'y.v1.json']);

      const result = resolveTemplatePaths([]);

      expect(result).toHaveLength(2);
      expect(result.some((p) => p.endsWith('x.v2.json'))).toBe(true);
      expect(result.some((p) => p.endsWith('y.v1.json'))).toBe(true);
      expect(result.some((p) => p.endsWith('x.v1.json'))).toBe(false);
    });

    it('with explicit args still returns an old version that was named on purpose', () => {
      const result = resolveTemplatePaths(['seed/templates/x.v1.json']);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('x.v1.json');
    });
  });

  describe('seedTemplateFile', () => {
    const filePath = '/repo/seed/templates/lincoln-wheat-cents.v1.json';
    const template: SeedTemplate = {
      name: 'Lincoln Wheat Cents',
      coins: [
        { country: 'USA', denomination: 'Cent', year: 1909, mintMark: '', variety: 'VDB' },
        { country: 'USA', denomination: 'Cent', year: 1909, mintMark: 'S', variety: '' },
      ],
    };

    beforeEach(() => {
      mockedReadFileSync.mockReturnValue(JSON.stringify(template));
    });

    describe('criterion 4: upserts CanonicalSet + resolves + writes position-ordered CanonicalSetCoin rows', () => {
      it('creates a new CanonicalSet when none exists by name, and creates all CanonicalSetCoin rows in order', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue(null);
        prisma.canonicalSet.create.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce({ id: 'coin-2', status: 'approved' });
        prisma.canonicalSetCoin.findMany.mockResolvedValue([]);
        prisma.canonicalSetCoin.createMany.mockResolvedValue({ count: 2 });

        const result = await seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath);

        expect(prisma.canonicalSet.findFirst).toHaveBeenCalledWith({ where: { name: template.name } });
        expect(prisma.canonicalSet.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: template.name,
              source: 'seed-template',
              templateVersion: 'v1',
            }),
          }),
        );
        expect(prisma.canonicalSet.update).not.toHaveBeenCalled();
        expect(prisma.canonicalSetCoin.createMany).toHaveBeenCalledWith({
          data: [
            { canonicalSetId: 'set-1', coinId: 'coin-1', position: 1 },
            { canonicalSetId: 'set-1', coinId: 'coin-2', position: 2 },
          ],
          skipDuplicates: true,
        });
        expect(prisma.canonicalSetCoin.update).not.toHaveBeenCalled();
        expect(result).toEqual({ name: template.name, created: 2, updated: 0, total: 2 });
      });

      it('updates an existing CanonicalSet found by name instead of creating a new one', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.canonicalSet.update.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce({ id: 'coin-2', status: 'approved' });
        prisma.canonicalSetCoin.findMany.mockResolvedValue([]);
        prisma.canonicalSetCoin.createMany.mockResolvedValue({ count: 2 });

        await seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath);

        expect(prisma.canonicalSet.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'set-1' },
            data: expect.objectContaining({ source: 'seed-template', templateVersion: 'v1' }),
          }),
        );
        expect(prisma.canonicalSet.create).not.toHaveBeenCalled();
      });

      it('issues an explicit position update when a coin already exists at a different position', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.canonicalSet.update.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce({ id: 'coin-2', status: 'approved' });
        // coin-2 is currently stored at position 5; the template says it should be position 2.
        prisma.canonicalSetCoin.findMany.mockResolvedValue([
          { id: 'row-1', canonicalSetId: 'set-1', coinId: 'coin-1', position: 1 },
          { id: 'row-2', canonicalSetId: 'set-1', coinId: 'coin-2', position: 5 },
        ]);

        const result = await seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath);

        expect(prisma.canonicalSetCoin.update).toHaveBeenCalledTimes(1);
        expect(prisma.canonicalSetCoin.update).toHaveBeenCalledWith({
          where: { id: 'row-2' },
          data: { position: 2 },
        });
        expect(prisma.canonicalSetCoin.createMany).not.toHaveBeenCalled();
        expect(result).toEqual({ name: template.name, created: 0, updated: 1, total: 2 });
      });
    });

    describe('criterion 5: fails loudly and stops on an unresolved coin entry', () => {
      it('throws and issues no CanonicalSetCoin writes when a coin entry does not resolve against the catalog', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue(null);
        prisma.canonicalSet.create.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce(null); // second entry fails to resolve

        await expect(
          seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath),
        ).rejects.toThrow();

        expect(prisma.canonicalSetCoin.createMany).not.toHaveBeenCalled();
        expect(prisma.canonicalSetCoin.update).not.toHaveBeenCalled();
      });
    });

    describe('criteria 11, 12: refuses to link a coin that is not approved', () => {
      it.each([
        ['pending', 'pending'],
        ['rejected', 'rejected'],
      ])('throws naming template, file, entry, key, id and status for a %s coin', async (status) => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue(null);
        prisma.canonicalSet.create.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce({ id: 'coin-hidden', status });
        prisma.canonicalSetCoin.findMany.mockResolvedValue([]);

        let message = '';
        try {
          await seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath);
        } catch (error) {
          message = (error as Error).message;
        }

        expect(message).toContain('Coin not approved');
        expect(message).toContain(template.name);
        expect(message).toContain(filePath);
        expect(message).toContain('entry 1');
        expect(message).toContain('USA Cent 1909 mintMark="S" variety=""');
        expect(message).toContain('id=coin-hidden');
        expect(message).toContain(`status=${status}`);
        expect(prisma.canonicalSetCoin.createMany).not.toHaveBeenCalled();
        expect(prisma.canonicalSetCoin.update).not.toHaveBeenCalled();
      });

      it('names the first entry (index 0) when it is the non-approved one', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue(null);
        prisma.canonicalSet.create.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique.mockResolvedValueOnce({ id: 'coin-first', status: 'pending' });

        await expect(
          seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath),
        ).rejects.toThrow(/entry 0: USA Cent 1909 mintMark="" variety="VDB" id=coin-first status=pending/);
        expect(prisma.canonicalSetCoin.createMany).not.toHaveBeenCalled();
      });

      it('treats a missing status as non-approved', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue(null);
        prisma.canonicalSet.create.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce({ id: 'coin-nostatus' });

        await expect(
          seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath),
        ).rejects.toThrow(/id=coin-nostatus status=undefined/);
        expect(prisma.canonicalSetCoin.createMany).not.toHaveBeenCalled();
        expect(prisma.canonicalSetCoin.update).not.toHaveBeenCalled();
      });

      it('does not throw the not-approved error for an approved coin', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue(null);
        prisma.canonicalSet.create.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce({ id: 'coin-2', status: 'approved' });
        prisma.canonicalSetCoin.findMany.mockResolvedValue([]);
        prisma.canonicalSetCoin.createMany.mockResolvedValue({ count: 2 });

        await expect(
          seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath),
        ).resolves.toEqual({ name: template.name, created: 2, updated: 0, total: 2 });
      });
    });

    describe('criterion 6: idempotent re-run creates and updates nothing', () => {
      it('produces zero creates and zero updates when re-run against an already-seeded, unchanged set', async () => {
        const prisma = makeMockPrisma();
        prisma.canonicalSet.findFirst.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.canonicalSet.update.mockResolvedValue({ id: 'set-1', name: template.name });
        prisma.coin.findUnique
          .mockResolvedValueOnce({ id: 'coin-1', status: 'approved' })
          .mockResolvedValueOnce({ id: 'coin-2', status: 'approved' });
        prisma.canonicalSetCoin.findMany.mockResolvedValue([
          { id: 'row-1', canonicalSetId: 'set-1', coinId: 'coin-1', position: 1 },
          { id: 'row-2', canonicalSetId: 'set-1', coinId: 'coin-2', position: 2 },
        ]);

        const result = await seedTemplateFile(prisma as unknown as SeedPrismaClient, filePath);

        expect(prisma.canonicalSetCoin.createMany).not.toHaveBeenCalled();
        expect(prisma.canonicalSetCoin.update).not.toHaveBeenCalled();
        expect(result).toEqual({ name: template.name, created: 0, updated: 0, total: 2 });
      });
    });
  });
});
