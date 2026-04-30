/**
 * Shared market calibration — XML blocks injected into user prompts that
 * price or re-price threadDeltas (scene-structure extraction, thread-lifecycle
 * generation, fate-reextract second pass) so every pass speaks the same
 * market vocabulary and applies the same discipline to information flow.
 *
 * The narrative prediction market is modeled on a real trading desk reacting
 * to news flow. The principles are not optional; every threadDelta emission
 * must trace to one or more of them, and anything that can't be explained by
 * a principle is noise, not evidence.
 */

export const PROMPT_MARKET_PRINCIPLES = `<market-discipline hint="Treat this like a trading desk reacting to news flow.">
  <role>
    <identity>YOU ARE A MARKET MAKER, NOT A FAN. Your P&amp;L is calibration alone; you have no stake in any resolution. A correctly-priced long-shot is worth more than a correctly-priced favorite. If you notice yourself rooting — protagonist wins, love resolves, system holds — that is confirmation bias. Deflate the emission magnitude until the bias is neutralized. Neutrality is the job.</identity>
    <counterparty>The author is the INFORMED COUNTERPARTY who knows which outcome resolves. You price against their flow. Premature commitment is how a market maker loses; calibrated honesty is how they survive.</counterparty>
  </role>

  <principles hint="Every threadDelta emission must trace to one of these seven.">
    <principle index="1" name="price-news-not-noise">A scene's evidence must be more likely under the target outcome than under the alternatives — a LIKELIHOOD RATIO, not an absolute weight. If the scene could be written the same way whether X or ¬X is true, it is attention (volumeDelta), not evidence. First mention of an event is the price mover; subsequent restatements are already priced in. News half-life is one scene — after that you're repeating yourself.</principle>
    <principle index="2" name="magnitude-proportional-to-surprise" hint="Run the steelman test.">Before emitting +evidence on outcome X, ask: if X were false, could this same scene still exist? Yes → |e| ≤ 1 (the scene is consistent with multiple outcomes, weak evidence). No — the scene has content that only makes sense under X — → |e| ≥ 2. Payoffs and twists that resolve or reverse: |e| ≥ 3. Under-pricing a genuine payoff is as broken as over-pricing a routine scene.</principle>
    <principle index="3" name="realized-evidence-not-forecast">Only on-page events are evidence. Narrative sympathy, genre expectation, rhetorical hedges, POV momentum: none count. Standing advantages (foreknowledge, skill, reincarnation, hidden identity) price into the opening prior, not re-emit every scene. When uncertain between readings of a scene, PULSE and let the next scene disambiguate. The author knows more than you; don't race ahead of what the page has shown.</principle>
    <principle index="4" name="saturation-asymmetry" hint="Run the liquidity test.">When top p ≥ 0.85 or margin is near-closed, ask: would you take the other side at this price? A market maker at p=0.90 is willing to buy ¬X at 0.10. If you wouldn't, you've mispriced your own emission. In saturated markets, valid emissions shrink to: payoff (closes), twist (reverses), resistance (legitimate setback on leader), or pulse (routine continuation). Small +1..+2 on a saturated leader is phantom accumulation, not information — the market already knows.</principle>
    <principle index="5" name="liabilities-stay-on-the-books">Stated costs exist until paid, waived, or proven inapplicable. A scene showing successful action without the cost being realized is evidence for DEBT-DEFERRED, not for NO-COST — the two readings are distinguishable only at a resolution event. Do not saturate a "no-cost / undetected / free / without consequence" outcome while structural debt accumulates. Cost absence from the scene is evidence the debt has not yet been collected, nothing more.</principle>
    <principle index="6" name="outcomes-name-specific-futures">A market can only price between concrete alternatives the resolution space actually contains. Trivially-true labels ("reveals complex connection", "has meaningful effect", "turns out to be significant") describe that SOMETHING happens, not what — they cannot be re-priced and close at low quality, losing the thread's structural continuity. Outcomes must be unambiguously adjudicable at resolution; if concrete alternatives can't be enumerated, the underlying question is under-specified.</principle>
    <principle index="7" name="cascades-scale-with-driving-quality">One decisive reveal can legitimately reprice several coupled threads in the same scene. Cascade strength scales with the quality of the driving event — a decisive payoff cascades cleanly; a trivial or low-quality closure barely propagates. Each cascade emission cites its driving sentence. Do not use coupling to smuggle evidence into threads the scene did not actually touch.</principle>

    <principle index="8" name="scope-distance-attenuation" hint="Magnitude scales inversely with structural distance to resolution. Read the thread's horizon field before picking a band.">A scene's evidence magnitude must be attenuated by the thread's HORIZON — a static field on every thread classifying how far its resolution sits from any given step. Use these caps for typical incremental events:
      <horizon name="short" cap="±3..±4 (full band available)">Resolves in 2-3 scenes (immediate trust, fight outcome, single reveal). Local events touch resolution directly — no attenuation.</horizon>
      <horizon name="medium" cap="±1..±2 typical, ±3 only on direct contact">Within one arc (~4-8 scenes). A scene that materially advances or sets back the question prices full setup/escalation magnitude; tangential scenes pulse.</horizon>
      <horizon name="long" cap="±0.5..±1 typical, ±2 only on structural pivot">Multi-arc, segment-spanning. Most scenes pulse or contribute small directional pressure; reserve magnitude for events that change the playing field.</horizon>
      <horizon name="epic" cap="±0.2..±0.5 typical, ±2 only on world-altering pivot">Series-spanning or open-ended (eternal life, dynastic succession, transcending mortality). Almost everything is a tiny pulse against the immense span; markets fluctuate gently across hundreds of inputs.</horizon>
      <example>
        <event>Protagonist marginally wins a cultivation duel against a peer.</event>
        <scoring market="Will protagonist win this duel?" horizon="short" magnitude="+3..+4 (payoff)">Direct resolution.</scoring>
        <scoring market="Will protagonist surpass the sect master this arc?" horizon="medium" magnitude="+1..+2 (setup/escalation)">Material progress on a contested but reachable goal.</scoring>
        <scoring market="Will protagonist achieve eternal life?" horizon="epic" magnitude="+0.2..+0.5 (directional pulse)">One rung of an immense ladder.</scoring>
      </example>
      The same attenuation applies symmetrically to setbacks. The result is a market that fluctuates gently across many small inputs while remaining responsive to genuine structural pivots — a forbidden technique acquired, a fundamental resource lost, a benefactor revealed as adversarial — which DO move long/epic-horizon goals at full magnitude (|e| ≥ 2) because they re-shape the resolution path itself, not walk a step along it. The wrong move is treating every local win on the central agent as evidence-for-everything-they-want; that is the fan bias at scale. If a thread's horizon is undefined, treat it as 'medium'.
    </principle>
  </principles>

  <pre-emission-checklist hint="Apply to every threadDelta. If any answer is wrong, downgrade to pulse or revise.">
    <check name="likelihood">Is this scene MORE likely under the target outcome than under alternatives?</check>
    <check name="steelman">Could this scene exist if the target outcome were false?</check>
    <check name="informed-flow">Am I pricing a reading the page shows, or a reading I want?</check>
    <check name="liquidity">If this market is saturated, would I take the other side at current price?</check>
    <check name="scope-match">Is the magnitude attenuated for the goal's distance? A local win on a long-horizon goal is fractional, not full-band — unless this scene structurally re-shapes the path to resolution.</check>
    <check name="principle">Can I cite which of the eight principles justifies the magnitude?</check>
  </pre-emission-checklist>
</market-discipline>`;

export const PROMPT_PORTFOLIO_PRINCIPLES = `<portfolio-discipline hint="How the prediction-market SET stays informationally alive. Emission principles keep each market honest; portfolio principles keep the set from degenerating into decoration. The fate nodes / threads in play constitute a portfolio, and portfolio health matters more than any single market's calibration — a portfolio of well-priced but all-distal, all-central-agent, all-soft-outcome markets will generate an inert trajectory no matter how clean each emission is.">

  <register-agnostic hint="Translate as needed.">
    <register kind="fiction">central agent = protagonist, step = scene, segment = arc.</register>
    <register kind="argument-or-inquiry">central agent = committed hypothesis, step = section, segment = chapter.</register>
    <register kind="reportage">central agent = reporter's claim, step = finding, segment = investigation.</register>
  </register-agnostic>

  <principles>
    <principle id="A" name="contested-outcomes">Every market needs at least one outcome the central agent would pay to prevent (or, in argument register, an outcome that contradicts the committed hypothesis). An outcome set where every option is a variant of the central agenda's success is a progress bar, not a market — saturation there is mechanical, not meaningful. Name the goal, the blocking state, and where possible a third outcome outside the author's explicit anticipation.</principle>
    <principle id="B" name="irreversibility">Soft outcomes (gradual drift, recoverable shifts) price as math; hard outcomes (terminal states, broken conditions, committed structural moves) price as weight. A portfolio of only soft markets cannot generate Fate — nothing with actual settlement is in play. Aim for roughly a quarter of open markets to point at an irreversible outcome.</principle>
    <principle id="C" name="horizon-diversity">Long-horizon markets alone are climate — meta-tension without step-level traction. Maintain a distribution across short (resolves in 2-3 steps), medium (half-segment), and long (segment-spanning) horizons. All-distal portfolios produce trajectories where individual steps feel interchangeable.</principle>
    <principle id="D" name="peripheral-agent-coverage">A portfolio tracking only the central agent is solipsistic — the world doesn't feel alive because nothing outside the focal position is being tracked. Named entities the generator has invested in deserve at least one market of their own. Peripheral-agent markets make the world responsive rather than decorative.</principle>
    <principle id="E" name="cost-ledger">When the world pushes back (systemic counter-pressure, accumulating debt, narrowing options, a rule biting), that pressure must enter a dedicated cost-ledger market whose leading outcome is something the central agent is trying to prevent. Otherwise costs fire once and evaporate; counter-pressure must compound via market state, not via authorial memory.</principle>
    <principle id="F" name="no-zombies">Zombie markets (σ≈0, untouched for 10+ steps, no closure path) crowd out attention without contributing uncertainty. Prefer a smaller hotter portfolio over a larger colder one. If a market cannot receive genuine evidence in the next step or two, close it (payoff), abandon it, or let attrition retire it.</principle>
    <principle id="G" name="surprise-capacity">Some markets must carry outcome spaces the observer could not have specified from the opening commitments alone. If every market is predictable from the premise, the portfolio will generate exactly the trajectory the opening implied. Plant at least one outcome per segment that opens a genuinely unforeseen future.</principle>
  </principles>

  <multi-market-cascade hint="A step moving one market is a step under-using the fate layer.">
    Major events — payoffs, twists, introductions, system-rule reveals, world-state irreversibilities — MUST cascade across coupled markets in the same step. A death re-prices every market the dead party participated in; a revealed rule re-prices every market it constrains; a new entity arriving opens markets of its own and flips existing ones by being present. A major event that moves only its primary market is a calibration failure — the world is a coupled system, and state change propagates. The CRG should design these cascades upstream rather than leaving them to scene-by-scene emission to rediscover.
  </multi-market-cascade>

  <state-change>
    No market is permanently settled short of a resolution event. The world is a live coupled system — system rules can bite, world entities can reveal hidden capabilities, peripheral agents can act against the central agenda. Markets that look settled under the current trajectory must remain re-priceable when legitimate force-of-system or force-of-world evidence lands. A portfolio where every market is foregone is a portfolio with nothing to watch.
  </state-change>
</portfolio-discipline>`;

export const PROMPT_MARKET_EVIDENCE_SCALE = `<evidence-scale hint="Real number in [-4, +4] per affected outcome. Decimals encouraged; system rounds to 1dp. Bands describe the event's relationship to the SPECIFIC market — a payoff for a near-horizon market is decisive; the same on-page event for a long-horizon market may only be a small directional pulse. Apply Principle 8 (scope-distance-attenuation) before picking a band.">
  <band magnitude="±0..1" kind="small">pulse, minor shift, OR meaningful local event scored against a long-horizon market.</band>
  <band magnitude="±1..2" kind="meaningful">setup, resistance.</band>
  <band magnitude="±2..3" kind="significant">escalation, twist.</band>
  <band magnitude="±3..4" kind="decisive">payoff, reversal — uncertainty collapses on the market being scored.</band>
</evidence-scale>`;

export const PROMPT_MARKET_LOGTYPE_TABLE = `<logtype-table hint="logType MUST agree with direction + magnitude.">
  <entry name="setup" evidence="+0..+1">planting, low prior.</entry>
  <entry name="escalation" evidence="+2..+3">stakes rise, direction clear.</entry>
  <entry name="payoff" evidence="+3..+4">outcome locks in (closes to 1).</entry>
  <entry name="twist" evidence="±3 against prior trend">reversal.</entry>
  <entry name="resistance" evidence="−1..−2">genuine setback against rising trend.</entry>
  <entry name="stall" evidence="0">expected movement absent.</entry>
  <entry name="callback" evidence="+1..+2 plus volumeDelta">attention returns.</entry>
  <entry name="pulse" evidence="±0..1">attention maintenance.</entry>
  <entry name="transition" evidence="low |Δp|, high |Δvolume|">phase change.</entry>
</logtype-table>`;
