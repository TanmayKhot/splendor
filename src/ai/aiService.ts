import type {
  GameState,
  Action,
  GemColor,
  NobleTile,
  DevelopmentCard,
} from '../game/types';
import type { AiAction, AiConfig, AiResponse } from './aiTypes';
import { COLORED_GEMS } from '../game/constants';
import { getPlayerBonuses, getPlayerPoints } from '../game/selectors';

// ── Abbreviation Maps ───────────────────────────────────────

const GEM_ABBREV: Record<string, string> = {
  white: 'w',
  blue: 'u',
  green: 'g',
  red: 'r',
  black: 'k',
  gold: 'au',
};

function abbrevGems(gems: Partial<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [color, count] of Object.entries(gems)) {
    if (count && count > 0) out[GEM_ABBREV[color] ?? color] = count;
  }
  return out;
}

// ── Prompt Builders ─────────────────────────────────────────

export function buildSystemPrompt(): string {
  return `You are an expert Splendor board game AI playing as Player 2. Your goal is to win by reaching 15 prestige points before your opponent.

RULES SUMMARY:
- On your turn, choose ONE action: take gems, buy a card, or reserve a card.
- Take 3 different colored gems, or 2 of the same color (if 4+ in supply).
- Buy a card using gems (bonuses from purchased cards reduce costs, gold is wild).
- Reserve a card to your hand (max 3 reserved) and receive 1 gold gem if available.
- Max 10 gems in hand; discard down if over.
- Nobles visit automatically when you meet their bonus requirements (3 prestige each).

STRATEGY TIPS:
- Prioritize cards that give bonuses toward nobles or expensive cards you want.
- Engine-building: cheap cards with useful bonuses are very valuable early.
- Watch your opponent's progress and don't let them run away with nobles.

RESPOND WITH ONLY a JSON object matching this schema:
{
  "reasoning": ["bullet 1", "bullet 2", "bullet 3"],
  "action": <one of the legal actions provided>
}

Action schemas:
- {"type":"takeGems","colors":["red","blue","green"]} — take 1-3 distinct colored gems
- {"type":"take2Gems","color":"red"} — take 2 of one color (supply must have 4+)
- {"type":"purchaseCard","cardId":"1-K-01"} — buy a visible or reserved card by ID
- {"type":"reserveCard","cardId":"1-K-01"} — reserve a visible card by ID
- {"type":"reserveCard","fromDeck":1} — reserve top card from deck tier (1/2/3)

Do NOT include any text outside the JSON object.`;
}

export function buildGameStatePrompt(state: GameState): string {
  const p1 = state.players[0];
  const p2 = state.players[1];
  const b1 = getPlayerBonuses(p1);
  const b2 = getPlayerBonuses(p2);

  const serializePlayer = (p: typeof p1, bonuses: typeof b1, label: string) => ({
    name: label,
    pts: getPlayerPoints(p),
    gems: abbrevGems(p.gems),
    bonuses: abbrevGems(bonuses),
    reserved: p.reserved.map(c => ({
      id: c.id,
      tier: c.tier,
      pts: c.prestigePoints,
      bonus: GEM_ABBREV[c.gemBonus],
      cost: abbrevGems(c.cost),
    })),
    purchasedCount: p.purchased.length,
  });

  const serializeCard = (c: DevelopmentCard) => ({
    id: c.id,
    pts: c.prestigePoints,
    bonus: GEM_ABBREV[c.gemBonus],
    cost: abbrevGems(c.cost),
  });

  const gameState = {
    you: serializePlayer(p2, b2, 'You (P2)'),
    opp: serializePlayer(p1, b1, 'Opponent (P1)'),
    board: {
      gems: abbrevGems(state.board.gemSupply),
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
        req: abbrevGems(n.requirement),
      })),
    },
  };

  return `Current game state:\n${JSON.stringify(gameState)}`;
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
      case 'purchaseCard':
        purchase.push(a.card.id);
        break;
    }
  }

  const lines: string[] = ['Legal moves:'];

  if (takeGems.length > 0) {
    lines.push(`Take 3 gems — combos: ${takeGems.join(' | ')}`);
  }
  if (take2.length > 0) {
    lines.push(`Take 2 gems — colors: ${take2.join(', ')}`);
  }
  if (purchase.length > 0) {
    lines.push(`Purchase — cards: ${purchase.join(', ')}`);
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
  return `You have too many gems. Current gems: ${JSON.stringify(abbrevGems(playerGems))}
You must discard exactly ${excessCount} gem(s).
Respond with ONLY a JSON object:
{"reasoning":["..."],"action":{"type":"discardGems","gems":{<abbreviated color>:<count>,...}}}
Use full color names in the gems object (white/blue/green/red/black/gold).`;
}

export function buildNobleSelectionPrompt(nobles: NobleTile[]): string {
  const listed = nobles.map(n => `${n.id} (${n.prestigePoints}pts)`).join(', ');
  return `You qualify for multiple nobles. Choose one: ${listed}
Respond with ONLY a JSON object:
{"reasoning":["..."],"action":{"type":"selectNoble","nobleId":"<id>"}}`;
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

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  // OpenAI / custom: { choices: [{ message: { content: "..." } }] }
  return data.choices?.[0]?.message?.content ?? JSON.stringify(data);
}

export async function getAiMove(
  state: GameState,
  legalActions: Action[],
  config: AiConfig,
): Promise<AiResponse> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildGameStatePrompt(state) + '\n\n' + buildLegalMovesPrompt(legalActions);

  const responseText = await callAiProxy(config, systemPrompt, userPrompt);
  return parseAiResponse(responseText, legalActions);
}

export async function getAiDiscardDecision(
  playerGems: Record<GemColor, number>,
  excessCount: number,
  config: AiConfig,
): Promise<AiResponse> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildDiscardPrompt(playerGems, excessCount);

  const responseText = await callAiProxy(config, systemPrompt, userPrompt);

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
    };
  }

  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.map(String).slice(0, 5)
    : ['No reasoning provided.'];

  if (parsed.action?.type === 'discardGems' && parsed.action.gems) {
    return { reasoning, action: parsed.action };
  }

  return {
    reasoning: [...reasoning, 'Invalid discard action — using fallback.'],
    action: buildFallbackDiscard(playerGems, excessCount),
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
): Promise<AiResponse> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildNobleSelectionPrompt(nobles);

  const responseText = await callAiProxy(config, systemPrompt, userPrompt);

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
    };
  }

  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.map(String).slice(0, 5)
    : ['No reasoning provided.'];

  if (parsed.action?.type === 'selectNoble' && parsed.action.nobleId) {
    const valid = nobles.some(n => n.id === (parsed.action as { type: 'selectNoble'; nobleId: string }).nobleId);
    if (valid) {
      return { reasoning, action: parsed.action };
    }
  }

  return {
    reasoning: [...reasoning, 'Invalid noble selection — picking first eligible.'],
    action: { type: 'selectNoble', nobleId: nobles[0].id },
  };
}
