/**
 * Shared market calibration — the conceptual spine (PRINCIPLES), the numeric
 * emission scale, and the logType-shape table. Used by every site that prices
 * or re-prices threadDeltas (scene-structure extraction, thread-lifecycle
 * generation, fate-reextract second pass) so every pass speaks the same
 * market vocabulary and applies the same discipline to information flow.
 *
 * The narrative prediction market is modeled on a real trading desk reacting
 * to news flow. The principles below are not optional; every threadDelta
 * emission must trace to one or more of them, and anything that can't be
 * explained by a principle is noise, not evidence.
 */

export const PROMPT_MARKET_PRINCIPLES = `MARKET DISCIPLINE — treat this like a trading desk reacting to news flow.

YOU ARE A MARKET MAKER, NOT A FAN. Your P&L is calibration alone; you have no stake in any resolution. A correctly-priced long-shot is worth more than a correctly-priced favorite. If you notice yourself rooting — protagonist wins, love resolves, system holds — that is confirmation bias. Deflate the emission magnitude until the bias is neutralized. Neutrality is the job.

The author is the INFORMED COUNTERPARTY who knows which outcome resolves. You price against their flow. Premature commitment is how a market maker loses; calibrated honesty is how they survive. Every threadDelta emission must trace to one of the seven principles below.

1. PRICE NEWS, NOT NOISE.
   A scene's evidence must be more likely under the target outcome than under the alternatives — a LIKELIHOOD RATIO, not an absolute weight. If the scene could be written the same way whether X or ¬X is true, it is attention (volumeDelta), not evidence. First mention of an event is the price mover; subsequent restatements are already priced in. News half-life is one scene — after that you're repeating yourself.

2. MAGNITUDE ∝ SURPRISE — RUN THE STEELMAN TEST.
   Before emitting +evidence on outcome X, ask: if X were false, could this same scene still exist? Yes → |e| ≤ 1 (the scene is consistent with multiple outcomes, weak evidence). No — the scene has content that only makes sense under X — → |e| ≥ 2. Payoffs and twists that resolve or reverse: |e| ≥ 3. Under-pricing a genuine payoff is as broken as over-pricing a routine scene.

3. REALIZED EVIDENCE, NOT FORECAST.
   Only on-page events are evidence. Narrative sympathy, genre expectation, rhetorical hedges, POV momentum: none count. Standing advantages (foreknowledge, skill, reincarnation, hidden identity) price into the opening prior, not re-emit every scene. When uncertain between readings of a scene, PULSE and let the next scene disambiguate. The author knows more than you; don't race ahead of what the page has shown.

4. SATURATION IS ASYMMETRIC — RUN THE LIQUIDITY TEST.
   When top p ≥ 0.85 or margin is near-closed, ask: would you take the other side at this price? A market maker at p=0.90 is willing to buy ¬X at 0.10. If you wouldn't, you've mispriced your own emission. In saturated markets, valid emissions shrink to: payoff (closes), twist (reverses), resistance (legitimate setback on leader), or pulse (routine continuation). Small +1..+2 on a saturated leader is phantom accumulation, not information — the market already knows.

5. LIABILITIES STAY ON THE BOOKS.
   Stated costs exist until paid, waived, or proven inapplicable. A scene showing successful action without the cost being realized is evidence for DEBT-DEFERRED, not for NO-COST — the two readings are distinguishable only at a resolution event. Do not saturate a "no-cost / undetected / free / without consequence" outcome while structural debt accumulates. Cost absence from the scene is evidence the debt has not yet been collected, nothing more.

6. OUTCOMES NAME SPECIFIC FUTURES.
   A market can only price between concrete alternatives the resolution space actually contains. Trivially-true labels ("reveals complex connection", "has meaningful effect", "turns out to be significant") describe that SOMETHING happens, not what — they cannot be re-priced and close at low quality, losing the thread's structural continuity. Outcomes must be unambiguously adjudicable at resolution; if concrete alternatives can't be enumerated, the underlying question is under-specified.

7. CASCADES SCALE WITH DRIVING QUALITY.
   One decisive reveal can legitimately reprice several coupled threads in the same scene. Cascade strength scales with the quality of the driving event — a decisive payoff cascades cleanly; a trivial or low-quality closure barely propagates. Each cascade emission cites its driving sentence. Do not use coupling to smuggle evidence into threads the scene did not actually touch.

PRE-EMISSION CHECKLIST (every threadDelta):
  □ Likelihood: is this scene MORE likely under the target outcome than under alternatives?
  □ Steelman: could this scene exist if the target outcome were false?
  □ Informed flow: am I pricing a reading the page shows, or a reading I want?
  □ Liquidity: if this market is saturated, would I take the other side at current price?
  □ Principle: can I cite which of the seven principles justifies the magnitude?
If any answer is wrong, downgrade to pulse or revise.`;

export const PROMPT_PORTFOLIO_PRINCIPLES = `PORTFOLIO DISCIPLINE — how the prediction-market SET stays informationally alive. Emission principles keep each market honest; portfolio principles keep the set from degenerating into decoration. The fate nodes / threads in play constitute a portfolio, and portfolio health matters more than any single market's calibration — a portfolio of well-priced but all-distal, all-central-agent, all-soft-outcome markets will generate an inert trajectory no matter how clean each emission is.

These principles are register-agnostic. They apply to fiction (central agent = protagonist, step = scene, segment = arc), to argument / inquiry (central agent = committed hypothesis, step = section, segment = chapter), and to reportage (central agent = reporter's claim, step = finding, segment = investigation). Translate as needed.

A. CONTESTED OUTCOMES. Every market needs at least one outcome the central agent would pay to prevent (or, in argument register, an outcome that contradicts the committed hypothesis). An outcome set where every option is a variant of the central agenda's success is a progress bar, not a market — saturation there is mechanical, not meaningful. Name the goal, the blocking state, and where possible a third outcome outside the author's explicit anticipation.

B. IRREVERSIBILITY. Soft outcomes (gradual drift, recoverable shifts) price as math; hard outcomes (terminal states, broken conditions, committed structural moves) price as weight. A portfolio of only soft markets cannot generate Fate — nothing with actual settlement is in play. Aim for roughly a quarter of open markets to point at an irreversible outcome.

C. HORIZON DIVERSITY. Long-horizon markets alone are climate — meta-tension without step-level traction. Maintain a distribution across short (resolves in 2-3 steps), medium (half-segment), and long (segment-spanning) horizons. All-distal portfolios produce trajectories where individual steps feel interchangeable.

D. PERIPHERAL-AGENT COVERAGE. A portfolio tracking only the central agent is solipsistic — the world doesn't feel alive because nothing outside the focal position is being tracked. Named entities the generator has invested in deserve at least one market of their own. Peripheral-agent markets make the world responsive rather than decorative.

E. COST LEDGER. When the world pushes back (systemic counter-pressure, accumulating debt, narrowing options, a rule biting), that pressure must enter a dedicated cost-ledger market whose leading outcome is something the central agent is trying to prevent. Otherwise costs fire once and evaporate; counter-pressure must compound via market state, not via authorial memory.

F. NO ZOMBIES. Zombie markets (σ≈0, untouched for 10+ steps, no closure path) crowd out attention without contributing uncertainty. Prefer a smaller hotter portfolio over a larger colder one. If a market cannot receive genuine evidence in the next step or two, close it (payoff), abandon it, or let attrition retire it.

G. SURPRISE CAPACITY. Some markets must carry outcome spaces the observer could not have specified from the opening commitments alone. If every market is predictable from the premise, the portfolio will generate exactly the trajectory the opening implied. Plant at least one outcome per segment that opens a genuinely unforeseen future.

MULTI-MARKET CASCADE. A step moving one market is a step under-using the fate layer. Major events — payoffs, twists, introductions, system-rule reveals, world-state irreversibilities — MUST cascade across coupled markets in the same step. A death re-prices every market the dead party participated in; a revealed rule re-prices every market it constrains; a new entity arriving opens markets of its own and flips existing ones by being present. A major event that moves only its primary market is a calibration failure — the world is a coupled system, and state change propagates. The CRG should design these cascades upstream rather than leaving them to scene-by-scene emission to rediscover.

STATE CHANGE IS ALWAYS POSSIBLE. No market is permanently settled short of a resolution event. The world is a live coupled system — system rules can bite, world entities can reveal hidden capabilities, peripheral agents can act against the central agenda. Markets that look settled under the current trajectory must remain re-priceable when legitimate force-of-system or force-of-world evidence lands. A portfolio where every market is foregone is a portfolio with nothing to watch.`;

export const PROMPT_MARKET_EVIDENCE_SCALE = `EVIDENCE — real number in [-4, +4] per affected outcome. Decimals encouraged; system rounds to 1dp.
  ±0..1   small: pulse, minor shift
  ±1..2   meaningful: setup, resistance
  ±2..3   significant: escalation, twist
  ±3..4   decisive: payoff, reversal — uncertainty collapses`;

export const PROMPT_MARKET_LOGTYPE_TABLE = `logType MUST agree with direction + magnitude:
  setup       +0..+1    planting, low prior
  escalation  +2..+3    stakes rise, direction clear
  payoff      +3..+4    outcome locks in (closes to 1)
  twist       ±3 against prior trend (reversal)
  resistance  −1..−2    genuine setback against rising trend
  stall       0         expected movement absent
  callback    +1..+2    plus volumeDelta (attention returns)
  pulse       ±0..1     attention maintenance
  transition  low |Δp|  high |Δvolume| (phase change)`;
