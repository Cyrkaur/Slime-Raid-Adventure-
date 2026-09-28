/* ===== Pure Raid-style combat (turn meter, skills, affinity, auto/manual) =====
 * Portable logic — no Phaser / DOM dependency. Used by BattleScene + unit tests.
 */
(function (global) {
  'use strict';

  var DATA = global.SR_DATA || (typeof require !== 'undefined' ? require('../data/gameData.js') : null);
  if (!DATA && typeof require !== 'undefined') {
    try { DATA = require('../data/gameData.js'); } catch (e) {}
  }

  var TURN_METER_FULL = 100;

  /**
   * Elemental statuses — chance on hit + tick at start of afflicted unit's turn.
   * Pure data; VFX reads hit.statusApplied / battle.lastAction.statusTicks.
   */
  var STATUS_DEFS = {
    burn:    { id: 'burn',    name: 'Burn',    icon: '🔥', kind: 'dot',  tickFrac: 0.07, duration: 2, color: 0xff5522 },
    poison:  { id: 'poison',  name: 'Poison',  icon: '☠️', kind: 'dot',  tickFrac: 0.055, duration: 3, color: 0x66cc33 },
    chill:   { id: 'chill',   name: 'Chill',   icon: '❄️', kind: 'slow', speedMul: 0.70, duration: 2, color: 0x88ddff },
    shock:   { id: 'shock',   name: 'Shock',   icon: '⚡', kind: 'mark', dmgMul: 1.22, duration: 2, color: 0xffee66 },
    soak:    { id: 'soak',    name: 'Soak',    icon: '💧', kind: 'mark', fireBonus: 1.25, duration: 2, color: 0x4499ff },
    stagger: { id: 'stagger', name: 'Stagger', icon: '🪨', kind: 'meter', meterCut: 28, duration: 1, color: 0xaa8866 },
    root:    { id: 'root',    name: 'Root',    icon: '🌿', kind: 'slow', speedMul: 0.62, duration: 2, color: 0x44bb55 },
    hex:     { id: 'hex',     name: 'Hex',     icon: '🌑', kind: 'atkDown', atkMul: 0.82, duration: 2, color: 0x7744aa },
    brittle: { id: 'brittle', name: 'Brittle', icon: '💎', kind: 'vuln',  takenMul: 1.18, duration: 2, color: 0xddaaff },
    expose:  { id: 'expose',  name: 'Expose',  icon: '💨', kind: 'critUp', critBonus: 0.14, duration: 2, color: 0xaaffee },
    daze:    { id: 'daze',    name: 'Daze',    icon: '✨', kind: 'meter', meterCut: 22, duration: 1, color: 0xffeecc },
    haunt:   { id: 'haunt',   name: 'Haunt',   icon: '👻', kind: 'dot',  tickFrac: 0.045, duration: 2, atkMul: 0.9, color: 0x9966cc },
    ward:    { id: 'ward',    name: 'Ward',    icon: '🛡️', kind: 'buff', takenMul: 0.82, duration: 2, color: 0xaaffee },
    empower: { id: 'empower', name: 'Empower', icon: '💪', kind: 'buff', atkMul: 1.18, duration: 2, color: 0xffcc66 }
  };

  function elementStatusId(element) {
    var el = String(element || '');
    if (el === 'Fire' || el === 'Lava') return 'burn';
    if (el === 'Poison') return 'poison';
    if (el === 'Ice') return 'chill';
    if (el === 'Lightning' || el === 'Storm') return 'shock';
    if (el === 'Water') return 'soak';
    if (el === 'Earth' || el === 'Metal') return 'stagger';
    if (el === 'Plant') return 'root';
    if (el === 'Shadow') return 'hex';
    if (el === 'Void') return 'haunt';
    if (el === 'Crystal') return 'brittle';
    if (el === 'Wind') return 'expose';
    if (el === 'Light') return 'daze';
    if (el === 'Spirit') return 'haunt';
    return null;
  }

  function skillStatusChance(skill, actor) {
    skill = skill || {};
    var id = String(skill.id || '').toLowerCase();
    var base = 0.20;
    if (skill.aoe) base = 0.16;
    if (skill.cd >= 4 || (skill.mult != null && skill.mult >= 1.6)) base = 0.34;
    else if (skill.cd >= 2 || (skill.mult != null && skill.mult >= 1.25)) base = 0.28;
    // Signature fire / poison kits lean into DoT fantasy
    if (id === 'inferno' || id === 'blaze' || id === 'blaze_focus') base = Math.max(base, 0.42);
    if (id === 'poison' || id === 'miasma' || id.indexOf('venom') >= 0) base = Math.max(base, 0.40);
    if (id === 'freeze' || id === 'blizzard' || id === 'ice_spike') base = Math.max(base, 0.36);
    if (id.indexOf('basic') >= 0 || id === 'basic' || skill.cd === 0) base = Math.min(base, 0.22);
    // Legendary+ a bit stickier
    var rar = actor && actor.rarity;
    if (rar === 'Legendary' || rar === 'Mythic') base += 0.05;
    if (rar === 'Epic') base += 0.02;
    return Math.min(0.55, Math.max(0.08, base));
  }

  function hasStatus(unit, statusId) {
    if (!unit || !unit.statuses) return false;
    return unit.statuses.some(function (s) { return s && s.id === statusId; });
  }

  function getStatus(unit, statusId) {
    if (!unit || !unit.statuses) return null;
    for (var i = 0; i < unit.statuses.length; i++) {
      if (unit.statuses[i] && unit.statuses[i].id === statusId) return unit.statuses[i];
    }
    return null;
  }

  function applyStatus(unit, statusId, opts) {
    opts = opts || {};
    var def = STATUS_DEFS[statusId];
    if (!unit || !def || !unit.alive) return null;
    if (!unit.statuses) unit.statuses = [];
    var existing = getStatus(unit, statusId);
    var dur = opts.duration != null ? opts.duration : def.duration;
    if (existing) {
      // Refresh duration; stack dots lightly
      existing.duration = Math.max(existing.duration, dur);
      if (def.kind === 'dot' && existing.stacks < 3) {
        existing.stacks = (existing.stacks || 1) + 1;
      }
      return existing;
    }
    var st = {
      id: def.id,
      name: def.name,
      icon: def.icon,
      kind: def.kind,
      duration: dur,
      stacks: 1,
      tickFrac: def.tickFrac || null,
      speedMul: def.speedMul || null,
      atkMul: def.atkMul || null,
      takenMul: def.takenMul || null,
      dmgMul: def.dmgMul || null,
      fireBonus: def.fireBonus || null,
      critBonus: def.critBonus || null,
      meterCut: def.meterCut || null,
      color: def.color,
      sourceId: opts.sourceId || null
    };
    unit.statuses.push(st);
    // Instant meter cut on apply (stagger / daze)
    if (def.kind === 'meter' && def.meterCut) {
      unit.turnMeter = Math.max(0, (unit.turnMeter || 0) - def.meterCut);
    }
    return st;
  }

  function effectiveSpeed(unit) {
    var spd = (unit && unit.speed) || 100;
    if (!unit || !unit.statuses) return spd;
    unit.statuses.forEach(function (st) {
      if (st && st.speedMul) spd *= st.speedMul;
    });
    return Math.max(30, spd);
  }

  function effectiveAtk(unit) {
    var atk = (unit && unit.atk) || 10;
    if (!unit || !unit.statuses) return atk;
    unit.statuses.forEach(function (st) {
      if (st && st.atkMul) atk *= st.atkMul;
    });
    return Math.max(1, atk);
  }

  function effectiveDamageTakenMul(unit) {
    var m = (unit && unit.damageTakenMul != null) ? unit.damageTakenMul : 1;
    if (!unit || !unit.statuses) return m;
    unit.statuses.forEach(function (st) {
      if (st && st.takenMul) m *= st.takenMul;
    });
    return m;
  }

  /**
   * Tick DoTs / expire statuses at the start of a unit's turn.
   * @returns {{ ticks: array, killed: boolean, logs: string[] }}
   */
  function tickStatuses(unit) {
    var out = { ticks: [], killed: false, logs: [], expired: [] };
    if (!unit || !unit.statuses || !unit.statuses.length) return out;
    var remaining = [];
    unit.statuses.forEach(function (st) {
      if (!st) return;
      var def = STATUS_DEFS[st.id] || st;
      if ((def.kind === 'dot' || st.tickFrac) && unit.alive) {
        var frac = st.tickFrac || def.tickFrac || 0.05;
        var stacks = st.stacks || 1;
        var dmg = Math.max(1, Math.floor(unit.maxHp * frac * stacks));
        unit.hp = Math.max(0, unit.hp - dmg);
        unit.damageTaken = (unit.damageTaken || 0) + dmg;
        out.ticks.push({
          targetId: unit.id,
          statusId: st.id,
          name: st.name || def.name,
          icon: st.icon || def.icon,
          amount: dmg,
          kind: 'dot',
          color: st.color || def.color
        });
        out.logs.push(unit.name + ' takes ' + dmg + ' from ' + (st.name || def.name));
        if (unit.hp <= 0) {
          unit.alive = false;
          out.killed = true;
          out.logs.push(unit.name + ' falls to ' + (st.name || def.name) + '!');
        }
      }
      st.duration = (st.duration || 1) - 1;
      if (st.duration > 0 && unit.alive) remaining.push(st);
      else if (st.duration <= 0) out.expired.push(st.id);
    });
    unit.statuses = remaining;
    return out;
  }

  function resolveCombatSpeed(slime, isFoe) {
    slime = slime || {};
    var pwr = Math.max(28, slime.power || slime.basePower || 80);
    var lvl = slime.level || 1;
    var rarityBonus = ({ Common: 0, Uncommon: 6, Rare: 14, Epic: 24, Legendary: 36, Mythic: 48 })[slime.rarity] || 0;
    var idVar = 0;
    if (slime.id != null) idVar = Math.abs(Number(slime.id) || 0) % 19;
    var spd = 88 + lvl * 3.2 + pwr * 0.055 + rarityBonus + idVar;
    if (isFoe) spd *= 0.96;
    return Math.max(55, Math.min(240, Math.floor(spd)));
  }

  /**
   * Build combat skill instances from themed element kits.
   * Prefers DATA.getChampionSkills (per-element basic/signature/utility/ultimate).
   */
  function defaultSkills(slime) {
    var list = null;
    if (DATA && typeof DATA.getChampionSkills === 'function') {
      list = DATA.getChampionSkills(slime || {});
    }
    if (!list || !list.length) {
      // Legacy fallback if data module is old
      var defs = (DATA && DATA.SKILL_DEFS) || {};
      var map = (DATA && DATA.ELEMENT_SKILL) || {};
      var el = (slime && slime.element) || 'Water';
      var sig = map[el] || 'smash';
      list = [
        Object.assign({}, defs.basic || { id: 'basic', name: 'Gel Strike', mult: 1, cd: 0 }),
        Object.assign({}, defs[sig] || defs.smash || { id: 'smash', name: 'Crush', mult: 1.45, cd: 2 })
      ];
      if (slime && (slime.rarity === 'Epic' || slime.rarity === 'Legendary' || slime.rarity === 'Mythic')) {
        list.push(Object.assign({}, defs.heal || { id: 'heal', name: 'Mend', mult: 0, cd: 3, heal: 0.28 }));
      }
    }
    return list.map(function (s, i) {
      return normalizeSkill(s, i);
    });
  }

  function normalizeSkill(s, i) {
    s = s || {};
    var def = (DATA && DATA.SKILL_DEFS && DATA.SKILL_DEFS[s.id]) || {};
    return {
      id: s.id || def.id || ('sk' + i),
      name: s.name || def.name || 'Skill',
      mult: s.mult != null ? s.mult : (def.mult != null ? def.mult : 1),
      cd: s.cd != null ? s.cd : (def.cd || 0),
      cooldownLeft: 0,
      aoe: !!(s.aoe || def.aoe),
      heal: s.heal != null ? s.heal : (def.heal || 0),
      icon: s.icon || def.icon || '✨',
      artKey: s.artKey || def.artKey || null,
      artCategory: s.artCategory || def.artCategory || null
    };
  }

  function makeCombatant(slime, isFoe, opts) {
    opts = opts || {};
    slime = slime || {};
    var pwr = Math.max(28, slime.power || slime.basePower || 80);
    var foeHpMul = typeof opts.foeHpMul === 'number' ? opts.foeHpMul : 1.42;
    var allyHpMul = typeof opts.allyHpMul === 'number' ? opts.allyHpMul : 2.15;
    var foeAtkMul = typeof opts.foeAtkMul === 'number' ? opts.foeAtkMul : 0.15;
    var allyAtkMul = typeof opts.allyAtkMul === 'number' ? opts.allyAtkMul : 0.26;
    var hpMul = isFoe ? foeHpMul : allyHpMul;
    var atkMul = isFoe ? foeAtkMul : allyAtkMul;
    var maxHp = Math.floor(pwr * hpMul);
    var atk = Math.floor(pwr * atkMul) + (isFoe ? 5 : 10);
    var speed = resolveCombatSpeed(slime, isFoe);
    var critChance = 0.14;
    var damageTakenMul = 1;
    var affinityBonus = 0;
    var setBonuses = [];

    // Allies: use derived attributes (gear pieces + Raid set bonuses 2pc/4pc)
    if (!isFoe && !slime.isEnemy) {
      var attrs = slime.attributes;
      if ((!attrs || !attrs.atk) && DATA && typeof DATA.computeChampionAttributes === 'function') {
        attrs = DATA.computeChampionAttributes(slime);
      }
      if (attrs) {
        // attributes.hp/atk already include gear + set muls; scale into combat budget
        maxHp = Math.max(40, Math.floor((attrs.hp || maxHp) * 1.05));
        atk = Math.max(8, Math.floor((attrs.atk || atk) * 0.95));
        if (attrs.spd) speed = Math.max(55, Math.min(260, Math.floor(attrs.spd)));
        if (attrs.crit != null) critChance = Math.min(0.55, Math.max(0.05, (attrs.crit || 8) / 100));
        if (attrs.damageTakenMul != null) damageTakenMul = attrs.damageTakenMul;
        if (attrs.affinityBonus != null) affinityBonus = attrs.affinityBonus;
        if (attrs.setBonuses) setBonuses = attrs.setBonuses;
        if (attrs.power) pwr = attrs.power;
      }
    }

    var skills;
    if (slime.skills && slime.skills.length) {
      skills = slime.skills.map(function (s, i) { return normalizeSkill(s, i); });
    } else if (slime.skillIds && slime.skillIds.length && DATA && DATA.getChampionSkills) {
      // Resolve from stamped skill id list
      skills = DATA.getChampionSkills({
        element: slime.element,
        rarity: slime.rarity,
        skillIds: slime.skillIds
      }).map(function (s, i) { return normalizeSkill(s, i); });
    } else {
      skills = defaultSkills(slime);
    }

    return {
      id: slime.id != null ? slime.id : (isFoe ? 'foe_' : 'ally_') + Math.random().toString(36).slice(2, 8),
      slime: slime,
      name: slime.name || (isFoe ? 'Foe' : 'Champion'),
      element: slime.element || 'Earth',
      rarity: slime.rarity || 'Common',
      artVariant: slime.artVariant || null,
      isFoe: !!isFoe,
      // Hard-realm fantasy foes (not gel champions)
      isEnemy: !!(slime.isEnemy || slime.enemyKind),
      enemyKind: slime.enemyKind || slime.kind || null,
      maxHp: maxHp,
      hp: maxHp,
      atk: atk,
      speed: speed,
      power: pwr,
      critChance: critChance,
      damageTakenMul: damageTakenMul,
      affinityBonus: affinityBonus,
      setBonuses: setBonuses,
      turnMeter: 0,
      skills: skills,
      alive: true,
      // End-of-fight statistics (HTML battle results parity)
      damageDealt: 0,
      damageTaken: 0,
      skillsUsed: 0,
      critsLanded: 0,
      healsDone: 0,
      statuses: []
    };
  }

  function getAffinityMultiplier(atkEl, defEl) {
    if (DATA && typeof DATA.getAffinityMultiplier === 'function') {
      return DATA.getAffinityMultiplier(atkEl, defEl);
    }
    return 1;
  }

  /**
   * Advance turn meters until at least one living unit is ready.
   * Faster SPD fills first (Raid-style).
   * @returns {object|null} actor with highest meter among ready units
   */
  function advanceTurnMeters(units) {
    var living = (units || []).filter(function (u) { return u && u.alive; });
    if (!living.length) return null;

    // Already ready?
    var ready = living.filter(function (u) { return u.turnMeter >= TURN_METER_FULL; });
    if (ready.length) {
      ready.sort(function (a, b) {
        return b.turnMeter - a.turnMeter || effectiveSpeed(b) - effectiveSpeed(a);
      });
      return ready[0];
    }

    // Fill until someone reaches full
    var guard = 0;
    while (guard++ < 500) {
      var minNeed = Infinity;
      living.forEach(function (u) {
        var need = (TURN_METER_FULL - u.turnMeter) / Math.max(1, effectiveSpeed(u));
        if (need < minNeed) minNeed = need;
      });
      var step = Math.max(minNeed, 0.001);
      living.forEach(function (u) {
        u.turnMeter += effectiveSpeed(u) * step;
      });
      ready = living.filter(function (u) { return u.turnMeter >= TURN_METER_FULL; });
      if (ready.length) {
        ready.sort(function (a, b) {
          return b.turnMeter - a.turnMeter || effectiveSpeed(b) - effectiveSpeed(a);
        });
        return ready[0];
      }
    }
    return living[0] || null;
  }

  function tickCooldowns(actor) {
    if (!actor || !actor.skills) return;
    actor.skills.forEach(function (s) {
      if (s.cooldownLeft > 0) s.cooldownLeft -= 1;
    });
  }

  function getUsableSkills(actor) {
    if (!actor || !actor.skills) return [];
    return actor.skills.filter(function (s) { return !s.cooldownLeft; });
  }

  function pickAutoSkill(actor, allies) {
    var usable = getUsableSkills(actor);
    if (!usable.length) return null;
    // Prefer heal if any ally is under 55% HP
    if (allies && allies.length) {
      var hurt = allies.some(function (u) {
        return u && u.alive && u.hp < u.maxHp * 0.55;
      });
      if (hurt) {
        var healSk = usable.find(function (s) { return s.heal > 0; });
        if (healSk) return healSk;
      }
    }
    // Prefer AOE ultimate when 2+ foes (caller may not pass foes — still rank by mult)
    var ranked = usable.slice().sort(function (a, b) {
      var am = (a.heal ? 0 : (a.mult || 0)) + (a.aoe ? 0.15 : 0);
      var bm = (b.heal ? 0 : (b.mult || 0)) + (b.aoe ? 0.15 : 0);
      return bm - am;
    });
    return ranked[0];
  }

  function computeDamage(actor, target, skill) {
    skill = skill || { mult: 1 };
    if (skill.heal) return 0;
    var mult = skill.mult != null ? skill.mult : 1;
    var aff = getAffinityMultiplier(actor.element, target.element);
    // Perception set: affinity edge
    if (actor.affinityBonus) aff *= (1 + actor.affinityBonus);
    var dmg = effectiveAtk(actor) * mult * aff;
    // Defense set + brittle/ward status
    dmg *= effectiveDamageTakenMul(target);
    // Shock mark: take extra from next hit
    if (hasStatus(target, 'shock')) {
      var sh = getStatus(target, 'shock');
      dmg *= (sh && sh.dmgMul) || 1.22;
    }
    // Soak: fire/lava hits harder
    if (hasStatus(target, 'soak') && (actor.element === 'Fire' || actor.element === 'Lava')) {
      var so = getStatus(target, 'soak');
      dmg *= (so && so.fireBonus) || 1.25;
    }
    return Math.max(1, Math.floor(dmg));
  }

  function applySkill(actor, skill, allies, foes, targetId) {
    var log = [];
    var hits = []; // per-target visual events for BattleScene
    if (!actor || !actor.alive || !skill) {
      return { log: log, killed: [], totalDamage: 0, crits: 0, hits: hits, kind: 'none', skill: skill, actor: actor };
    }

    // Spend turn meter
    actor.turnMeter = Math.max(0, actor.turnMeter - TURN_METER_FULL);
    actor.skillsUsed = (actor.skillsUsed || 0) + 1;

    // Buff / guard / shell — ally ward (no damage). Kits stamp artCategory:'buff'.
    var isBuffSkill = !skill.heal && (
      skill.buff ||
      skill.artCategory === 'buff' ||
      skill.kind === 'buff' ||
      /guard|shield|veil|shell|cloak|ward/i.test(String(skill.id || '') + ' ' + String(skill.name || ''))
    );

    if (skill.heal) {
      var side = actor.isFoe ? foes : allies;
      var livingAllies = side.filter(function (u) { return u.alive; });
      var healTargets = [];
      // AOE heal → all living allies. Single-target heal → one ally only (no ALL mix).
      if (skill.aoe) {
        healTargets = livingAllies.slice();
      } else {
        var oneHeal = null;
        if (targetId != null && targetId !== 'ALL' && targetId !== '*') {
          oneHeal = livingAllies.find(function (u) { return u.id === targetId; }) || null;
        }
        if (!oneHeal) {
          // Auto / foe: most hurt ally
          livingAllies.sort(function (a, b) { return (a.hp / a.maxHp) - (b.hp / b.maxHp); });
          oneHeal = livingAllies[0] || null;
        }
        if (oneHeal) healTargets = [oneHeal];
      }
      var healTotal = 0;
      healTargets.forEach(function (t) {
        var amount = Math.floor(t.maxHp * (skill.heal || 0.25));
        t.hp = Math.min(t.maxHp, t.hp + amount);
        healTotal += amount;
        // Soft cleanse one harmful DoT on mend
        if (t.statuses && t.statuses.length) {
          var before = t.statuses.length;
          t.statuses = t.statuses.filter(function (s) {
            return s && s.kind !== 'dot' && s.id !== 'hex' && s.id !== 'chill' && s.id !== 'root';
          });
          if (t.statuses.length < before) {
            log.push(t.name + ' is cleansed by mend');
          }
        }
        hits.push({ targetId: t.id, amount: amount, kind: 'heal', crit: false });
        log.push(actor.name + ' heals ' + t.name + ' for ' + amount);
      });
      actor.healsDone = (actor.healsDone || 0) + healTotal;
      if (skill.cd) skill.cooldownLeft = skill.cd;
      return {
        log: log, killed: [], totalDamage: 0, crits: 0, heal: healTotal,
        hits: hits, kind: 'heal', skill: skill, actor: actor,
        aoe: !!skill.aoe, targetId: targetId
      };
    }

    if (isBuffSkill) {
      var buffSide = actor.isFoe ? foes : allies;
      var buffTargets = buffSide.filter(function (u) { return u.alive; });
      if (!skill.aoe) {
        var oneBuff = null;
        if (targetId != null && targetId !== 'ALL' && targetId !== '*') {
          oneBuff = buffTargets.find(function (u) { return u.id === targetId; }) || null;
        }
        if (!oneBuff) oneBuff = actor;
        buffTargets = oneBuff ? [oneBuff] : [actor];
      }
      buffTargets.forEach(function (t) {
        var st = applyStatus(t, 'ward', { sourceId: actor.id, duration: 2 });
        // Offensive shells also empower
        if (/heat|charge|molten|empower|rage/i.test(String(skill.id || ''))) {
          applyStatus(t, 'empower', { sourceId: actor.id, duration: 2 });
        }
        hits.push({
          targetId: t.id,
          amount: 0,
          kind: 'buff',
          crit: false,
          statusApplied: st ? { id: st.id, name: st.name, icon: st.icon, color: st.color } : null
        });
        log.push(actor.name + ' shields ' + t.name + (st ? ' (' + st.name + ')' : ''));
      });
      if (skill.cd) skill.cooldownLeft = skill.cd;
      return {
        log: log, killed: [], totalDamage: 0, crits: 0,
        hits: hits, kind: 'buff', skill: skill, actor: actor,
        aoe: !!skill.aoe, targetId: targetId
      };
    }

    var enemies = actor.isFoe ? allies : foes;
    var living = enemies.filter(function (u) { return u.alive; });
    if (!living.length) {
      return { log: log, killed: [], totalDamage: 0, crits: 0, hits: hits, kind: 'miss', skill: skill, actor: actor };
    }

    var targets = [];
    // AOE flag owns multi-hit. Single-target never fans out (ignore ALL/*).
    if (skill.aoe) {
      targets = living.slice();
    } else {
      var chosen = null;
      if (targetId != null && targetId !== 'ALL' && targetId !== '*') {
        chosen = living.find(function (u) { return u.id === targetId; }) || null;
      }
      if (!chosen) {
        // Auto / foe fallback: lowest HP ratio
        living.sort(function (a, b) { return (a.hp / a.maxHp) - (b.hp / b.maxHp); });
        chosen = living[0];
      }
      targets = [chosen];
    }

    var killed = [];
    var totalDamage = 0;
    var crits = 0;
    var statusChance = skillStatusChance(skill, actor);
    var statusId = elementStatusId(actor.element);

    targets.forEach(function (t) {
      var dmg = computeDamage(actor, t, skill);
      // Base chart + Perception set edge (matches computeDamage)
      var baseAff = getAffinityMultiplier(actor.element, t.element);
      var aff = baseAff;
      if (actor.affinityBonus) aff *= (1 + actor.affinityBonus);
      // Critical set + rarity evo + expose status on target
      var critRate = (actor.critChance != null) ? actor.critChance : 0.14;
      if (hasStatus(t, 'expose')) {
        var ex = getStatus(t, 'expose');
        critRate += (ex && ex.critBonus) || 0.14;
      }
      critRate = Math.min(0.55, Math.max(0.05, critRate));
      var isCrit = Math.random() < critRate;
      if (isCrit) {
        dmg = Math.floor(dmg * 1.5);
        crits += 1;
        actor.critsLanded = (actor.critsLanded || 0) + 1;
      }
      // Consume shock mark after it boosted this hit
      if (hasStatus(t, 'shock')) {
        t.statuses = (t.statuses || []).filter(function (s) { return s && s.id !== 'shock'; });
      }
      t.hp = Math.max(0, t.hp - dmg);
      t.damageTaken = (t.damageTaken || 0) + dmg;
      actor.damageDealt = (actor.damageDealt || 0) + dmg;
      totalDamage += dmg;
      var dead = t.hp <= 0;
      var affTag = aff > 1.001 ? 'strong' : (aff < 0.999 ? 'weak' : 'neutral');

      // Elemental status proc (fire → burn, poison → poison, …)
      var statusApplied = null;
      if (!dead && statusId && Math.random() < statusChance) {
        var applied = applyStatus(t, statusId, { sourceId: actor.id });
        if (applied) {
          statusApplied = {
            id: applied.id,
            name: applied.name,
            icon: applied.icon,
            color: applied.color,
            duration: applied.duration
          };
          log.push(t.name + ' is afflicted with ' + applied.name + '!');
        }
      }

      hits.push({
        targetId: t.id,
        amount: dmg,
        kind: 'damage',
        crit: isCrit,
        affinity: aff,
        baseAffinity: baseAff,
        affinityTag: affTag,
        killed: dead,
        element: actor.element,
        statusApplied: statusApplied
      });
      log.push(actor.name + ' hits ' + t.name + ' for ' + dmg +
        (isCrit ? ' CRIT!' : '') +
        (affTag === 'strong' ? ' (ADV)' : affTag === 'weak' ? ' (WEAK)' : '') +
        (statusApplied ? ' [' + statusApplied.name + ']' : ''));
      if (dead) {
        t.alive = false;
        killed.push(t);
        log.push(t.name + ' falls!');
      }
    });

    if (skill.cd) skill.cooldownLeft = skill.cd;
    return {
      log: log, killed: killed, totalDamage: totalDamage, crits: crits, hits: hits,
      kind: targets.length > 1 ? 'aoe' : 'attack', skill: skill, actor: actor,
      aoe: targets.length > 1, targetId: targetId
    };
  }

  function battleStatus(allies, foes) {
    var alliesAlive = allies.filter(function (u) { return u.alive; }).length;
    var foesAlive = foes.filter(function (u) { return u.alive; }).length;
    if (foesAlive === 0) return 'win';
    if (alliesAlive === 0) return 'lose';
    return 'ongoing';
  }

  /**
   * Create a battle state and drive turns (manual skillId optional for current actor).
   */
  function createBattle(partySlimes, foeSlimes, opts) {
    opts = opts || {};
    // Party trait synergies — stamp onto champs before makeCombatant so attributes include them
    var partySyn = null;
    if (DATA && typeof DATA.computePartyTraitSynergies === 'function') {
      partySyn = DATA.computePartyTraitSynergies(partySlimes || []);
    }
    var allies = (partySlimes || []).map(function (s) {
      var src = s || {};
      if (partySyn && partySyn.mods && partySyn.active && partySyn.active.length) {
        // Shallow copy so we don't persist _partySynergyMods on the roster object
        src = Object.assign({}, src, { _partySynergyMods: partySyn.mods });
        if (DATA.computeChampionAttributes) {
          src.attributes = DATA.computeChampionAttributes(src);
        }
      }
      return makeCombatant(src, false, opts);
    });
    var foes = (foeSlimes || []).map(function (s) { return makeCombatant(s, true, opts); });
    var log = ['Battle start! SPD fills the turn meter.'];
    if (partySyn && partySyn.lines && partySyn.lines.length) {
      log.push('Party synergy: ' + partySyn.lines.join(' · '));
    }
    return {
      allies: allies,
      foes: foes,
      auto: !!opts.auto,
      log: log,
      status: 'ongoing',
      currentActor: null,
      turns: 0,
      startedAt: Date.now(),
      totalDamageToFoe: 0,
      totalDamageToParty: 0,
      crits: 0,
      skillsUsed: 0,
      // Multi-wave dungeon metadata (optional)
      waveIndex: opts.waveIndex != null ? opts.waveIndex : 0,
      totalWaves: opts.totalWaves != null ? opts.totalWaves : 1,
      partySynergies: partySyn
    };
  }

  /**
   * Between-wave: keep living allies (HP/CDs), soft recover, replace foes.
   * Party HP carries — Raid-style dungeon delve.
   */
  function advanceWave(battle, foeSlimes, opts) {
    opts = opts || {};
    battle = battle || {};
    var healFrac = opts.healFrac != null ? opts.healFrac : 0.14;
    (battle.allies || []).forEach(function (a) {
      if (!a || !a.alive) return;
      // Soft between-wave mend (not full rest)
      var heal = Math.floor(a.maxHp * healFrac);
      a.hp = Math.min(a.maxHp, a.hp + heal);
      // Partial turn-meter reset so neither side starts full
      a.turnMeter = Math.min(a.turnMeter || 0, TURN_METER_FULL * 0.35);
      // Tick skill CDs once as a breather
      if (a.skills) {
        a.skills.forEach(function (s) {
          if (s.cooldownLeft > 0) s.cooldownLeft = Math.max(0, s.cooldownLeft - 1);
        });
      }
    });
    battle.foes = (foeSlimes || []).map(function (s) { return makeCombatant(s, true, opts); });
    battle.status = 'ongoing';
    battle.currentActor = null;
    battle.waveIndex = (battle.waveIndex || 0) + 1;
    if (opts.totalWaves != null) battle.totalWaves = opts.totalWaves;
    battle.log = (battle.log || []).concat([
      'Wave ' + (battle.waveIndex + 1) + '/' + (battle.totalWaves || 1) + ' begins!'
    ]);
    return battle;
  }

  function allUnits(battle) {
    return (battle.allies || []).concat(battle.foes || []);
  }

  /** Advance to next actor ready to act. CDs + status DoTs tick at turn start. */
  function nextActor(battle) {
    if (battle.status !== 'ongoing') return null;
    var actor = advanceTurnMeters(allUnits(battle));
    battle.currentActor = actor;
    battle.lastStatusTicks = [];
    if (actor) {
      tickCooldowns(actor);
      var st = tickStatuses(actor);
      battle.lastStatusTicks = st.ticks || [];
      if (st.logs && st.logs.length) {
        battle.log = (battle.log || []).concat(st.logs);
      }
      if (st.killed) {
        battle.log.push(actor.name + ' cannot act…');
        battle.status = battleStatus(battle.allies, battle.foes);
        battle.currentActor = null;
        return null;
      }
      battle.turns += 1;
      battle.log.push(actor.name + ' is ready (SPD ' + Math.floor(effectiveSpeed(actor)) + ')');
    }
    return actor;
  }

  /**
   * Resolve one action for current actor.
   * skillId: for manual ally turns; ignored if auto or foe.
   * targetId: optional foe id for single-target skills.
   */
  function resolveTurn(battle, skillId, targetId) {
    if (battle.status !== 'ongoing') return battle;
    var actor = battle.currentActor || nextActor(battle);
    if (!actor || !actor.alive) {
      battle.currentActor = null;
      return battle;
    }

    var skill = null;
    var allySide = actor.isFoe ? battle.foes : battle.allies;
    if (actor.isFoe || battle.auto) {
      skill = pickAutoSkill(actor, allySide);
    } else if (skillId) {
      skill = actor.skills.find(function (s) { return s.id === skillId && !s.cooldownLeft; }) || null;
    }
    if (!skill) skill = pickAutoSkill(actor, allySide);
    if (!skill) {
      // Forced basic if all on CD
      skill = actor.skills[0] || { id: 'basic', name: 'Gel Strike', mult: 1, cd: 0, cooldownLeft: 0 };
      skill.cooldownLeft = 0;
    }

    var result = applySkill(actor, skill, battle.allies, battle.foes, targetId);
    battle.log = battle.log.concat(result.log);
    battle.skillsUsed = (battle.skillsUsed || 0) + 1;
    battle.crits = (battle.crits || 0) + (result.crits || 0);
    if (actor.isFoe) {
      battle.totalDamageToParty = (battle.totalDamageToParty || 0) + (result.totalDamage || 0);
    } else {
      battle.totalDamageToFoe = (battle.totalDamageToFoe || 0) + (result.totalDamage || 0);
    }
    // Last action payload for floating numbers / VFX (not a re-implementation of combat)
    battle.lastAction = {
      actorId: actor.id,
      actorName: actor.name,
      actorElement: actor.element,
      skillId: skill.id,
      skillName: skill.name,
      skillIcon: skill.icon || '✨',
      kind: result.kind,
      aoe: !!result.aoe,
      hits: result.hits || [],
      totalDamage: result.totalDamage || 0,
      heal: result.heal || 0,
      crits: result.crits || 0,
      killed: (result.killed || []).map(function (u) { return u.id; }),
      statusTicks: battle.lastStatusTicks || []
    };
    battle.status = battleStatus(battle.allies, battle.foes);
    battle.currentActor = null;

    if (battle.status === 'win') battle.log.push('Victory!');
    if (battle.status === 'lose') battle.log.push('Defeat…');
    return battle;
  }

  /** Snapshot for end-of-fight splash (HTML results overlay parity). */
  function getBattleSummary(battle) {
    battle = battle || {};
    var allies = battle.allies || [];
    var foes = battle.foes || [];
    var mvp = null;
    allies.forEach(function (a) {
      if (!mvp || (a.damageDealt || 0) > (mvp.damageDealt || 0)) mvp = a;
    });
    var elapsedMs = Math.max(0, Date.now() - (battle.startedAt || Date.now()));
    return {
      status: battle.status,
      turns: battle.turns || 0,
      elapsedSec: Math.max(1, Math.round(elapsedMs / 1000)),
      totalDamageToFoe: battle.totalDamageToFoe || 0,
      totalDamageToParty: battle.totalDamageToParty || 0,
      crits: battle.crits || 0,
      skillsUsed: battle.skillsUsed || 0,
      mvp: mvp,
      allies: allies.map(function (a) {
        return {
          id: a.id,
          name: a.name,
          element: a.element,
          rarity: a.rarity || 'Common',
          artVariant: a.artVariant || null,
          alive: a.alive,
          damageDealt: a.damageDealt || 0,
          damageTaken: a.damageTaken || 0,
          skillsUsed: a.skillsUsed || 0,
          critsLanded: a.critsLanded || 0,
          healsDone: a.healsDone || 0,
          speed: a.speed || 0,
          maxHp: a.maxHp || 0,
          hp: a.hp || 0,
          isFoe: false
        };
      }),
      foes: foes.map(function (f) {
        return {
          id: f.id,
          name: f.name,
          element: f.element,
          rarity: f.rarity || 'Common',
          artVariant: f.artVariant || null,
          enemyKind: f.enemyKind || null,
          alive: f.alive,
          damageDealt: f.damageDealt || 0,
          damageTaken: f.damageTaken || 0,
          skillsUsed: f.skillsUsed || 0,
          critsLanded: f.critsLanded || 0,
          speed: f.speed || 0,
          maxHp: f.maxHp || 0,
          hp: f.hp || 0,
          isFoe: true
        };
      })
    };
  }

  /** Run full auto battle to completion (or maxTurns). */
  function runAutoBattle(partySlimes, foeSlimes, maxTurns) {
    maxTurns = maxTurns || 80;
    var battle = createBattle(partySlimes, foeSlimes, { auto: true });
    while (battle.status === 'ongoing' && battle.turns < maxTurns) {
      nextActor(battle);
      if (!battle.currentActor) break;
      resolveTurn(battle);
    }
    if (battle.status === 'ongoing') battle.status = battleStatus(battle.allies, battle.foes);
    return battle;
  }

  /**
   * Depth layout for Raid-style arena (pure numbers, no Phaser).
   * Allies near (high y / high depth), foes far (low y).
   * Returns { allies: [{x,y,depth,scale}], foes: [...] }
   */
  function computeArenaLayout(allyCount, foeCount, width, height) {
    width = width || 960;
    height = height || 540;
    var allies = [];
    var foes = [];
    var i;
    // Foes: back row (far), smaller scale, lower y toward vanishing point
    for (i = 0; i < foeCount; i++) {
      var fx = width * (0.55 + (i + 1) / (foeCount + 1) * 0.38);
      var fy = height * (0.28 + (i % 2) * 0.04);
      foes.push({
        x: fx,
        y: fy,
        depth: 10 + i,
        scale: 0.72 + (i % 2) * 0.04,
        side: 'enemy',
        near: false
      });
    }
    // Allies: front row (near), larger scale
    for (i = 0; i < allyCount; i++) {
      var ax = width * (0.08 + (i + 1) / (allyCount + 1) * 0.38);
      var ay = height * (0.58 + (i % 2) * 0.05);
      allies.push({
        x: ax,
        y: ay,
        depth: 50 + i,
        scale: 1.0 + (i % 2) * 0.05,
        side: 'ally',
        near: true
      });
    }
    return { allies: allies, foes: foes, vanishingY: height * 0.18, floorY: height * 0.72 };
  }

  var API = {
    TURN_METER_FULL: TURN_METER_FULL,
    STATUS_DEFS: STATUS_DEFS,
    resolveCombatSpeed: resolveCombatSpeed,
    defaultSkills: defaultSkills,
    normalizeSkill: normalizeSkill,
    makeCombatant: makeCombatant,
    getAffinityMultiplier: getAffinityMultiplier,
    advanceTurnMeters: advanceTurnMeters,
    getUsableSkills: getUsableSkills,
    getBattleSummary: getBattleSummary,
    pickAutoSkill: pickAutoSkill,
    computeDamage: computeDamage,
    applySkill: applySkill,
    battleStatus: battleStatus,
    createBattle: createBattle,
    advanceWave: advanceWave,
    nextActor: nextActor,
    resolveTurn: resolveTurn,
    runAutoBattle: runAutoBattle,
    computeArenaLayout: computeArenaLayout,
    elementStatusId: elementStatusId,
    skillStatusChance: skillStatusChance,
    applyStatus: applyStatus,
    tickStatuses: tickStatuses,
    hasStatus: hasStatus,
    effectiveSpeed: effectiveSpeed
  };

  global.SR_COMBAT = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : global);
