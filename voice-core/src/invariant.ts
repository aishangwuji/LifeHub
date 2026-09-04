/**
 * Invariant registration for voice-core.
 * Declares package ownership for the Cordis invariants system.
 *
 * @module @lifecordis/voice-core/invariant
 */

import type { Context } from '@deepseek-ai/cordis';
import { name, inject } from './index.js';

const PACKAGE_NAME = '@lifecordis/voice-core';

/**
 * Install function for invariants.
 * Currently a no-op, but reserves the package name in the invariants system.
 */
async function install(ctx: Context): Promise<void> {
  // Register package ownership
  ctx.logger.info(`voice-core: invariant registered for ${PACKAGE_NAME}`);
}

export const apply = install;
export { name, inject };