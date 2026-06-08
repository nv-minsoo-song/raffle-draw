# Raffle Draw

An event-screen raffle app for drawing one winner at a time from a CSV or XLSX list.
The interface is in English, and Korean names are shown with an English-readable
pronunciation for the presenter.

Participant CSV/XLSX files are intentionally ignored by Git. The verification
script generates a 790-person sample list internally for large-list testing.

## How to Run

Open [index.html](/Users/mingyuy/Documents/Raffle/index.html) in a browser.
No installation or server is required.

## Participant File Format

Minimum format:

```csv
No,Korean Name,Affiliation
1,양민규,DevRel
2,김민수,Engineering
```

Recommended format for a high-profile live event:

```csv
No,Korean Name,English Name,Affiliation
1,양민규,Yang Min-gyu,DevRel
2,김민수,Kim Min-su,Engineering
```

If `English Name` is present, the app uses it exactly. If it is missing, the app
auto-generates a readable romanization from the Korean name.

The app also accepts `.xlsx` files. If a spreadsheet has a raffle/ticket column
such as `행운권 추첨번호`, `추첨번호`, `Raffle`, or `Ticket`, that value is used as
the display number before generic columns such as `IDX` or `ID`.

## Controls

- `Enter` or `Space`: draw one winner
- `Winners per Draw`: use `-`, number input, or `+` to choose how many
  winners to draw at once, from 1 to 50
- `Full Screen`: present on a monitor
- `Mark Absent`: move the currently displayed winner to the absent list and
  exclude that person from replacement draws
- `Absent` on a winner card: mark only that person absent when three winners
  are shown at once
- `Restore Last Absent`: undo an accidental absent mark and return that person
  to the draw pool
- `Undo Last Winner`: restore the previous winner to the draw pool
- `Save Results CSV`: export winners and absent records with Korean and
  English-readable names
- `Restart Draw`: clear winner history for the loaded list

## Verification

Run:

```sh
node verify.js
```

The verification script covers these use cases:

- Parse a Korean-name CSV
- Parse a local XLSX participant list when one is present in the project folder
- Auto-generate English-readable names
- Prefer a provided `English Name` column over auto-generation
- Draw exactly three unique winners
- Draw three winners simultaneously in one batch
- Draw seven winners simultaneously using the adjustable count control
- Mark a called winner as absent, then draw a replacement
- Mark one absent person from a three-winner batch and draw only one replacement
- Mark two absent people from a seven-winner batch and draw only two replacements
- Restore an accidentally marked absent person to the draw pool
- Still reach three final winners after one called winner is absent
- Parse quoted CSV values with commas
- Export both `Winner` and `Absent` statuses
