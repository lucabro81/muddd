import { EntityId, RoomId } from '../common/types.js';

export enum EffectType {
  TEMPORARY_MODIFIER = 'TemporaryModifier',
}

// Interfaccia Effetto base
export interface Effect {
  type: EffectType;
  tags?: string[];
  target?: { type: 'ENTITY' | 'LOCATION'; id: EntityId | RoomId };
}