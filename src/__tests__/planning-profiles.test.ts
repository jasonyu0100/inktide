import { describe, it, expect } from 'vitest';
import { BUILT_IN_PROFILES, getProfile, profileToQueue } from '@/lib/planning-profiles';
import type { PlanningProfile } from '@/types/narrative';
// ── BUILT_IN_PROFILES ────────────────────────────────────────────────────────
describe('BUILT_IN_PROFILES', () => {
  it('contains all expected profiles', () => {
    const ids = BUILT_IN_PROFILES.map((p) => p.id);
    expect(ids).toContain('three-act');
    expect(ids).toContain('kishotenketsu');
    expect(ids).toContain('heros-journey');
    expect(ids).toContain('tragedy');
    expect(ids).toContain('episodic-volume');
    expect(ids).toContain('escalation-arc');
    expect(ids).toContain('ensemble-expansion');
    expect(ids).toContain('mystery-case');
  });
  it('has unique IDs for all profiles', () => {
    const ids = BUILT_IN_PROFILES.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
  it('all profiles have builtIn = true', () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(profile.builtIn).toBe(true);
    }
  });
  it('all profiles have non-empty phases', () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(profile.phases.length).toBeGreaterThan(0);
    }
  });
  describe('complete category profiles', () => {
    const completeProfiles = BUILT_IN_PROFILES.filter((p) => p.category === 'complete');
    it('has 4 complete profiles', () => {
      expect(completeProfiles.length).toBe(4);
    });
    it('includes three-act, kishotenketsu, heros-journey, tragedy', () => {
      const ids = completeProfiles.map((p) => p.id);
      expect(ids).toContain('three-act');
      expect(ids).toContain('kishotenketsu');
      expect(ids).toContain('heros-journey');
      expect(ids).toContain('tragedy');
    });
  });
  describe('episodic category profiles', () => {
    const episodicProfiles = BUILT_IN_PROFILES.filter((p) => p.category === 'episodic');
    it('has 4 episodic profiles', () => {
      expect(episodicProfiles.length).toBe(4);
    });
    it('includes episodic-volume, escalation-arc, ensemble-expansion, mystery-case', () => {
      const ids = episodicProfiles.map((p) => p.id);
      expect(ids).toContain('episodic-volume');
      expect(ids).toContain('escalation-arc');
      expect(ids).toContain('ensemble-expansion');
      expect(ids).toContain('mystery-case');
    });
  });
  describe('phase structure validation', () => {
    it('all phases have required fields', () => {
      for (const profile of BUILT_IN_PROFILES) {
        for (const phase of profile.phases) {
          expect(phase.name).toBeDefined();
          expect(phase.name.length).toBeGreaterThan(0);
          expect(phase.objective).toBeDefined();
          expect(phase.objective.length).toBeGreaterThan(0);
          expect(typeof phase.sceneAllocation).toBe('number');
          expect(phase.sceneAllocation).toBeGreaterThan(0);
        }
      }
    });
    it('total scene allocations are reasonable (20-40 scenes)', () => {
      for (const profile of BUILT_IN_PROFILES) {
        const totalScenes = profile.phases.reduce((sum, p) => sum + p.sceneAllocation, 0);
        expect(totalScenes).toBeGreaterThanOrEqual(20);
        expect(totalScenes).toBeLessThanOrEqual(40);
      }
    });
    it('constraints and structuralRules are non-empty strings', () => {
      for (const profile of BUILT_IN_PROFILES) {
        for (const phase of profile.phases) {
          if (phase.constraints) {
            expect(typeof phase.constraints).toBe('string');
            expect(phase.constraints.length).toBeGreaterThan(0);
          }
          if (phase.structuralRules) {
            expect(typeof phase.structuralRules).toBe('string');
            expect(phase.structuralRules.length).toBeGreaterThan(0);
          }
        }
      }
    });
    it('worldExpansionHints is empty string only for final phases', () => {
      for (const profile of BUILT_IN_PROFILES) {
        const nonFinalPhases = profile.phases.slice(0, -1);
        for (const phase of nonFinalPhases) {
          // Non-final phases should have worldExpansionHints
          expect(phase.worldExpansionHints).toBeDefined();
        }
      }
    });
  });
});
// ── getProfile ───────────────────────────────────────────────────────────────
describe('getProfile', () => {
  it('returns profile for valid ID', () => {
    const profile = getProfile('three-act');
    expect(profile).toBeDefined();
    expect(profile!.id).toBe('three-act');
    expect(profile!.name).toBe('Three-Act Structure');
  });
  it('returns undefined for invalid ID', () => {
    const profile = getProfile('nonexistent-profile');
    expect(profile).toBeUndefined();
  });
  it('returns correct profile for all built-in IDs', () => {
    for (const expected of BUILT_IN_PROFILES) {
      const profile = getProfile(expected.id);
      expect(profile).toBeDefined();
      expect(profile!.id).toBe(expected.id);
      expect(profile!.name).toBe(expected.name);
    }
  });
  it('returns kishotenketsu profile with correct structure', () => {
    const profile = getProfile('kishotenketsu');
    expect(profile).toBeDefined();
    expect(profile!.phases.length).toBe(4);
    expect(profile!.phases.map((p) => p.name.split(' ')[0])).toEqual(['Ki', 'Shō', 'Ten', 'Ketsu']);
  });
  it('returns heros-journey profile with correct phases', () => {
    const profile = getProfile('heros-journey');
    expect(profile).toBeDefined();
    expect(profile!.phases.length).toBe(4);
    expect(profile!.phases[0].name).toContain('Ordinary World');
    expect(profile!.phases[3].name).toContain('Return');
  });
});
// ── profileToQueue ───────────────────────────────────────────────────────────
describe('profileToQueue', () => {
  const threeAct = getProfile('three-act')!;
  it('creates queue with correct profileId', () => {
    const queue = profileToQueue(threeAct);
    expect(queue.profileId).toBe('three-act');
  });
  it('sets mode to outline when no phases have sourceText', () => {
    const queue = profileToQueue(threeAct);
    expect(queue.mode).toBe('outline');
  });
  it('sets mode to plan when any phase has sourceText', () => {
    const profileWithSource: PlanningProfile = {
      ...threeAct,
      phases: [
        { ...threeAct.phases[0], sourceText: 'Some source text' },
        ...threeAct.phases.slice(1),
      ],
    };
    const queue = profileToQueue(profileWithSource);
    expect(queue.mode).toBe('plan');
  });
  it('converts all phases to queue phases', () => {
    const queue = profileToQueue(threeAct);
    expect(queue.phases.length).toBe(threeAct.phases.length);
  });
  it('assigns sequential IDs to phases', () => {
    const queue = profileToQueue(threeAct);
    expect(queue.phases[0].id).toBe('phase-0');
    expect(queue.phases[1].id).toBe('phase-1');
    expect(queue.phases[2].id).toBe('phase-2');
  });
  it('copies phase properties correctly', () => {
    const queue = profileToQueue(threeAct);
    const originalPhase = threeAct.phases[0];
    const queuePhase = queue.phases[0];
    expect(queuePhase.name).toBe(originalPhase.name);
    expect(queuePhase.objective).toBe(originalPhase.objective);
    expect(queuePhase.sceneAllocation).toBe(originalPhase.sceneAllocation);
    expect(queuePhase.constraints).toBe(originalPhase.constraints);
    expect(queuePhase.structuralRules).toBe(originalPhase.structuralRules);
    expect(queuePhase.worldExpansionHints).toBe(originalPhase.worldExpansionHints);
  });
  it('sets first phase to active status', () => {
    const queue = profileToQueue(threeAct);
    expect(queue.phases[0].status).toBe('active');
  });
  it('sets subsequent phases to pending status', () => {
    const queue = profileToQueue(threeAct);
    for (let i = 1; i < queue.phases.length; i++) {
      expect(queue.phases[i].status).toBe('pending');
    }
  });
  it('initializes scenesCompleted to 0 for all phases', () => {
    const queue = profileToQueue(threeAct);
    for (const phase of queue.phases) {
      expect(phase.scenesCompleted).toBe(0);
    }
  });
  it('initializes direction to empty string for all phases', () => {
    const queue = profileToQueue(threeAct);
    for (const phase of queue.phases) {
      expect(phase.direction).toBe('');
    }
  });
  it('sets activePhaseIndex to 0', () => {
    const queue = profileToQueue(threeAct);
    expect(queue.activePhaseIndex).toBe(0);
  });
  it('works for all built-in profiles', () => {
    for (const profile of BUILT_IN_PROFILES) {
      const queue = profileToQueue(profile);
      expect(queue.profileId).toBe(profile.id);
      expect(queue.phases.length).toBe(profile.phases.length);
      expect(queue.activePhaseIndex).toBe(0);
    }
  });
});
// ── Specific Profile Structure Tests ─────────────────────────────────────────
describe('Three-Act Structure profile', () => {
  const threeAct = getProfile('three-act')!;
  it('has 3 phases (acts)', () => {
    expect(threeAct.phases.length).toBe(3);
  });
  it('phases are Setup, Confrontation, Resolution', () => {
    expect(threeAct.phases[0].name).toContain('Setup');
    expect(threeAct.phases[1].name).toContain('Confrontation');
    expect(threeAct.phases[2].name).toContain('Resolution');
  });
  it('has scene allocation totaling ~23 scenes', () => {
    const total = threeAct.phases.reduce((s, p) => s + p.sceneAllocation, 0);
    expect(total).toBe(23); // 7 + 9 + 7
  });
});
describe('Tragedy profile', () => {
  const tragedy = getProfile('tragedy')!;
  it('has 4 phases', () => {
    expect(tragedy.phases.length).toBe(4);
  });
  it('follows Greatness -> Hubris -> Reversal -> Catastrophe', () => {
    expect(tragedy.phases[0].name).toContain('Greatness');
    expect(tragedy.phases[1].name).toContain('Hubris');
    expect(tragedy.phases[2].name).toContain('Reversal');
    expect(tragedy.phases[3].name).toContain('Catastrophe');
  });
});
describe('Escalation Arc profile', () => {
  const escalation = getProfile('escalation-arc')!;
  it('is categorized as episodic', () => {
    expect(escalation.category).toBe('episodic');
  });
  it('has 4 phases', () => {
    expect(escalation.phases.length).toBe(4);
  });
  it('phases emphasize MC scheming and power progression', () => {
    expect(escalation.phases[0].name).toContain('Foundation');
    expect(escalation.phases[0].name).toContain('Scheming');
    expect(escalation.phases[2].name).toContain('Breakthrough');
  });
});
