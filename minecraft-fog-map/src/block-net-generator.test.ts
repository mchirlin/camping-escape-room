import { describe, it, expect, beforeEach } from 'vitest';
import {
  BIOMES,
  BLOCK_LIBRARY,
  getBlockNames,
  getBlockByName,
  applyVariant,
  blockUsesBiomeTint,
  setCurrentBiome,
  getCurrentBiome,
} from './block-net-generator';
import type { BlockDef, BiomeDef } from './block-net-generator';

describe('block-net-generator', () => {
  describe('BIOMES', () => {
    it('contains at least 10 biome definitions', () => {
      expect(BIOMES.length).toBeGreaterThanOrEqual(10);
    });

    it('each biome has a name, grass color, and foliage color', () => {
      for (const biome of BIOMES) {
        expect(biome.name).toBeTruthy();
        expect(biome.grass).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(biome.foliage).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('BLOCK_LIBRARY', () => {
    it('contains blocks', () => {
      expect(BLOCK_LIBRARY.length).toBeGreaterThan(0);
    });

    it('every block has name, category, and all 6 faces', () => {
      const faceKeys = ['top', 'front', 'right', 'back', 'left', 'bottom'];
      for (const block of BLOCK_LIBRARY) {
        expect(block.name).toBeTruthy();
        expect(block.category).toBeTruthy();
        for (const face of faceKeys) {
          expect(block.faces).toHaveProperty(face);
          expect(block.faces[face as keyof typeof block.faces]).toBeTruthy();
        }
      }
    });

    it('has no duplicate block names', () => {
      const names = BLOCK_LIBRARY.map((b) => b.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });

  describe('getBlockNames', () => {
    it('returns a sorted array of block names', () => {
      const names = getBlockNames();
      expect(names.length).toBe(BLOCK_LIBRARY.length);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('includes known blocks', () => {
      const names = getBlockNames();
      expect(names).toContain('Stone');
      expect(names).toContain('Grass Block');
      expect(names).toContain('TNT');
    });
  });

  describe('getBlockByName', () => {
    it('returns the correct block for a known name', () => {
      const stone = getBlockByName('Stone');
      expect(stone).toBeDefined();
      expect(stone!.name).toBe('Stone');
      expect(stone!.category).toBe('Natural');
    });

    it('returns undefined for an unknown name', () => {
      expect(getBlockByName('Nonexistent Block')).toBeUndefined();
    });

    it('returns Grass Block with composite side textures', () => {
      const grass = getBlockByName('Grass Block');
      expect(grass).toBeDefined();
      expect(grass!.faces.top).toBe('grass_block_top.png');
      expect(grass!.faces.front).toContain('composite:');
      expect(grass!.faces.bottom).toBe('dirt.png');
    });
  });

  describe('applyVariant', () => {
    it('returns the original block when no variants exist', () => {
      const stone = getBlockByName('Stone')!;
      const result = applyVariant(stone, 0);
      expect(result).toBe(stone);
    });

    it('returns the original block for negative variant index', () => {
      const pumpkin = getBlockByName('Carved Pumpkin')!;
      const result = applyVariant(pumpkin, -1);
      expect(result).toBe(pumpkin);
    });

    it('applies a variant by overriding the specified faces', () => {
      const pumpkin = getBlockByName('Carved Pumpkin')!;
      expect(pumpkin.variants).toBeDefined();

      // Variant 1 = Jack o'Lantern
      const jackolantern = applyVariant(pumpkin, 1);
      expect(jackolantern.faces.front).toBe('jack_o_lantern.png');
      // Other faces should remain unchanged
      expect(jackolantern.faces.top).toBe(pumpkin.faces.top);
      expect(jackolantern.faces.right).toBe(pumpkin.faces.right);
    });

    it('returns original block for out-of-range variant index', () => {
      const pumpkin = getBlockByName('Carved Pumpkin')!;
      const result = applyVariant(pumpkin, 999);
      expect(result).toBe(pumpkin);
    });

    it('does not mutate the original block', () => {
      const pumpkin = getBlockByName('Carved Pumpkin')!;
      const originalFront = pumpkin.faces.front;
      applyVariant(pumpkin, 1);
      expect(pumpkin.faces.front).toBe(originalFront);
    });
  });

  describe('blockUsesBiomeTint', () => {
    it('returns true for Grass Block (has composite tinted overlay)', () => {
      const grass = getBlockByName('Grass Block')!;
      expect(blockUsesBiomeTint(grass)).toBe(true);
    });

    it('returns true for Oak Leaves (tinted texture)', () => {
      const leaves = getBlockByName('Oak Leaves')!;
      expect(blockUsesBiomeTint(leaves)).toBe(true);
    });

    it('returns false for Stone (no tinting)', () => {
      const stone = getBlockByName('Stone')!;
      expect(blockUsesBiomeTint(stone)).toBe(false);
    });

    it('returns false for TNT (no tinting)', () => {
      const tnt = getBlockByName('TNT')!;
      expect(blockUsesBiomeTint(tnt)).toBe(false);
    });
  });

  describe('setCurrentBiome / getCurrentBiome', () => {
    beforeEach(() => {
      // Reset to default
      setCurrentBiome(BIOMES[0]);
    });

    it('defaults to the first biome (Plains)', () => {
      expect(getCurrentBiome().name).toBe('Plains');
    });

    it('changes the current biome', () => {
      const jungle = BIOMES.find((b) => b.name === 'Jungle')!;
      setCurrentBiome(jungle);
      expect(getCurrentBiome()).toBe(jungle);
      expect(getCurrentBiome().name).toBe('Jungle');
    });

    it('can cycle through all biomes', () => {
      for (const biome of BIOMES) {
        setCurrentBiome(biome);
        expect(getCurrentBiome()).toBe(biome);
      }
    });
  });

  describe('uniform blocks', () => {
    it('have the same texture on all 6 faces', () => {
      const stone = getBlockByName('Stone')!;
      const tex = stone.faces.top;
      expect(stone.faces.front).toBe(tex);
      expect(stone.faces.right).toBe(tex);
      expect(stone.faces.back).toBe(tex);
      expect(stone.faces.left).toBe(tex);
      expect(stone.faces.bottom).toBe(tex);
    });
  });

  describe('topSideBottom blocks', () => {
    it('have distinct top, side, and bottom textures', () => {
      const tnt = getBlockByName('TNT')!;
      expect(tnt.faces.top).toBe('tnt_top.png');
      expect(tnt.faces.front).toBe('tnt_side.png');
      expect(tnt.faces.right).toBe('tnt_side.png');
      expect(tnt.faces.back).toBe('tnt_side.png');
      expect(tnt.faces.left).toBe('tnt_side.png');
      expect(tnt.faces.bottom).toBe('tnt_bottom.png');
    });
  });

  describe('Chiseled Bookshelf variants', () => {
    it('has 7 variants (0 through 6 books)', () => {
      const shelf = getBlockByName('Chiseled Bookshelf')!;
      expect(shelf.variants).toBeDefined();
      expect(shelf.variants!.options.length).toBe(7);
    });

    it('empty variant uses chiseled_bookshelf_empty.png', () => {
      const shelf = getBlockByName('Chiseled Bookshelf')!;
      const empty = applyVariant(shelf, 0);
      expect(empty.faces.front).toBe('chiseled_bookshelf_empty.png');
    });

    it('full variant uses chiseled_bookshelf_occupied.png', () => {
      const shelf = getBlockByName('Chiseled Bookshelf')!;
      const full = applyVariant(shelf, 6);
      expect(full.faces.front).toBe('chiseled_bookshelf_occupied.png');
    });

    it('partial variants use bookshelf_slots:N format', () => {
      const shelf = getBlockByName('Chiseled Bookshelf')!;
      for (let i = 1; i <= 5; i++) {
        const variant = applyVariant(shelf, i);
        expect(variant.faces.front).toBe(`bookshelf_slots:${i}`);
      }
    });
  });
});
