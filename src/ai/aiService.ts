import type {
  GameState,
  Action,
  GemColor,
  NobleTile,
  DevelopmentCard,
} from '../game/types';
import type { AiAction, AiConfig, AiResponse, AiMoveResult } from './aiTypes';
import { COLORED_GEMS } from '../game/constants';
import { getPlayerBonuses, getPlayerPoints, getEffectiveCost, canAfford } from '../game/selectors';
import { getToken } from '../online/socketClient';

// ── Abbreviation Maps ───────────────────────────────────────

function compactGems(gems: Partial<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [color, count] of Object.entries(gems)) {
    if (count && count > 0) out[color] = count;
  }
  return out;
}

// ── Prompt Builders ─────────────────────────────────────────

export function buildSystemPrompt(playerIndex: 0 | 1 = 1): string {
  return `You are an expert Splendor board game AI playing as Player ${playerIndex + 1}. Your goal is to win by reaching 15 prestige points before your opponent.

RULES SUMMARY:
- On your turn, choose ONE action: take gems, buy a card, or reserve a card.
- Take 3 different colored gems, or 2 of the same color (if 4+ in supply).
- Buy a card using gems (bonuses from purchased cards reduce costs, gold is wild).
- Reserve a card to your hand (max 3 reserved) and receive 1 gold gem if available.
- Max 10 gems in hand; discard down if over.
- Nobles visit automatically when you meet their bonus requirements (3 prestige each).

STRATEGY PRIORITIES (in order):
1. BUY CARDS whenever you can afford one — this is the MOST important action. Cards give permanent bonuses that reduce future costs and earn prestige points. Hoarding gems without buying is a losing strategy.
2. Prefer cards that give prestige points AND bonuses you need for nobles or expensive cards.
3. Engine-building: cheap tier-1 cards with useful bonuses are very valuable early.
4. PLAN AHEAD: Check the PLANNING section — it shows cards you can't yet afford and exactly which gems you still need. Take gems that move you toward buying a specific high-value card in 1-2 turns.
5. WATCH YOUR OPPONENT: Check the OPPONENT THREATS section — it shows cards your opponent can afford or is close to buying. If they're about to buy a card you also want, consider reserving it to block them. If they're close to reaching 15 points, prioritize points over engine-building.
6. Reserve cards to block opponents who are close to buying high-value cards, or to secure cards you'll buy soon.

RESPONSE FORMAT:
Respond with ONLY a raw JSON object. No markdown code blocks, no backticks, no explanation text.

{
  "reasoning": ["bullet 1", "bullet 2", "bullet 3"],
  "action": <one of the legal actions provided>
}

Action schemas:
- {"type":"purchaseCard","cardId":"1-K-01"} — buy a visible or reserved card by ID
- {"type":"takeGems","colors":["red","blue","green"]} — take 1-3 distinct colored gems
- {"type":"take2Gems","color":"red"} — take 2 of one color (supply must have 4+)
- {"type":"reserveCard","cardId":"1-K-01"} — reserve a visible card by ID
- {"type":"reserveCard","fromDeck":1} — reserve top card from deck tier (1/2/3)

CRITICAL: Output ONLY the JSON object. No markdown, no \`\`\`, no text before or after.`;
}

export function buildGameStatePrompt(state: GameState, aiPlayerIndex: 0 | 1 = 1): string {
  const me = state.players[aiPlayerIndex];
  const them = state.players[aiPlayerIndex === 0 ? 1 : 0];
  const myBonuses = getPlayerBonuses(me);
  const theirBonuses = getPlayerBonuses(them);
  const myLabel = `You (P${aiPlayerIndex + 1})`;
  const oppLabel = `Opponent (P${aiPlayerIndex === 0 ? 2 : 1})`;

  const serializePlayer = (p: typeof me, bonuses: typeof myBonuses, label: string) => ({
    name: label,
    pts: getPlayerPoints(p),
    gems: compactGems(p.gems),
    bonuses: compactGems(bonuses),
    reserved: p.reserved.map(c => ({
      id: c.id,
      tier: c.tier,
      pts: c.prestigePoints,
      bonus: c.gemBonus,
      cost: compactGems(c.cost),
    })),
    purchased: p.purchased.map(c => ({
      pts: c.prestigePoints,
      bonus: c.gemBonus,
    })),
  });

  const serializeCard = (c: DevelopmentCard) => ({
    id: c.id,
    pts: c.prestigePoints,
    bonus: c.gemBonus,
    cost: compactGems(c.cost),
  });

  const gameState = {
    you: serializePlayer(me, myBonuses, myLabel),
    opp: serializePlayer(them, theirBonuses, oppLabel),
    board: {
      gems: compactGems(state.board.gemSupply),
      tier1: state.board.visibleCards[0].map(serializeCard),
      tier2: state.board.visibleCards[1].map(serializeCard),
      tier3: state.board.visibleCards[2].map(serializeCard),
      deckSizes: [
        state.board.decks[0].length,
        state.board.decks[1].length,
        state.board.decks[2].length,
      ],
      nobles: state.board.nobles.map(n => ({
        id: n.id,
        pts: n.prestigePoints,
        req: compactGems(n.requirement),
      })),
    },
  };

  // Build planning section: cards not yet affordable with remaining cost
  const planning = buildPlanningSection(state, me);
  const threats = buildOpponentThreatsSection(state, them);

  return `Current game state:\n${JSON.stringify(gameState)}${planning}${threats}`;
}

function buildPlanningSection(state: GameState, player: typeof state.players[0]): string {
  const lines: string[] = ['\n\nPLANNING — cards you CANNOT yet afford (effective remaining cost after your bonuses):'];
  let count = 0;

  for (let tier = 0; tier < 3; tier++) {
    for (const card of state.board.visibleCards[tier]) {
      if (canAfford(card, player)) continue;
      const eff = getEffectiveCost(card, player);
      const stillNeed: Record<string, number> = {};
      for (const color of COLORED_GEMS) {
        const need = eff[color] ?? 0;
        const have = player.gems[color];
        if (need > have) {
          stillNeed[color] = need - have;
        }
      }
      if (Object.keys(stillNeed).length === 0) continue;
      const needStr = Object.entries(stillNeed).map(([k, v]) => `${k}:${v}`).join(', ');
      lines.push(`  ${card.id} (${card.prestigePoints}pts, bonus=${card.gemBonus}, still need: {${needStr}})`);
      count++;
    }
  }

  // Also include reserved cards that aren't affordable
  for (const card of player.reserved) {
    if (canAfford(card, player)) continue;
    const eff = getEffectiveCost(card, player);
    const stillNeed: Record<string, number> = {};
    for (const color of COLORED_GEMS) {
      const need = eff[color] ?? 0;
      const have = player.gems[color];
      if (need > have) {
        stillNeed[color] = need - have;
      }
    }
    if (Object.keys(stillNeed).length === 0) continue;
    const needStr = Object.entries(stillNeed).map(([k, v]) => `${k}:${v}`).join(', ');
    lines.push(`  ${card.id} [RESERVED] (${card.prestigePoints}pts, bonus=${card.gemBonus}, still need: {${needStr}})`);
    count++;
  }

  if (count === 0) return '';
  lines.push('TIP: Take gems matching these "still need" costs to buy these cards in upcoming turns.');
  return lines.join('\n');
}

function buildOpponentThreatsSection(state: GameState, opponent: typeof state.players[0]): string {
  const canBuy: string[] = [];
  const closeLines: string[] = [];

  const allVisible = [
    ...state.board.visibleCards[0],
    ...state.board.visibleCards[1],
    ...state.board.visibleCards[2],
  ];

  for (const card of allVisible) {
    if (canAfford(card, opponent)) {
      canBuy.push(`  ${card.id} (${card.prestigePoints}pts, bonus=${card.gemBonus})`);
    } else {
      const eff = getEffectiveCost(card, opponent);
      const stillNeed: Record<string, number> = {};
      let totalNeeded = 0;
      for (const color of COLORED_GEMS) {
        const need = eff[color] ?? 0;
        const have = opponent.gems[color];
        if (need > have) {
          stillNeed[color] = need - have;
          totalNeeded += need - have;
        }
      }
      // "Close" = needs 1-2 more gems total
      if (totalNeeded > 0 && totalNeeded <= 2) {
        const needStr = Object.entries(stillNeed).map(([k, v]) => `${k}:${v}`).join(', ');
        closeLines.push(`  ${card.id} (${card.prestigePoints}pts, bonus=${card.gemBonus}, needs: {${needStr}})`);
      }
    }
  }

  // Also check opponent's reserved cards
  for (const card of opponent.reserved) {
    if (canAfford(card, opponent)) {
      canBuy.push(`  ${card.id} [RESERVED] (${card.prestigePoints}pts, bonus=${card.gemBonus})`);
    } else {
      const eff = getEffectiveCost(card, opponent);
      const stillNeed: Record<string, number> = {};
      let totalNeeded = 0;
      for (const color of COLORED_GEMS) {
        const need = eff[color] ?? 0;
        const have = opponent.gems[color];
        if (need > have) {
          stillNeed[color] = need - have;
          totalNeeded += need - have;
        }
      }
      if (totalNeeded > 0 && totalNeeded <= 2) {
        const needStr = Object.entries(stillNeed).map(([k, v]) => `${k}:${v}`).join(', ');
        closeLines.push(`  ${card.id} [RESERVED] (${card.prestigePoints}pts, bonus=${card.gemBonus}, needs: {${needStr}})`);
      }
    }
  }

  // Check which nobles the opponent is close to
  const nobleThreats: string[] = [];
  for (const noble of state.board.nobles) {
    const oppBonuses = getPlayerBonuses(opponent);
    let totalMissing = 0;
    const missing: Record<string, number> = {};
    for (const [color, required] of Object.entries(noble.requirement)) {
      const have = oppBonuses[color as keyof typeof oppBonuses] ?? 0;
      if (required && have < required) {
        missing[color] = required - have;
        totalMissing += required - have;
      }
    }
    if (totalMissing <= 2) {
      const label = totalMissing === 0 ? 'QUALIFIES NOW' : `needs: {${Object.entries(missing).map(([k, v]) => `${k}:${v}`).join(', ')}}`;
      nobleThreats.push(`  ${noble.id} (${noble.prestigePoints}pts, ${label})`);
    }
  }

  if (canBuy.length === 0 && closeLines.length === 0 && nobleThreats.length === 0) return '';

  const lines: string[] = ['\n\nOPPONENT THREATS — what your opponent can do:'];
  if (canBuy.length > 0) {
    lines.push('Cards opponent CAN AFFORD right now (consider reserving high-value ones to block):');
    lines.push(...canBuy);
  }
  if (closeLines.length > 0) {
    lines.push('Cards opponent is CLOSE to buying (1-2 gems away):');
    lines.push(...closeLines);
  }
  if (nobleThreats.length > 0) {
    lines.push('Nobles opponent is close to earning (0-2 bonuses away):');
    lines.push(...nobleThreats);
  }
  const oppPts = getPlayerPoints(opponent);
  if (oppPts >= 12) {
    lines.push(`WARNING: Opponent has ${oppPts} points — they are close to winning! Prioritize points over engine-building.`);
  }
  return lines.join('\n');
}

export function buildLegalMovesPrompt(actions: Action[]): string {
  const takeGems: string[] = [];
  const take2: string[] = [];
  const reserve: string[] = [];
  const reserveDeck: string[] = [];
  const purchase: string[] = [];

  for (const a of actions) {
    switch (a.type) {
      case 'takeGems':
        takeGems.push(a.colors.join(','));
        break;
      case 'take2Gems':
        take2.push(a.color);
        break;
      case 'reserveCard':
        if ('fromDeck' in a.source) {
          reserveDeck.push(`tier ${a.source.fromDeck}`);
        } else {
          reserve.push(a.source.id);
        }
        break;
      case 'purchaseCard': {
        const c = a.card;
        const costStr = Object.entries(c.cost)
          .filter(([, v]) => v && v > 0)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
        purchase.push(`${c.id} (${c.prestigePoints}pts, bonus=${c.gemBonus}, cost={${costStr}})`);
        break;
      }
    }
  }

  const lines: string[] = ['Legal moves:'];

  if (purchase.length > 0) {
    lines.push(`Purchase — YOU CAN AFFORD these cards (buy one with {"type":"purchaseCard","cardId":"<id>"}):`);
    for (const p of purchase) {
      lines.push(`  ${p}`);
    }
  }
  if (takeGems.length > 0) {
    lines.push(`Take 3 gems — combos: ${takeGems.join(' | ')}`);
  }
  if (take2.length > 0) {
    lines.push(`Take 2 gems — colors: ${take2.join(', ')}`);
  }
  if (reserve.length > 0) {
    lines.push(`Reserve visible — cards: ${reserve.join(', ')}`);
  }
  if (reserveDeck.length > 0) {
    lines.push(`Reserve from deck — ${reserveDeck.join(', ')}`);
  }

  return lines.join('\n');
}

export function buildDiscardPrompt(
  playerGems: Record<GemColor, number>,
  excessCount: number,
): string {
  // Show gems with full color names so the AI uses them in the response
  const gemsList = Object.entries(playerGems)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  return `You have too many gems (max 10). Current gems: {${gemsList}}
You must discard exactly ${excessCount} gem(s).

Respond with ONLY a JSON object (no markdown, no explanation):
{"reasoning":["why you chose these gems to discard"],"action":{"type":"discardGems","gems":{"<color>":<count>}}}

Example: {"reasoning":["Discard excess red"],"action":{"type":"discardGems","gems":{"red":2}}}

Use FULL color names: white, blue, green, red, black, gold.`;
}

export function buildNobleSelectionPrompt(nobles: NobleTile[]): string {
  const listed = nobles.map(n => `${n.id} (${n.prestigePoints}pts)`).join(', ');
  return `You qualify for multiple nobles. Choose one: ${listed}

Respond with ONLY a JSON object (no markdown, no explanation):
{"reasoning":["why you chose this noble"],"action":{"type":"selectNoble","nobleId":"<id>"}}

Example: {"reasoning":["Higher point value"],"action":{"type":"selectNoble","nobleId":"N-01"}}`;
}

// ── Response Parsing ────────────────────────────────────────

export function parseAiResponse(
  responseText: string,
  legalActions: Action[],
): AiResponse {
  let parsed: { reasoning?: string[]; action?: AiAction };

  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      responseText.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      reasoning: ['AI returned malformed JSON — using fallback move.'],
      action: legalActionToAiAction(legalActions[0]),
    };
  }

  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.map(String).slice(0, 5)
    : ['No reasoning provided.'];

  if (!parsed.action || !parsed.action.type) {
    return {
      reasoning: [...reasoning, 'AI returned no action — using fallback move.'],
      action: legalActionToAiAction(legalActions[0]),
    };
  }

  // Validate the action is legal
  if (isActionLegal(parsed.action, legalActions)) {
    return { reasoning, action: parsed.action };
  }

  return {
    reasoning: [...reasoning, 'AI chose an illegal move — using fallback.'],
    action: legalActionToAiAction(legalActions[0]),
  };
}

function legalActionToAiAction(action: Action): AiAction {
  switch (action.type) {
    case 'takeGems':
      return { type: 'takeGems', colors: action.colors };
    case 'take2Gems':
      return { type: 'take2Gems', color: action.color };
    case 'purchaseCard':
      return { type: 'purchaseCard', cardId: action.card.id };
    case 'reserveCard':
      if ('fromDeck' in action.source) {
        return { type: 'reserveCard', fromDeck: action.source.fromDeck };
      }
      return { type: 'reserveCard', cardId: action.source.id };
    case 'discardGems':
      return { type: 'discardGems', gems: action.gems as Partial<Record<GemColor, number>> };
    case 'selectNoble':
      return { type: 'selectNoble', nobleId: action.noble.id };
  }
}

function isActionLegal(aiAction: AiAction, legalActions: Action[]): boolean {
  for (const legal of legalActions) {
    if (aiAction.type !== legal.type) continue;

    switch (aiAction.type) {
      case 'takeGems':
        if (legal.type === 'takeGems') {
          const aiSorted = [...aiAction.colors].sort();
          const legalSorted = [...legal.colors].sort();
          if (aiSorted.length === legalSorted.length &&
              aiSorted.every((c, i) => c === legalSorted[i])) {
            return true;
          }
        }
        break;
      case 'take2Gems':
        if (legal.type === 'take2Gems' && aiAction.color === legal.color) {
          return true;
        }
        break;
      case 'purchaseCard':
        if (legal.type === 'purchaseCard' && aiAction.cardId === legal.card.id) {
          return true;
        }
        break;
      case 'reserveCard':
        if (legal.type === 'reserveCard') {
          if ('cardId' in aiAction && !('fromDeck' in aiAction) &&
              !('fromDeck' in legal.source) && aiAction.cardId === legal.source.id) {
            return true;
          }
          if ('fromDeck' in aiAction && 'fromDeck' in legal.source &&
              aiAction.fromDeck === legal.source.fromDeck) {
            return true;
          }
        }
        break;
    }
  }
  return false;
}

// ── API Calls ───────────────────────────────────────────────

function buildMessages(systemPrompt: string, userPrompt: string, config: AiConfig) {
  if (config.provider === 'anthropic') {
    return {
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };
  }
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
}

async function callAiProxy(
  config: AiConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const body = {
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    ...buildMessages(systemPrompt, userPrompt, config),
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`AI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();

  // Extract text from provider-specific response formats
  if (config.provider === 'anthropic') {
    // Anthropic: { content: [{ type: "text", text: "..." }] }
    return data.content?.[0]?.text ?? JSON.stringify(data);
  }
  if (config.provider === 'gemini') {
    // Gemini: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
  }
  // OpenAI / OpenRouter / custom: { choices: [{ message: { content: "..." } }] }
  return data.choices?.[0]?.message?.content ?? JSON.stringify(data);
}

export async function getAiMove(
  state: GameState,
  legalActions: Action[],
  config: AiConfig,
  aiPlayerIndex: 0 | 1 = 1,
): Promise<AiMoveResult> {
  const systemPrompt = buildSystemPrompt(aiPlayerIndex);
  const userPrompt = buildGameStatePrompt(state, aiPlayerIndex) + '\n\n' + buildLegalMovesPrompt(legalActions);

  const start = Date.now();
  const responseText = await callAiProxy(config, systemPrompt, userPrompt);
  const responseTimeMs = Date.now() - start;

  return { ...parseAiResponse(responseText, legalActions), responseTimeMs };
}

export async function getAiDiscardDecision(
  playerGems: Record<GemColor, number>,
  excessCount: number,
  config: AiConfig,
  aiPlayerIndex: 0 | 1 = 1,
): Promise<AiMoveResult> {
  const systemPrompt = buildSystemPrompt(aiPlayerIndex);
  const userPrompt = buildDiscardPrompt(playerGems, excessCount);

  const start = Date.now();
  const responseText = await callAiProxy(config, systemPrompt, userPrompt);
  const responseTimeMs = Date.now() - start;

  let parsed: { reasoning?: string[]; action?: AiAction };
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      responseText.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback: discard evenly from highest counts
    return {
      reasoning: ['AI returned malformed JSON for discard — using fallback.'],
      action: buildFallbackDiscard(playerGems, excessCount),
      responseTimeMs,
    };
  }

  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.map(String).slice(0, 5)
    : ['No reasoning provided.'];

  if (parsed.action?.type === 'discardGems' && parsed.action.gems) {
    return { reasoning, action: parsed.action, responseTimeMs };
  }

  return {
    reasoning: [...reasoning, 'Invalid discard action — using fallback.'],
    action: buildFallbackDiscard(playerGems, excessCount),
    responseTimeMs,
  };
}

function buildFallbackDiscard(
  playerGems: Record<GemColor, number>,
  excessCount: number,
): AiAction {
  const gems: Partial<Record<GemColor, number>> = {};
  const colors = ([...COLORED_GEMS, 'gold'] as GemColor[])
    .filter(c => playerGems[c] > 0)
    .sort((a, b) => playerGems[b] - playerGems[a]);

  let remaining = excessCount;
  for (const color of colors) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, playerGems[color]);
    if (take > 0) {
      gems[color] = take;
      remaining -= take;
    }
  }

  return { type: 'discardGems', gems };
}

export async function getAiNobleSelection(
  nobles: NobleTile[],
  config: AiConfig,
  aiPlayerIndex: 0 | 1 = 1,
): Promise<AiMoveResult> {
  const systemPrompt = buildSystemPrompt(aiPlayerIndex);
  const userPrompt = buildNobleSelectionPrompt(nobles);

  const start = Date.now();
  const responseText = await callAiProxy(config, systemPrompt, userPrompt);
  const responseTimeMs = Date.now() - start;

  let parsed: { reasoning?: string[]; action?: AiAction };
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      responseText.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      reasoning: ['AI returned malformed JSON for noble selection — picking first.'],
      action: { type: 'selectNoble', nobleId: nobles[0].id },
      responseTimeMs,
    };
  }

  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.map(String).slice(0, 5)
    : ['No reasoning provided.'];

  if (parsed.action?.type === 'selectNoble' && parsed.action.nobleId) {
    const valid = nobles.some(n => n.id === (parsed.action as { type: 'selectNoble'; nobleId: string }).nobleId);
    if (valid) {
      return { reasoning, action: parsed.action, responseTimeMs };
    }
  }

  return {
    reasoning: [...reasoning, 'Invalid noble selection — picking first eligible.'],
    action: { type: 'selectNoble', nobleId: nobles[0].id },
    responseTimeMs,
  };
}
