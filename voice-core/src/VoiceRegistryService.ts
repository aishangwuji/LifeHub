/**
 * Voice Provider Registry Service.
 * Manages registration and lookup of real-time voice providers (drivers).
 * Extends Cordis Service for proper lifecycle management.
 *
 * @module @lifecordis/voice-core/VoiceRegistryService
 */

import { Context, Service } from '@deepseek-ai/cordis';
import type { IRealtimeVoiceProvider, VoiceProviderConfig } from './types.js';

/**
 * Service for registering and managing voice providers.
 * Extends Cordis Service to participate in the service lifecycle.
 */
export class VoiceRegistryService extends Service {
  private providers = new Map<string, () => IRealtimeVoiceProvider>();
  private activeProviderId: string | null = null;

  constructor(ctx: Context) {
    // Third parameter `true` (immediate) is critical: tells Cordis the service is ready immediately after construction
    super(ctx, 'voiceRegistry', true);
  }

  /**
   * Register a voice provider.
   * @param id - Provider ID.
   * @param factory - Factory function that creates the provider instance.
   * @param meta - Provider metadata (name).
   */
  register(id: string, factory: () => IRealtimeVoiceProvider, meta?: { name: string }): void {
    this.providers.set(id, factory);
    if (!this.activeProviderId) {
      this.activeProviderId = id;
    }
    this.ctx.logger.info(`voice-core: registered provider "${id}"`);
  }

  /**
   * Unregister a voice provider.
   * @param id - Provider ID to unregister.
   */
  unregister(id: string): void {
    if (this.providers.delete(id)) {
      this.ctx.logger.info(`voice-core: unregistered provider "${id}"`);
      if (this.activeProviderId === id) {
        const next = this.providers.keys().next().value;
        this.activeProviderId = next ?? null;
      }
    }
  }

  /**
   * Clear all registered providers.
   */
  clear(): void {
    this.providers.clear();
    this.activeProviderId = null;
    this.ctx.logger.info('voice-core: all providers cleared');
  }

  /**
   * Get a provider instance by ID.
   * @param id - Provider ID.
   * @returns Provider instance or null if not found.
   */
  get(id: string): IRealtimeVoiceProvider | null {
    const factory = this.providers.get(id);
    return factory ? factory() : null;
  }

  /**
   * Get the currently active provider instance.
   * @returns Active provider instance or null.
   */
  getActive(): IRealtimeVoiceProvider | null {
    if (!this.activeProviderId) return null;
    return this.get(this.activeProviderId);
  }

  /**
   * Get the active provider ID.
   */
  getActiveId(): string | null {
    return this.activeProviderId;
  }

  /**
   * Set the active provider.
   * @param id - Provider ID to activate.
   */
  setActive(id: string): boolean {
    if (this.providers.has(id)) {
      this.activeProviderId = id;
      return true;
    }
    return false;
  }

  /**
   * Get all available provider IDs.
   */
  list(): Array<{ id: string; name?: string }> {
    return Array.from(this.providers.keys()).map((id) => ({ id }));
  }
}

// Extend Cordis Context with voiceRegistry service
declare module '@deepseek-ai/cordis' {
  interface Context {
    voiceRegistry: VoiceRegistryService;
  }
}