# Desi Ludo — what changed, and what other lanes need to know

Migrations **0042 / 0042b / 0042c / 0042d**. The rules themselves are
documented at length in the header of `0042_desi_ludo.sql`; this file is the
short version plus the seams that touch other people's code.

## The rails contract is unchanged

`game_exec_ludo(session, seat, by_bot, payload)` still returns
`{move, winner, again}`, and `dice_count` rides `house_rules` exactly as
`turn_seconds` does. Nothing in `GAMES_CONTRACT.md` needs editing.

Two things about it are worth knowing anyway:

**`again` now carries two meanings.** It has always meant "the turn stays with
this seat". It now does so for two reasons rather than one: an extra roll was
earned, *or* a die is still unassigned in two-dice mode. The rails treat both
identically, so nothing downstream changes — but a two-dice turn writes **two**
`game_moves` rows, not one.

**A chained six writes an honest row with nothing committed.** Moves made
during a run of sixes land on a provisional board (`state.prov`) and may be
voided wholesale, so their `game_moves` row carries `provisional: true`,
`chain: <n>`, and no committed position. **Anything that renders move history
must read sensibly against that** — "six, chain at 2, nothing committed yet" is
a real row, not a corrupt one. `LudoSession` says so in words
(`ludo.last.provisional`); a renderer that assumes every row moved a piece to a
square will show a blank or a zero.

## Old tables finish under old rules

`state.ruleset` is the marker. Tables created from 0042b carry `'desi'`;
anything without it is `'classic'` and plays exactly as it did — one die, no
jota, no wall, no chain. It is the same code with the flag off, not a second
engine. Every house rule the old engine honoured (`capture_before_home`,
`exact_home`, `safe_squares`, `extra_roll_on_six`) is honoured here too, so no
live table changes rules mid-play.

## The client asks the server what is legal

`state.legal` is **gone**. Legality is now per-die and comes from
`ludo_desi_legal(state, seat, seats, die)`, which returns
`[{piece, split, to, kind}]` where `kind` is `'out' | 'single' | 'pair'`.

The client draws its choices from that array and `game_exec_ludo` validates
every incoming move against the *same* array, so what a person is offered and
what the server will accept cannot drift apart. `ludoRails.legalFor()` is the
wrapper.

`move()` now takes `{piece, die, split}`. `die` is the **index** into
`state.dice`, not its face, so a player holding two sixes can say which one
they are spending.

## `state` shape

```
{
  pieces:      [[p,p,p,p], ...]   committed board; 0 yard, 1..51 track,
                                  52..56 home column, 57 home
  prov:        [[...]]            provisional board, present only mid-chain
  dice:        [{v, used, wasted}, ...]   present only between roll and turn end
  chain:       0                  consecutive sixes so far
  chain_void:  bool               set once when a chain was discarded
  pairs_moved: {"seat:square": true}      which jotas have moved as a pair
  ruleset:     'desi' | absent
  dice_count:  1 | 2
  rules, captured_by, last        as before
}
```

## 0042c: the rule functions are readable by a signed-in player

They are pure — they take a whole board as an argument, touch no table, hold no
secret — so a hypothetical board tells a caller nothing about a real game. This
is what lets `tests/ludo-jota.mjs` run through the ordinary anon-key harness.
`game_exec_ludo` stays revoked.

## 0042d: the bug worth remembering

`ludo_roll` checks `auth.uid()` against the seat, which is right for a person
and impossible for a bot: a bot seat has no `profile_id`. `game_tick` plays a
bot (or a seat whose person has gone quiet) by calling `exec_game_move`
straight, with no roll first — so the executor found no dice, raised
`'Roll first'`, and `game_tick`'s `exception when others` swallowed it as a
skipped session.

**Every ludo table with a bot in it would have frozen for good on the bot's
turn, with nothing in the UI to say why.** 0042d has the executor roll for
itself when the caller is a bot.

The general shape is worth carrying to the other games — and lane -42, asked
this question of carrom and snakes, found the sharper form of it (0043):

> **Anywhere the system can seat a player that cannot act, it must refuse
> rather than seat them.**

The freeze arrives identically whether the bot cannot be *authenticated* (ludo,
above) or simply has no logic to run: `start_with_bots` would seat bots at
carrom, which has no bot player at all, and the turn then ping-ponged forever
between a person and a chair that could never take a shot. Four such tables
existed, three of them active, two of them already reported as "broken".

**Neither check catches the other, and that is the part worth remembering.**
0043 guards on `timeout_style = 'pass_turn'`, which is a declaration of what
`game_tick` should *do* — not proof that the executor actually handles
`by_bot`. Ludo is `bot_plays` and always was, including for the whole time its
executor raised `'Roll first'` at every bot: 0043's guard would have waved it
straight through. And 0042d says nothing about carrom. They are siblings, and
the honest conclusion is that a third sibling is found by asking a different
question again, not by trusting either guard to be the general one.

## Verified

- `tests/ludo-jota.mjs` — 56 checks, all green, no DB channel needed. Every
  assertion is against a synthetic board handed to the pure rule functions:
  the jota's every branch, the wall, exact-landing rest, jota-kill, the
  singles-can't-stack-into-a-kill case, home-column pairing, the chain
  arithmetic at 1–10, and the classic table staying classic.
- A live two-seat table driven through the real RPCs as both seats: form a
  jota, wall, land exactly and rest, split, jota-kill. Screenshots in both
  languages.
- A bot-vs-bot table ticked to a finish: 104 move rows, 8 pair moves, 1
  capture, 2 provisional rows, clean `winner_seat`, no dangling `prov` and an
  empty `pairs_moved` at the end.
