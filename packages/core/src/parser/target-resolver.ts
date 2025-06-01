// packages/core/src/utils/target-resolver.ts (o simile)

import { WorldType, EntityId } from '../common/types.js';
import { DescriptionComponent, DESCRIPTION_COMPONENT_TYPE } from '../common/types.js';
import { getComponent } from '../state/state-dispatcher.js';

/**
 * Resolves a target string into a specific EntityId from a list of candidates.
 * Compares the target string with the name and keywords of the Description components
 * of the candidate entities.
 *
 * @param worldState The current state of the world.
 * @param candidateEntityIds An array of EntityId candidates (e.g. objects in the room).
 * @param targetString The text string used by the player to refer to the target.
 * @returns The EntityId of the found target, 'ambiguous' if there are multiple partial valid matches,
 * or null if no target is found.
 */
export function findTargetEntity(
  worldState: WorldType,
  candidateEntityIds: EntityId[],
  targetString: string
): EntityId | null | 'ambiguous' {

  if (!targetString || candidateEntityIds.length === 0) {
    return null;
  }

  const normalizedTargetString = targetString.trim().toLowerCase();
  if (!normalizedTargetString) return null;

  const matches: { entityId: EntityId; score: number; name: string }[] = [];

  for (const entityId of candidateEntityIds) {
    const description = getComponent<DescriptionComponent>(worldState, entityId, DESCRIPTION_COMPONENT_TYPE);
    if (!description) {
      continue; // The candidate entity does not have a description, it cannot be targeted by name
    }

    const entityName = description.name.toLowerCase();
    const entityKeywords = description.keywords.map(kw => kw.toLowerCase());

    let currentScore = 0;

    // Scoring strategy (simple, to be refined)
    // 1. Exact name match (high score)
    if (entityName === normalizedTargetString) {
      currentScore = 100;
    } else {
      // 2. The target string starts with the entity name or vice versa
      // (to handle "sword" vs "long sword")
      if (normalizedTargetString.startsWith(entityName)) {
        currentScore = Math.max(currentScore, 80 + (entityName.length / normalizedTargetString.length) * 10); // Weight by length
      } else if (entityName.startsWith(normalizedTargetString)) {
        currentScore = Math.max(currentScore, 70 + (normalizedTargetString.length / entityName.length) * 10);
      }

      // 3. Count the keywords of the target present in the entity name/keywords
      //    and vice versa. This is a bit more complex to do well without
      //    advanced NLP techniques. For now, a simpler approach:
      //    If all words of the targetString are in the keywords or the entity name
      const targetWords = normalizedTargetString.split(/\s+/);
      let allTargetWordsFound = true;
      for (const word of targetWords) {
        if (!entityName.includes(word) && !entityKeywords.some(kw => kw.includes(word))) {
          allTargetWordsFound = false;
          break;
        }
      }
      if (allTargetWordsFound && targetWords.length > 0) {
        // Give a base score if all words are found, higher if there are more words
        currentScore = Math.max(currentScore, 50 + targetWords.length * 5);
      }

      // 4. A partial match with single keywords (lower score)
      //    (es. 'spada' matcha 'spada di ferro' e 'spada di legno')
      //    If at least one keyword of the entity is in the targetString.
      for (const kw of entityKeywords) {
        if (normalizedTargetString.includes(kw)) {
          currentScore = Math.max(currentScore, 20 + kw.length); // Base score plus keyword length
          break; // Found a keyword, enough for this level of match
        }
      }
    }


    if (currentScore > 0) {
      matches.push({ entityId, score: currentScore, name: description.name });
    }
  }

  if (matches.length === 0) {
    return null; // No match  
  }

  // Sort matches by score in descending order
  matches.sort((a, b) => b.score - a.score);

  // Disambiguation logic (simple for now)
  // If the best match has a significantly higher score than the second,
  // or if it is the only match with a decent score.
  if (matches.length === 1 && matches[0].score >= 50) { // Threshold for a "decent" match
    console.log(`[findTargetEntity] Matched '${normalizedTargetString}' to '${matches[0].name}' (ID: ${matches[0].entityId}) with score ${matches[0].score}`);
    return matches[0].entityId;
  }

  if (matches.length > 1) {
    console.log(`[findTargetEntity] Potential matches for '${normalizedTargetString}':`, matches.map(m => `${m.name}(${m.score})`));
    // If the first has a significantly higher score than the second, we take it
    if (matches[0].score > 70 && matches[0].score > matches[1].score + 20) {
      console.log(`[findTargetEntity] Best match selected: '${matches[0].name}'`);
      return matches[0].entityId;
    }
    // Otherwise, if there are multiple matches with similar high scores, it is ambiguous
    if (matches[0].score >= 50 && matches[1].score >= 50 && Math.abs(matches[0].score - matches[1].score) <= 20) {
      console.log(`[findTargetEntity] Ambiguous match for '${normalizedTargetString}'.`);
      return 'ambiguous';
    }
    // If only the first has a decent score, and the others are much lower
    if (matches[0].score >= 50 && matches[1].score < 40) {
      console.log(`[findTargetEntity] Best match (weak alternatives) selected: '${matches[0].name}'`);
      return matches[0].entityId;
    }
  }

  // If we get here with a single match but low, or unclear situation
  if (matches[0].score >= 20) { // Minimum threshold to consider it a "attempt"
    console.log(`[findTargetEntity] Weak or uncertain match for '${normalizedTargetString}', best was '${matches[0].name}' (ID: ${matches[0].entityId}) with score ${matches[0].score}. Considering null.`);
    // We could decide to return the best even if weak, or null. For now, null if not strong.
    if (matches[0].score < 50) return null; // If not a decent match, consider it not found
    return matches[0].entityId;
  }


  return null; // No good match
}