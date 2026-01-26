# Home Inventory Test Capture Guide

Capture these photos to build a comprehensive evaluation test set. Each scenario tests different aspects of vision model performance.

## Capture Session Setup

1. Open the PWA: https://capture-pearl.vercel.app
2. Create a new project with type: **home-inventory**
3. Name it something like "Eval Test Set"
4. Record audio while capturing - narrate what you're photographing

---

## Required Photos (20 minimum)

### Kitchen (4-5 photos)

| # | Scenario | Tests | Transcript Suggestion |
|---|----------|-------|----------------------|
| K1 | **Drawer with utensils** | Container detection, item listing | "Kitchen utensil drawer, has spatulas, wooden spoons, tongs..." |
| K2 | **Counter with appliances** | No container, multiple items | "Counter by the stove with the toaster and coffee maker" |
| K3 | **Pantry shelf** | Shelving as container, grouped items | "Pantry shelf with canned goods and pasta" |
| K4 | **Under-sink cabinet** | Hidden storage, cleaning supplies | "Under the sink, this is where the cleaning supplies are" |
| K5 | **Junk drawer** | Dense mixed items | "The junk drawer - batteries, tape, scissors, random stuff" |

### Bedroom (3-4 photos)

| # | Scenario | Tests | Transcript Suggestion |
|---|----------|-------|----------------------|
| B1 | **Closet overview** | Room detection, clothing | "Master bedroom closet" |
| B2 | **Nightstand** | Furniture as location, small items | "Nightstand with lamp, charger, book" |
| B3 | **Dresser top** | Surface items | "Dresser with jewelry box and photos" |
| B4 | **Closet shelf (high)** | Specific area, stored items | "Top shelf of closet - luggage and blankets" |

### Garage/Storage (4-5 photos)

| # | Scenario | Tests | Transcript Suggestion |
|---|----------|-------|----------------------|
| G1 | **Tool pegboard** | Wall-mounted items | "Tool wall in garage" |
| G2 | **Shelving unit** | Multi-level container | "Metal shelves with bins" |
| G3 | **Labeled bins** | Text recognition, container names | "Holiday decorations bin" |
| G4 | **Workbench** | Work surface, tools | "Workbench with power tools" |
| G5 | **Overhead storage** | Unusual location | "Overhead storage rack" |

### Living Room (2-3 photos)

| # | Scenario | Tests | Transcript Suggestion |
|---|----------|-------|----------------------|
| L1 | **Entertainment center** | Electronics | "TV area with gaming console and soundbar" |
| L2 | **Bookshelf** | Many similar items | "Bookshelf in living room" |
| L3 | **Side table/drawer** | Small furniture storage | "Side table drawer with remotes" |

### Bathroom (2-3 photos)

| # | Scenario | Tests | Transcript Suggestion |
|---|----------|-------|----------------------|
| BA1 | **Medicine cabinet** | Small items, toiletries | "Medicine cabinet" |
| BA2 | **Under-sink vanity** | Cleaning/hygiene supplies | "Under the bathroom sink" |
| BA3 | **Linen closet** | Towels, linens | "Bathroom linen closet" |

### Office/Desk (2-3 photos)

| # | Scenario | Tests | Transcript Suggestion |
|---|----------|-------|----------------------|
| O1 | **Desk setup** | Electronics, work items | "Home office desk" |
| O2 | **Desk drawer** | Office supplies | "Desk drawer with supplies" |
| O3 | **Filing cabinet** | Documents/folders | "Filing cabinet" |

---

## Challenging Scenarios (Optional but valuable)

These photos test edge cases:

| # | Scenario | Why It's Challenging |
|---|----------|---------------------|
| C1 | **Cluttered space** | Dense items, overlapping |
| C2 | **Dark closet** | Low light conditions |
| C3 | **Reflective surfaces** | Glass cabinet, mirrors |
| C4 | **Partially open drawer** | Partial visibility |
| C5 | **Multiple containers in view** | Drawer in cabinet on shelf |
| C6 | **Ambiguous room** | Laundry room, mudroom, utility |

---

## After Capture

1. **Export** the session from the PWA
2. The photos will be in `evidence/sessions/{session-id}/photos/`
3. Run this command to add photos to the test fixture:

```bash
# List photos in your new session
ls evidence/sessions/{your-session-id}/photos/

# Then update tests/evaluation/test-session.json with new entries
```

4. For each photo, add expected output to test-session.json:

```json
{
  "id": "photo-K1",
  "source_file": "../../evidence/sessions/{session-id}/photos/{filename}.jpg",
  "description": "Kitchen drawer with utensils",
  "transcript_context": "Kitchen utensil drawer..."
}
```

And expected output:

```json
"photo-K1": {
  "room": "kitchen",
  "area": "drawer",
  "container": "utensil drawer",
  "items": [{"name": "spatula"}, {"name": "wooden spoon"}, {"name": "tongs"}],
  "must_identify": ["spatula", "spoon"],
  "should_identify": ["tongs", "drawer"],
  "room_confidence": "high"
}
```

---

## Quick Capture Checklist

- [ ] K1: Kitchen drawer
- [ ] K2: Kitchen counter
- [ ] K3: Pantry
- [ ] K4: Under sink
- [ ] B1: Bedroom closet
- [ ] B2: Nightstand
- [ ] B3: Dresser
- [ ] G1: Tool wall
- [ ] G2: Garage shelves
- [ ] G3: Labeled bin
- [ ] G4: Workbench
- [ ] L1: Entertainment center
- [ ] L2: Bookshelf
- [ ] BA1: Medicine cabinet
- [ ] BA2: Bathroom under-sink
- [ ] O1: Desk setup
- [ ] O2: Desk drawer
- [ ] C1: Cluttered space
- [ ] C2: Dark closet
- [ ] C3: Ambiguous room

**Target: 20+ photos covering different rooms, containers, and item types**
