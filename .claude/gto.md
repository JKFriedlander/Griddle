### Game-theory optimal (GTO) order

The scoring system is **order-dependent** when multipliers are involved:

1. **Flat bonuses first** — flat bonuses add to the base and are order-independent among themselves, but capturing them before any `×n` box inflates the base the multiplier will compound.
2. **Ascending multiplier order** — when multiple `×n` boxes exist, apply smaller multipliers first. Proof: for `m₁ < m₂`, applying `m₁` then `m₂` yields `…×m₁×m₂ + m₂` extra; reversed gives `…×m₁×m₂ + m₁`. Since `m₂ > m₁`, smaller first always wins.

---