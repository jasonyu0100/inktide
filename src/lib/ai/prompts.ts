/**
 * Re-export wrapper for backward compatibility.
 *
 * All prompts have been centralized in src/lib/prompts/.
 * This file re-exports everything to maintain existing import paths.
 *
 * New code should import directly from '@/lib/prompts'.
 */

export * from '../prompts';
